import type { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as bookingPost } from "@/app/api/bookings/route";
import { POST as notifyTestPost } from "@/app/api/notify-test/route";
import { POST as planPost } from "@/app/api/plan-requests/route";
import { POST as referralPost } from "@/app/api/referrals/route";
import { bookingRules } from "@/content/booking";
import { site } from "@/content/site";
import { today } from "@/lib/booking/service";
import { resetBookingStore } from "@/lib/booking/store";
import { formSubmitEnabled } from "@/lib/notify/formsubmit";
import { sendNotice, type Notice } from "@/lib/notify/notice";
import { resetRateLimits } from "@/lib/rateLimit";
import { firstBookable, freshDatabase, postgrestShim } from "./helpers";

// Jimmy's notifications go through FormSubmit, sent by the visitor's browser. These check that:
// - the server only hands out a notice for a request it accepted (a saved booking, a valid plan request),
// - the notice carries everything Jimmy needs, addressed to the email published on the site,
// - notices are off unless FORMSUBMIT_ENABLED=true, and never on previews or the demo store,
// - the server itself never contacts FormSubmit, and the booking database still enforces the daily cap,
// - the browser only reports success when FormSubmit confirms it.
// No test reaches the real FormSubmit: every fetch is stubbed.

const JIMMY_ENDPOINT = "https://formsubmit.co/ajax/jimmyesmond@keystonegutterglow.com";

let db: PGlite;
beforeAll(async () => {
  db = await freshDatabase();
});
afterAll(async () => {
  await db.close();
});

/** Every URL the server fetched during a test. */
let fetched: string[];

beforeEach(() => {
  fetched = [];
  vi.stubEnv("BOOKING_STORE", "supabase");
  vi.stubEnv("SUPABASE_URL", "http://db.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  vi.stubEnv("FORMSUBMIT_ENABLED", "true");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("SITE_ENV", "");
  const shim = postgrestShim(db);
  vi.stubGlobal("fetch", (async (input: string | URL | Request, init?: RequestInit) => {
    fetched.push(String(input));
    if (!String(input).startsWith("http://db.test/")) throw new Error(`unexpected request to ${String(input)}`);
    return shim(input, init);
  }) as typeof fetch);
  resetBookingStore();
  resetRateLimits();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetBookingStore();
});

const customer = {
  name: "Pat Example",
  email: "pat@example.com",
  phone: "(215) 555-0100",
  street: "1 Test Ln",
  city: "Jamison",
  zip: "18929",
};

let ip = 0;
async function book(over: Record<string, unknown> = {}) {
  const res = await bookingPost(
    new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": `10.9.0.${++ip % 250}` },
      body: JSON.stringify({
        ...customer,
        packageId: "two-story",
        rinse: true,
        date: firstBookable(today(), bookingRules, ip % 40),
        notes: "Side gate is unlocked",
        ...over,
      }),
    }),
  );
  return { status: res.status, body: (await res.json()) as { booking: { ref: string; date: string }; notice: Notice | null } };
}

