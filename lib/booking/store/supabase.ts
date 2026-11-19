import type { PackageId } from "@/content/pricing";
import { makeReferralCode, sameReferral } from "@/lib/referral/code";
import { supabaseHeaders } from "@/lib/supabase";
import type { BookingRecord, BookingStore, CreateResult, ISODate, NewBooking, NewReferral, ReferralRecord, TakenSlot } from "../types";

/**
 * Supabase / Postgres store, talking to PostgREST over fetch (no client library needed).
 * Pair it with db/migrations/. The database does the real enforcing:
 *   - a partial unique index allows one confirmed booking per (service_date, slot_id)
 *   - a trigger takes a per-day advisory lock and refuses a booking over the daily cap
 *   - a unique idempotency key makes retries return the original booking
 * so double booking is impossible even if two servers race, or someone inserts by hand.
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side only, never NEXT_PUBLIC). The key can
 * be the older service_role key or the newer sb_secret_ key: lib/supabase.ts sends either correctly.
 * The tests run this adapter against the real migrations on PGlite, through a small
 * PostgREST stand-in. Its SQL side has been checked on the live project (2026-11-05); its HTTPS calls first run on the launch deploy.
 */

const TIMEOUT_MS = 8000;

interface Row {
  id: string;
  ref: string;
  service_date: string;
  slot_id: string;
  package_id: string;
  rinse: boolean;
  price_dollars: number;
  price_is_estimate: boolean;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  street: string;
  city: string;
  zip: string;
  notes: string;
  status: "confirmed" | "cancelled";
  created_at: string;
}

function toRow(b: NewBooking) {
  return {
    ref: b.ref,
    service_date: b.date,
    slot_id: b.slotId,
    package_id: b.packageId,
    rinse: b.rinse,
    price_dollars: b.priceDollars,
    price_is_estimate: b.priceIsEstimate,
    customer_name: b.customer.name,
    customer_email: b.customer.email,
    customer_phone: b.customer.phone,
    street: b.address.street,
    city: b.address.city,
    zip: b.address.zip,
    notes: b.notes,
    idempotency_key: b.idempotencyKey ?? null,
  };
}

function fromRow(r: Row): BookingRecord {
  return {
    id: r.id,
    ref: r.ref,
    date: r.service_date,
    slotId: r.slot_id,
    packageId: r.package_id as PackageId,
    rinse: r.rinse,
    priceDollars: r.price_dollars,
    priceIsEstimate: r.price_is_estimate,
    customer: { name: r.customer_name, email: r.customer_email, phone: r.customer_phone },
    address: { street: r.street, city: r.city, zip: r.zip },
    notes: r.notes,
    status: r.status,
    createdAt: r.created_at,
  };
}

interface ReferralRow {
  code: string;
  created_at: string;
  referrer_name: string;
  referrer_phone: string;
  referrer_email: string;
  reward: "cash" | "plan";
  friend_name: string;
  friend_phone: string;
  friend_email: string;
  friend_town: string;
  notes: string;
  booking_ref: string | null;
  booked_at: string | null;
  thanked_at: string | null;
}

function toReferralRow(r: NewReferral, code: string) {
  return {
    code,
    referrer_name: r.referrerName,
    referrer_phone: r.referrerPhone,
    referrer_email: r.referrerEmail,
    reward: r.reward,
    friend_name: r.friendName,
    friend_phone: r.friendPhone,
    friend_email: r.friendEmail,
    friend_town: r.friendTown,
    notes: r.notes,
  };
}

function fromReferralRow(r: ReferralRow): ReferralRecord {
  const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));
  return {
    code: r.code,
    createdAt: iso(r.created_at)!,
    referrerName: r.referrer_name,
    referrerPhone: r.referrer_phone,
    referrerEmail: r.referrer_email,
    reward: r.reward,
    friendName: r.friend_name,
    friendPhone: r.friend_phone,
    friendEmail: r.friend_email,
    friendTown: r.friend_town,
    notes: r.notes,
    bookingRef: r.booking_ref,
    bookedAt: iso(r.booked_at),
    thankedAt: iso(r.thanked_at),
  };
}

