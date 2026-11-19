import { resolveStorage, StorageUnavailableError } from "@/lib/storage";
import { supabaseHeaders } from "@/lib/supabase";
import type { DeliveryMethodId, ExtraId, ProductId } from "@/content/firewood";
import type { PriceLine } from "./pricing";
import type { FirewoodOrder, NewOrder, OrderPatch, OrderStatus, OrderStore } from "./types";

// Same storage rules as bookings (lib/storage.ts). The memory store is for development and demos
// only, and real payments refuse to run on it (lib/firewood/gate.ts).

const TIMEOUT_MS = 8000;

export class MemoryOrderStore implements OrderStore {
  private rows = new Map<string, FirewoodOrder>();

  async create(input: NewOrder) {
    for (const r of this.rows.values()) {
      if (r.idempotencyKey === input.idempotencyKey) return { order: { ...r }, existing: true };
    }
    const order: FirewoodOrder = {
      ...input,
      id: crypto.randomUUID(),
      status: "pending",
      stripeSessionId: null,
      stripeCheckoutUrl: null,
      stripePaymentIntent: null,
      createdAt: new Date().toISOString(),
      paidAt: null,
      notifiedAt: null,
    };
    this.rows.set(order.ref, order);
    return { order: { ...order }, existing: false };
  }

  async attachSession(ref: string, sessionId: string, url: string) {
    const row = this.rows.get(ref);
    if (row) Object.assign(row, { stripeSessionId: sessionId, stripeCheckoutUrl: url });
  }

  async findByRef(ref: string) {
    const row = this.rows.get(ref);
    return row ? { ...row } : null;
  }

  async findBySession(sessionId: string) {
    for (const r of this.rows.values()) if (r.stripeSessionId === sessionId) return { ...r };
    return null;
  }

  async transition(ref: string, from: OrderStatus[], to: OrderStatus, patch: OrderPatch = {}) {
    const row = this.rows.get(ref);
    if (!row) return null;
    if (!from.includes(row.status)) return { order: { ...row }, changed: false };
    Object.assign(row, patch, { status: to });
    return { order: { ...row }, changed: true };
  }

  async claimNotification(ref: string) {
    const row = this.rows.get(ref);
    if (!row || row.notifiedAt) return false;
    row.notifiedAt = new Date().toISOString();
    return true;
  }

  async releaseNotification(ref: string) {
    const row = this.rows.get(ref);
    if (row) row.notifiedAt = null;
  }
}

interface Row {
  id: string;
  ref: string;
  status: OrderStatus;
  idempotency_key: string;
  product_id: string;
  delivery_method: string;
  carry_steps: boolean;
  rough_terrain: boolean;
  delivery_date: string;
  street: string;
  city: string;
  zip: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  instructions: string;
  lines: PriceLine[];
  total_cents: number;
  currency: string;
  test_mode: boolean;
  stripe_session_id: string | null;
  stripe_checkout_url: string | null;
  stripe_payment_intent: string | null;
  created_at: string;
  paid_at: string | null;
  notified_at: string | null;
}

function fromRow(r: Row): FirewoodOrder {
  const extras: ExtraId[] = [];
  if (r.carry_steps) extras.push("steps");
  if (r.rough_terrain) extras.push("rough-terrain");
  return {
    id: r.id,
    ref: r.ref,
    status: r.status,
    idempotencyKey: r.idempotency_key,
    productId: r.product_id as ProductId,
    methodId: r.delivery_method as DeliveryMethodId,
    extras,
    deliveryDate: r.delivery_date,
    address: { street: r.street, city: r.city, zip: r.zip },
    customer: { name: r.customer_name, email: r.customer_email, phone: r.customer_phone },
    instructions: r.instructions,
    lines: r.lines,
    totalCents: r.total_cents,
    currency: r.currency,
    testMode: r.test_mode,
    stripeSessionId: r.stripe_session_id,
    stripeCheckoutUrl: r.stripe_checkout_url,
    stripePaymentIntent: r.stripe_payment_intent,
    createdAt: r.created_at,
    paidAt: r.paid_at,
    notifiedAt: r.notified_at,
  };
}