describe("a booking's notice", () => {
  it("carries everything Jimmy needs, addressed to the email on the site", async () => {
    expect(site.email).toBe("jimmyesmond@keystonegutterglow.com");
    const { status, body } = await book({ planFrequencyId: "6-months", planTerms: true });
    expect(status).toBe(201);

    const notice = body.notice!;
    expect(notice.endpoint).toBe(JIMMY_ENDPOINT);
    const f = notice.fields;
    expect(f._subject).toContain(`New booking ${body.booking.ref}`);
    expect(f._replyto).toBe("pat@example.com");
    expect(f.email).toBe("pat@example.com");
    expect(f._template).toBe("table");
    expect(f._honey).toBe("");
    expect(f.Booking).toContain(body.booking.ref);
    expect(f.Address).toBe("1 Test Ln, Jamison, PA 18929");
    expect(f.House).toBe("Two-story, with a rinse");
    // Two-story with a rinse is $254; on a plan it's 10% off, rounded down, and the year is 2 cleanings.
    expect(f.Price).toBe("$228 a cleaning (plan price, 10% off $254). Year total $456, invoiced up front after this first cleaning");
    expect(f.Name).toBe("Pat Example");
    expect(f.Phone).toBe("(215) 555-0100");
    expect(f["Recurring plan"]).toContain("Every 6 months");
    expect(f["Recurring plan"]).toContain("Agreed to the Recurring Plan Terms (version");
    expect(f["Recurring plan"]).toContain("10% off every cleaning, the year paid up front after the first cleaning");
    expect(f["Additional information"]).toBe("Side gate is unlocked");
  });

  it("on a referral, saves it, gives the friend a one-time link, and tells Jimmy who he owes", async () => {
    // 1. The referral: saved in the database, and Jimmy's email has the friend's personal link.
    const sent = await referralPost(
      new Request("http://localhost/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": `10.9.2.${++ip % 250}` },
        body: JSON.stringify({
          name: "Pat Neighbor",
          phone: "2155550123",
          reward: "plan",
          friendName: "Pat Example",
          friendPhone: "2155550100",
          consent: true,
        }),
      }),
    );
    expect(sent.status).toBe(201);
    const { notice, code } = (await sent.json()) as { notice: Notice; code?: string };
    expect(code).toBeUndefined(); // the referrer never sees the friend's code
    const link = notice.fields.Referral!.match(/https?:\/\/\S+\/referred\/([A-Z0-9]{8})$/);
    expect(link).not.toBeNull();
    const friendCode = link![1]!;
    expect(notice.fields.Code).toContain(friendCode);
    const saved = await db.query<{ reward: string; booking_ref: string | null }>("select reward, booking_ref from referrals where code = $1", [friendCode]);
    expect(saved.rows).toEqual([{ reward: "plan", booking_ref: null }]);

    // 2. The friend books with the code: $30 off the first cleaning, and the code is used up.
    const { status, body } = await book({ planFrequencyId: "6-months", planTerms: true, referralCode: friendCode.toLowerCase() });
    expect(status).toBe(201);
    const f = body.notice!.fields;
    expect(f.Price).toBe(
      "$228 a cleaning (plan price, 10% off $254). Year total $426, invoiced up front after this first cleaning, after the $30 referral discount",
    );
    expect(f.Referral).toBe(
      `Referred by Pat Neighbor (code ${friendCode}): $30 off this cleaning. Pat Neighbor chose $50 off the first year of a recurring plan, due once this house is fully cleaned.`,
    );
    const { rows } = await db.query<{ price_dollars: number; notes: string }>("select price_dollars, notes from public.bookings where ref = $1", [
      body.booking.ref,
    ]);
    expect(rows[0]!.price_dollars).toBe(198);
    expect(rows[0]!.notes).toMatch(new RegExp(`^Referral ${friendCode}: \\$30 off this cleaning \\(regular \\$228\\), referred by Pat Neighbor, who chose \\$50 off the first year of a recurring plan\\.`));
    const used = await db.query<{ booking_ref: string }>("select booking_ref from referrals where code = $1", [friendCode]);
    expect(used.rows[0]!.booking_ref).toBe(body.booking.ref);

    // 3. The same link again: refused, and nothing booked.
    const again = await book({ referralCode: friendCode });
    expect(again.status).toBe(410);
    expect((again.body as unknown as { error: string }).error).toMatch(/already been used/);

    // 4. A made-up code: refused. No code: the regular price.
    expect((await book({ referralCode: "ZZZZZZZZ" })).status).toBe(410);
    expect((await book({ referralCode: "nope" })).status).toBe(400);
    expect((await book({ referredBy: "Anyone" })).body.notice!.fields.Price).toBe("$254, invoiced after the job");
  });

  it("gives the regular price when there's no plan", async () => {
    const { body } = await book();
    expect(body.notice!.fields.Price).toBe("$254, invoiced after the job");
    expect(body.notice!.fields["Recurring plan"]).toBeUndefined();
  });

  it("is only handed out after the booking is saved, and the server never contacts FormSubmit", async () => {
    const { body } = await book();
    const { rows } = await db.query("select ref from public.bookings where ref = $1", [body.booking.ref]);
    expect(rows).toHaveLength(1);
    expect(fetched.length).toBeGreaterThan(0);
    expect(fetched.every((u) => u.startsWith("http://db.test/"))).toBe(true);
  });

  it("comes back with a repeated request, whose first answer may have been lost", async () => {
    const key = "repeat-key-123";
    const first = await book({ idempotencyKey: key });
    const again = await book({ idempotencyKey: key, date: first.body.booking.date });
    expect(again.body.booking.ref).toBe(first.body.booking.ref);
    expect(again.body.notice).toEqual(first.body.notice);
  });

  it("leaves the four-a-day limit to the database: the fifth booking that day is refused, with no notice", async () => {
    expect(bookingRules.maxJobsPerDay).toBe(4);
    const date = firstBookable(today(), bookingRules, 45);
    for (let i = 0; i < 4; i++) {
      const { status, body } = await book({ date });
      expect(status).toBe(201);
      expect(body.notice).not.toBeNull();
    }
    const fifth = await book({ date });
    expect(fifth.status).toBe(409);
    expect((fifth.body as unknown as { code: string }).code).toBe("day_full");
    expect(fifth.body.notice).toBeUndefined();
    const { rows } = await db.query("select ref from public.bookings where service_date = $1", [date]);
    expect(rows).toHaveLength(4);
  });

  it("is off unless FORMSUBMIT_ENABLED is exactly true, and the booking still works", async () => {
    for (const value of ["", "false", "1", "TRUE"]) {
      vi.stubEnv("FORMSUBMIT_ENABLED", value);
      const { status, body } = await book();
      expect(status).toBe(201);
      expect(body.notice).toBeNull();
    }
  });
});