export class SupabaseBookingStore implements BookingStore {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
  ) {}

  private headers(): HeadersInit {
    return supabaseHeaders(this.serviceKey);
  }

  async listTaken(from: ISODate, to: ISODate): Promise<TakenSlot[]> {
    const q = new URLSearchParams({ select: "service_date,slot_id", status: "eq.confirmed" });
    q.append("service_date", `gte.${from}`);
    q.append("service_date", `lte.${to}`);
    const res = await fetch(`${this.url}/rest/v1/bookings?${q}`, {
      headers: this.headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Supabase listTaken failed (${res.status})`);
    const rows = (await res.json()) as Array<Pick<Row, "service_date" | "slot_id">>;
    return rows.map((r) => ({ date: r.service_date, slotId: r.slot_id }));
  }

  // The database applies the lower of `maxPerDay` and booking_settings.max_jobs_per_day, and uses
  // up a referral code in the same transaction (db/migrations/004_referrals.sql).
  async create(input: NewBooking, maxPerDay: number, opts: { referralCode?: string } = {}): Promise<CreateResult> {
    const res = await fetch(`${this.url}/rest/v1/rpc/create_booking`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        p: { ...toRow(input), max_jobs_per_day: maxPerDay, ...(opts.referralCode ? { referral_code: opts.referralCode } : {}) },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Supabase create_booking failed (${res.status})`);
    const out = (await res.json()) as { ok: boolean; reason?: string; booking?: Row; duplicate?: boolean };
    if (out.ok && out.booking) return { ok: true, booking: fromRow(out.booking), duplicate: out.duplicate };
    const reasons = ["day_full", "referral_invalid", "referral_used"] as const;
    const reason = reasons.find((r) => r === out.reason) ?? "slot_taken";
    return { ok: false, reason };
  }

  async findBooking(ref: string): Promise<BookingRecord | null> {
    const q = new URLSearchParams({ select: "*", ref: `eq.${ref}` });
    const res = await fetch(`${this.url}/rest/v1/bookings?${q}`, {
      headers: this.headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Supabase findBooking failed (${res.status})`);
    const rows = (await res.json()) as Row[];
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async updateBooking(ref: string, patch: { priceDollars: number; notes: string }): Promise<BookingRecord | null> {
    const q = new URLSearchParams({ ref: `eq.${ref}`, status: "eq.confirmed" });
    const res = await fetch(`${this.url}/rest/v1/bookings?${q}`, {
      method: "PATCH",
      headers: { ...this.headers(), Prefer: "return=representation" },
      body: JSON.stringify({ price_dollars: patch.priceDollars, notes: patch.notes }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Supabase updateBooking failed (${res.status})`);
    const rows = (await res.json()) as Row[];
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async findReferralByBooking(ref: string): Promise<ReferralRecord | null> {
    const q = new URLSearchParams({ select: "*", booking_ref: `eq.${ref}` });
    const res = await fetch(`${this.url}/rest/v1/referrals?${q}`, {
      headers: this.headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Supabase findReferralByBooking failed (${res.status})`);
    const rows = (await res.json()) as ReferralRow[];
    return rows[0] ? fromReferralRow(rows[0]) : null;
  }

  async createReferral(input: NewReferral): Promise<ReferralRecord> {
    // The same referral sent again (say, after the email to Jimmy failed) updates the unused one.
    const q = new URLSearchParams({ select: "*", referrer_phone: `eq.${input.referrerPhone}`, booking_ref: "is.null" });
    const found = await fetch(`${this.url}/rest/v1/referrals?${q}`, {
      headers: this.headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!found.ok) throw new Error(`Supabase createReferral lookup failed (${found.status})`);
    const again = ((await found.json()) as ReferralRow[]).map(fromReferralRow).find((r) => sameReferral(r, input));
    if (again) {
      const res = await fetch(`${this.url}/rest/v1/referrals?${new URLSearchParams({ code: `eq.${again.code}` })}`, {
        method: "PATCH",
        headers: { ...this.headers(), Prefer: "return=representation" },
        body: JSON.stringify((({ code: _c, ...row }) => row)(toReferralRow(input, again.code))),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Supabase createReferral update failed (${res.status})`);
      const rows = (await res.json()) as ReferralRow[];
      return fromReferralRow(rows[0]!);
    }
    // A code clash is about one in 650 billion, but try again rather than fail if it happens.
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${this.url}/rest/v1/referrals`, {
        method: "POST",
        headers: { ...this.headers(), Prefer: "return=representation" },
        body: JSON.stringify(toReferralRow(input, makeReferralCode())),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 409) continue;
      if (!res.ok) throw new Error(`Supabase createReferral failed (${res.status})`);
      const rows = (await res.json()) as ReferralRow[];
      return fromReferralRow(rows[0]!);
    }
    throw new Error("Supabase createReferral: no free code");
  }

  async findReferral(code: string): Promise<ReferralRecord | null> {
    const q = new URLSearchParams({ select: "*", code: `eq.${code}` });
    const res = await fetch(`${this.url}/rest/v1/referrals?${q}`, {
      headers: this.headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Supabase findReferral failed (${res.status})`);
    const rows = (await res.json()) as ReferralRow[];
    return rows[0] ? fromReferralRow(rows[0]) : null;
  }
}
