import { stateForZip } from "@/content/area";
import { planAnnualTotal, planRules, type PlanFrequency } from "@/content/plans";
import { getPackage, totalFor } from "@/content/pricing";
import { referralPaths, referralRewards, referralRules, type ReferralReward } from "@/content/referral";
import { site } from "@/content/site";
import type { BookingRules } from "@/content/booking";
import { formatLong } from "@/lib/booking/dates";
import type { BookingRecord } from "@/lib/booking/types";
import { formatPhone } from "@/lib/booking/validate";
import { isDemoStorage } from "@/lib/storage";
import { deployEnv } from "@/lib/deploy";
import { publicUrl } from "@/lib/env";
import { checkLink } from "./check";
import type { CleanReferralRequest } from "@/lib/referral/validate";
import { FORMSUBMIT_AJAX, type Notice } from "./notice";

// Writes the FormSubmit notices for Jimmy. Server only: the API routes hand the result to the
// browser, which sends it (lib/notify/notice.ts). No API key, account or domain setup is involved.
//
//   FORMSUBMIT_ENABLED=true   turns notices on. OFF by default, and never on for preview copies
//                             (Vercel previews, or SITE_ENV=preview on another host) or the demo
//                             store, whose bookings aren't real.
//
// Until Jimmy clicks "Activate Form" in FormSubmit's first email, every submission sends him
// another activation email instead of the notice. So only switch this on once he expects that
// email, and activate it straight away (README, "Notifications to Jimmy").
//
// Everything goes to the address published on the site, content/site.ts `email`.

type Env = Record<string, string | undefined>;

export function formSubmitEnabled(env: Env = process.env): boolean {
  if (env.FORMSUBMIT_ENABLED !== "true") return false;
  if (deployEnv(env) === "preview") return false;
  return !isDemoStorage(env);
}

/**
 * /notify-test sends Jimmy a test email. It's off unless NOTIFY_TEST_ENABLED=true, so a stranger
 * can't use it to fill his inbox. Turn it on in Vercel when you want to test, then off again.
 */
export function notifyTestEnabled(env: Env = process.env): boolean {
  return env.NOTIFY_TEST_ENABLED === "true";
}

export function formSubmitEndpoint(): string {
  return `${FORMSUBMIT_AJAX}${site.email}`;
}

/** FormSubmit settings shared by every notice. */
function settings(subject: string, customerEmail?: string): Record<string, string> {
  return {
    _subject: subject,
    // Reply goes straight to the customer, when there's an email to reply to.
    ...(customerEmail ? { _replyto: customerEmail } : {}),
    _template: "table",
    // AJAX submissions can't show FormSubmit's reCAPTCHA. Our own checks run first (see README).
    _captcha: "false",
    // FormSubmit's honeypot. Always empty from us; anything that fills it gets silently dropped.
    _honey: "",
  };
}

function compact(fields: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).filter((e): e is [string, string] => !!e[1]));
}

/** The notice for a booking the database has accepted. */
export function bookingNotice(
  b: BookingRecord,
  rules: BookingRules,
  extra: {
    plan?: Pick<PlanFrequency, "id" | "label">;
    notes?: string;
    referral?: { by: string; off: number; code: string; reward: ReferralReward };
  } = {},
): Notice {
  const pkg = getPackage(b.packageId);
  const from = b.priceIsEstimate ? "Starting at " : "";
  const regular = pkg ? totalFor(pkg, b.rinse) : null;
  // The saved price is this cleaning's, after any referral discount.
  const off = extra.referral?.off ?? 0;
  const perCleaning = b.priceDollars + off;
  const annual = extra.plan ? (planAnnualTotal(perCleaning, extra.plan.id) ?? 0) - off : null;
  const when =
    rules.scheduleMode === "day-only"
      ? formatLong(b.date)
      : `${formatLong(b.date)}, ${rules.slots.find((s) => s.id === b.slotId)?.label ?? b.slotId}`;
  return {
    endpoint: formSubmitEndpoint(),
    fields: {
      ...settings(`New booking ${b.ref}: ${when}`, b.customer.email),
      ...compact({
        Booking: `${b.ref} (saved in the booking database)`,
        "Check it's real": checkLink("booking", b.ref),
        When: when,
        Address: `${b.address.street}, ${b.address.city}, ${stateForZip(b.address.zip)} ${b.address.zip}`,
        House: `${pkg?.name ?? b.packageId}${b.rinse ? ", with a rinse" : ""}`,
        Price: extra.plan
          ? `${from}$${perCleaning} a cleaning (plan price, ${planRules.discountPercent}% off${regular !== null ? ` $${regular}` : ""}). ` +
            `Year total ${from.toLowerCase()}$${annual}, invoiced up front after this first cleaning` +
            (off ? `, after the $${off} referral discount` : "")
          : off
            ? `${from}$${b.priceDollars} after the $${off} referral discount (regular ${from.toLowerCase()}$${perCleaning}), invoiced after the job`
            : `${from}$${b.priceDollars}, invoiced after the job`,
        Referral: extra.referral
          ? `Referred by ${extra.referral.by} (code ${extra.referral.code}): $${off} off this cleaning. ` +
            `${extra.referral.by} chose ${referralRewards[extra.referral.reward].label}, due once this house is fully cleaned.`
          : undefined,
        "Recurring plan": extra.plan
          ? `${extra.plan.label}. Agreed to the Recurring Plan Terms (version ${planRules.termsVersion}): ${planRules.discountPercent}% off every cleaning, the year paid up front after the first cleaning, renews yearly until cancelled, no fee to cancel, no refunds of payments already made.`
          : undefined,
        Name: b.customer.name,
        Phone: formatPhone(b.customer.phone),
        // Lower-case "email" is the field FormSubmit reads for Reply-To.
        email: b.customer.email,
        "Additional information": extra.notes,
      }),
    },
  };
}