describe("when notices are allowed", () => {
  it("never on a Vercel preview or the demo store, even with the switch on", () => {
    const real = { FORMSUBMIT_ENABLED: "true", BOOKING_STORE: "supabase", SUPABASE_URL: "http://db.test", SUPABASE_SERVICE_ROLE_KEY: "k" };
    expect(formSubmitEnabled(real)).toBe(true);
    expect(formSubmitEnabled({ ...real, VERCEL_ENV: "production" })).toBe(true);
    expect(formSubmitEnabled({ ...real, VERCEL_ENV: "preview" })).toBe(false);
    // Off Vercel: the live site emails, a test copy marked SITE_ENV=preview never does
    expect(formSubmitEnabled({ ...real, SITE_ENV: "production" })).toBe(true);
    expect(formSubmitEnabled({ ...real, SITE_ENV: "preview" })).toBe(false);
    expect(formSubmitEnabled({ FORMSUBMIT_ENABLED: "true", NODE_ENV: "development" })).toBe(false);
    expect(formSubmitEnabled({ FORMSUBMIT_ENABLED: "true", NODE_ENV: "production", BOOKING_DEMO_MODE: "true" })).toBe(false);
    expect(formSubmitEnabled({ ...real, FORMSUBMIT_ENABLED: undefined })).toBe(false);
  });
});

describe("a recurring-plan request", () => {
  const post = (body: unknown) =>
    planPost(
      new Request("http://localhost/api/plan-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": `10.9.1.${++ip % 250}` },
        body: JSON.stringify(body),
      }),
    );
  const valid = { ...customer, frequencyId: "6-months", notes: "Enter through the gate", planTerms: true };

  it("is checked by the server, which hands back Jimmy's notice without sending anything itself", async () => {
    const res = await post(valid);
    expect(res.status).toBe(201);
    const { notice } = (await res.json()) as { notice: Notice };
    expect(notice.endpoint).toBe(JIMMY_ENDPOINT);
    expect(notice.fields._subject).toBe("Recurring plan request: Every 6 months, Jamison");
    expect(notice.fields["How often"]).toBe("Every 6 months");
    expect(notice.fields.Request).toContain("Agreed to the Recurring Plan Terms (version");
    expect(notice.fields.Request).toContain("10% off every cleaning");
    expect(notice.fields.Phone).toBe("(215) 555-0100");
    expect(notice.fields.email).toBe("pat@example.com");
    expect(notice.fields["Additional information"]).toBe("Enter through the gate");
    expect(fetched).toEqual([]);
  });

  it("is refused on a real deployment with notices off, rather than lost", async () => {
    vi.stubEnv("FORMSUBMIT_ENABLED", "");
    expect((await post(valid)).status).toBe(503);
  });

  it("hands out nothing for bad input or a bot", async () => {
    const bad = await post({ ...valid, email: "nope" });
    expect(bad.status).toBe(400);
    const bot = await post({ ...valid, company: "spam" });
    expect(bot.status).toBe(201);
    expect((await bot.json()).notice).toBeUndefined();
  });
});