/** PostgREST over fetch, against db/migrations/003_firewood_orders.sql. */
export class SupabaseOrderStore implements OrderStore {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
  ) {}

  private async call(path: string, init: RequestInit & { prefer?: string } = {}): Promise<Row[]> {
    const { prefer, ...rest } = init;
    const res = await fetch(`${this.url}/rest/v1/firewood_orders${path}`, {
      ...rest,
      headers: {
        ...supabaseHeaders(this.serviceKey),
        ...(prefer ? { Prefer: prefer } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Supabase firewood_orders failed (${res.status})`);
    const text = await res.text();
    return text ? (JSON.parse(text) as Row[]) : [];
  }

  private async first(filter: string): Promise<FirewoodOrder | null> {
    const rows = await this.call(`?${filter}&select=*&limit=1`);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async create(o: NewOrder) {
    const rows = await this.call("?on_conflict=idempotency_key", {
      method: "POST",
      prefer: "return=representation,resolution=ignore-duplicates",
      body: JSON.stringify({
        ref: o.ref,
        idempotency_key: o.idempotencyKey,
        product_id: o.productId,
        delivery_method: o.methodId,
        carry_steps: o.extras.includes("steps"),
        rough_terrain: o.extras.includes("rough-terrain"),
        delivery_date: o.deliveryDate,
        street: o.address.street,
        city: o.address.city,
        zip: o.address.zip,
        customer_name: o.customer.name,
        customer_email: o.customer.email,
        customer_phone: o.customer.phone,
        instructions: o.instructions,
        lines: o.lines,
        total_cents: o.totalCents,
        currency: o.currency,
        test_mode: o.testMode,
      }),
    });
    if (rows[0]) return { order: fromRow(rows[0]), existing: false };
    const existing = await this.first(`idempotency_key=eq.${encodeURIComponent(o.idempotencyKey)}`);
    if (!existing) throw new Error("Supabase firewood_orders: insert ignored but no existing row found");
    return { order: existing, existing: true };
  }

  async attachSession(ref: string, sessionId: string, url: string) {
    await this.call(`?ref=eq.${encodeURIComponent(ref)}`, {
      method: "PATCH",
      body: JSON.stringify({ stripe_session_id: sessionId, stripe_checkout_url: url }),
    });
  }

  findByRef(ref: string) {
    return this.first(`ref=eq.${encodeURIComponent(ref)}`);
  }

  findBySession(sessionId: string) {
    return this.first(`stripe_session_id=eq.${encodeURIComponent(sessionId)}`);
  }

  async transition(ref: string, from: OrderStatus[], to: OrderStatus, patch: OrderPatch = {}) {
    const body: Record<string, unknown> = { status: to };
    if (patch.paidAt !== undefined) body.paid_at = patch.paidAt;
    if (patch.stripePaymentIntent !== undefined) body.stripe_payment_intent = patch.stripePaymentIntent;

    const rows = await this.call(`?ref=eq.${encodeURIComponent(ref)}&status=in.(${from.join(",")})`, {
      method: "PATCH",
      prefer: "return=representation",
      body: JSON.stringify(body),
    });
    if (rows[0]) return { order: fromRow(rows[0]), changed: true };
    const current = await this.findByRef(ref);
    return current ? { order: current, changed: false } : null;
  }

  async claimNotification(ref: string) {
    const rows = await this.call(`?ref=eq.${encodeURIComponent(ref)}&notified_at=is.null`, {
      method: "PATCH",
      prefer: "return=representation",
      body: JSON.stringify({ notified_at: new Date().toISOString() }),
    });
    return rows.length > 0;
  }

  async releaseNotification(ref: string) {
    await this.call(`?ref=eq.${encodeURIComponent(ref)}`, {
      method: "PATCH",
      body: JSON.stringify({ notified_at: null }),
    });
  }
}

const globalForStore = globalThis as unknown as { __kggOrderStore?: OrderStore };

export function getOrderStore(): OrderStore {
  if (globalForStore.__kggOrderStore) return globalForStore.__kggOrderStore;
  const mode = resolveStorage();
  if (mode.kind === "unavailable") throw new StorageUnavailableError(mode.reason);
  const store = mode.kind === "supabase" ? new SupabaseOrderStore(mode.url, mode.serviceKey) : new MemoryOrderStore();
  globalForStore.__kggOrderStore = store;
  return store;
}

/** Tests only: forget the cached store so the next call re-reads the environment. */
export function resetOrderStore() {
  delete globalForStore.__kggOrderStore;
}