export interface PlanNoticeInput {
  /** Set when the plan was added to a booking: what changed on it */
  booking?: { ref: string; date: string; priceBefore: number; priceNow: number; firstYear: number | null; estimate: boolean };
  frequency: string;
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
  notes?: string;
}

/** The notice for a recurring-plan request. The email is the only record of it. */
export function planRequestNotice(r: PlanNoticeInput): Notice {
  return {
    endpoint: formSubmitEndpoint(),
    fields: {
      ...settings(
        r.booking ? `Recurring plan added to booking ${r.booking.ref}: ${r.frequency}, ${r.city}` : `Recurring plan request: ${r.frequency}, ${r.city}`,
        r.email,
      ),
      ...compact({
        Request: `Recurring plan, ${planRules.discountPercent}% off every cleaning. Agreed to the Recurring Plan Terms (version ${planRules.termsVersion}). Confirm the dates with the customer.`,
        Booking: r.booking
          ? `${r.booking.ref}, ${formatLong(r.booking.date)}: the plan starts with this cleaning. Its price is now ${r.booking.estimate ? "from " : ""}$${r.booking.priceNow} (was $${r.booking.priceBefore}), already changed in the booking database.` +
            (r.booking.firstYear !== null ? ` The year, ${r.booking.estimate ? "from " : ""}$${r.booking.firstYear}, is invoiced up front after this cleaning.` : "")
          : undefined,
        "Check it's real": r.booking ? checkLink("booking", r.booking.ref) : undefined,
        "How often": r.frequency,
        Address: `${r.street}, ${r.city}, ${stateForZip(r.zip)} ${r.zip}`,
        Name: r.name,
        Phone: formatPhone(r.phone),
        email: r.email,
        "Additional information": r.notes,
      }),
    },
  };
}

/** The friend's personal booking page, on the live site's address. */
export function referralLink(code: string): string {
  return `${publicUrl}${referralPaths.friend}/${code}`;
}

/** The notice for a referral from /refer. The referral itself is saved in the database, with its code. */
export function referralNotice(r: CleanReferralRequest, code: string): Notice {
  const first = r.friendName.split(/\s+/)[0];
  const reward =
    r.reward === "plan"
      ? `${referralRewards.plan.label} for ${r.name}. Call them to set it up.`
      : `${referralRewards.cash.label} for ${r.name}.`;
  return {
    endpoint: formSubmitEndpoint(),
    fields: {
      ...settings(`New referral: ${r.friendName}, from ${r.name}`, r.email || undefined),
      ...compact({
        Referral: `${r.name} referred ${r.friendName}. Get in touch with ${first} and send them their personal link, which takes $${referralRules.friendDiscount} off one cleaning: ${referralLink(code)}`,
        Code: `${code} (works for one booking; the referrals table in Supabase shows when it's used)`,
        "Check it's real": checkLink("referral", code),
        "Thank-you": `${reward} Only once ${first} has booked and their house is fully cleaned.`,
        "Referred by": r.name,
        "Their phone": formatPhone(r.phone),
        email: r.email || undefined,
        "Friend's name": r.friendName,
        "Friend's phone": r.friendPhone ? formatPhone(r.friendPhone) : undefined,
        "Friend's email": r.friendEmail || undefined,
        "Friend's town": r.friendTown || undefined,
        "Additional information": r.notes || undefined,
      }),
    },
  };
}

/** The message sent from /notify-test, to activate FormSubmit and check it still works. */
export function testNotice(sentAt: string): Notice {
  return {
    endpoint: formSubmitEndpoint(),
    fields: {
      _subject: "Test: Keystone Gutter Glow website notifications",
      _template: "table",
      _captcha: "false",
      _honey: "",
      Test: "This is a test from the Keystone Gutter Glow website. Bookings and recurring-plan requests will arrive like this.",
      Sent: sentAt,
    },
  };
}