describe("/api/notify-test", () => {
  const post = () => notifyTestPost(new Request("http://localhost/api/notify-test", { method: "POST", headers: { "x-forwarded-for": "10.9.2.1" } }));

  it("is switched off unless NOTIFY_TEST_ENABLED is true", async () => {
    expect((await post()).status).toBe(404);
    vi.stubEnv("NOTIFY_TEST_ENABLED", "yes");
    expect((await post()).status).toBe(404);
  });

  it("hands out a clearly marked test notice when notices are on", async () => {
    vi.stubEnv("NOTIFY_TEST_ENABLED", "true");
    const res = await post();
    expect(res.status).toBe(201);
    const { notice } = (await res.json()) as { notice: Notice };
    expect(notice.endpoint).toBe(JIMMY_ENDPOINT);
    expect(notice.fields._subject).toMatch(/^Test:/);
  });

  it("refuses when they're off, and limits how often it can be used", async () => {
    vi.stubEnv("NOTIFY_TEST_ENABLED", "true");
    vi.stubEnv("FORMSUBMIT_ENABLED", "");
    expect((await post()).status).toBe(409);
    vi.stubEnv("FORMSUBMIT_ENABLED", "true");
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await post()).status);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe("sending a notice from the browser", () => {
  const notice: Notice = { endpoint: JIMMY_ENDPOINT, fields: { _subject: "New booking KGG-TEST", Name: "Pat", email: "pat@example.com" } };
  const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

  it("posts the fields to FormSubmit's AJAX endpoint as a simple form request", async () => {
    const f = answer({ success: "true", message: "The form was submitted successfully." });
    vi.stubGlobal("fetch", f);
    expect(await sendNotice(notice)).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(JIMMY_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(new Headers(init.headers).get("Accept")).toBe("application/json");
    const body = init.body as URLSearchParams;
    expect(body.get("_subject")).toBe("New booking KGG-TEST");
    expect(body.get("email")).toBe("pat@example.com");
  });

  it("recognizes a form that still needs activating, without calling it a success", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      answer({ success: "false", message: "This form needs Activation. We've sent you an email containing an 'Activate Form' link." }),
    );
    expect(await sendNotice(notice)).toMatchObject({ ok: false, reason: "activation" });
  });

  it("treats anything but a confirmed success as a failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", answer({ success: "false", message: "Something else" }));
    expect(await sendNotice(notice)).toMatchObject({ ok: false, reason: "refused" });
    vi.stubGlobal("fetch", answer({ success: "true" }, 500));
    expect(await sendNotice(notice)).toMatchObject({ ok: false, reason: "refused" });
    vi.stubGlobal("fetch", answer("<html>Bad gateway</html>", 502));
    expect(await sendNotice(notice)).toMatchObject({ ok: false, reason: "refused" });
    vi.stubGlobal("fetch", answer({}));
    expect(await sendNotice(notice)).toMatchObject({ ok: false, reason: "refused" });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    expect(await sendNotice(notice)).toEqual({ ok: false, reason: "network" });
  });

  it("won't post customer details anywhere but FormSubmit", async () => {
    const f = answer({ success: "true" });
    vi.stubGlobal("fetch", f);
    expect(await sendNotice({ ...notice, endpoint: "https://evil.example/collect" })).toMatchObject({ ok: false, reason: "refused" });
    expect(f).not.toHaveBeenCalled();
  });
});
