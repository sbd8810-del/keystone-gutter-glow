"use client";

import Link from "next/link";
import { legalPaths } from "@/content/legalPaths";
import { getPlanFrequency, planAnnualTotal, planFrequencies, planRules } from "@/content/plans";
import { PlanDialog, type PlanAdded } from "@/components/plan/PlanDialog";
import { stateForZip } from "@/content/area";
import { bookingRules } from "@/content/booking";
import { getPackage, totalFor } from "@/content/pricing";
import { referralPaths, referralRules } from "@/content/referral";
import { site } from "@/content/site";
import { formatLong } from "@/lib/booking/dates";
import type { Notice } from "@/lib/notify/notice";
import type { Confirmation } from "./api";
import styles from "./Booking.module.css";
import { buildIcs, downloadIcs } from "./ics";

// The booking confirmation card, shown on /booking-confirmed after a successful booking.

const dayOnly = bookingRules.scheduleMode === "day-only";
const slotLabel = (id: string | null) => bookingRules.slots.find((s) => s.id === id)?.label ?? "";

/**
 * Whether Jimmy has been told about the booking. The booking is saved before anything is sent,
 * so a failed send never loses it: the customer can send again, or call with the reference.
 *   off       notifications aren't on for this deployment, so there's nothing to send
 *   sent      FormSubmit confirmed it
 *   held      FormSubmit kept it until Jimmy activates the form for this address, then delivers it
 *             (lib/notify/notice.ts). Shown as booked, without "Jimmy has your booking details".
 *   failed    FormSubmit didn't take it (down, refused, offline)
 *   retrying  sending again after a failure
 */
export type Delivery = { status: "off" } | { status: "sent" } | { status: "held" } | { status: "failed" | "retrying"; notice: Notice };

export function DemoNote({ done }: { done?: boolean }) {
  return (
    <p className={styles.demoNote}>
      {done
        ? "Demo only. This isn't a real booking, and nobody was told about it."
        : `Demo schedule. Some days are filled with sample bookings, and nothing you book here is real. To book, call or text ${site.phone.display}.`}
    </p>
  );
}

export function Done({
  booking,
  delivery,
  onResend,
  name,
  phone,
  anotherHref,
  headingRef,
  headingLevel = "h3",
  planRequests,
  onPlanAdded,
}: {
  booking: Confirmation;
  delivery: Delivery;
  onResend: () => void;
  name: string;
  phone: string;
  /** Where "Book another house" goes */
  anotherHref: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  /** h1 when the confirmation is the page */
  headingLevel?: "h1" | "h3";
  planRequests: boolean;
  /** "Make it recurring" put this booking on a plan: its new price and plan */
  onPlanAdded?: (update: PlanAdded) => void;
}) {
  const pkg = getPackage(booking.packageId);
  // A plan booking's price is already the plan price (10% off). Older saved confirmations carry only the label.
  const plan = booking.planLabel
    ? (getPlanFrequency(booking.planFrequencyId ?? "") ?? planFrequencies.find((f) => f.label === booking.planLabel))
    : undefined;
  const regular = pkg ? totalFor(pkg, booking.rinse) : null;
  // The saved price is this cleaning's, after any referral discount.
  const off = booking.referralOff ?? 0;
  const perCleaning = booking.priceDollars + off;
  const yearTotal = plan ? (planAnnualTotal(perCleaning, plan.id) ?? 0) - off : null;
  const from = booking.priceIsEstimate ? "from " : "";
  const address = `${booking.address.street}, ${booking.address.city}, ${stateForZip(booking.address.zip)} ${booking.address.zip}`;
  const unsent = delivery.status === "failed" || delivery.status === "retrying";
  const Heading = headingLevel;
  return (
    <div className={`${styles.app} ${styles.done}`}>
      {booking.demo && <DemoNote done />}
      <p className={styles.doneRef}>Booking {booking.ref}</p>
      <Heading ref={headingRef} tabIndex={-1} className={styles.doneTitle}>
        {booking.demo
          ? "That\u2019s how booking works."
          : unsent
            ? "Your day is held, but Jimmy hasn\u2019t been told yet."
            : "You\u2019re on the schedule."}
      </Heading>
      {unsent && (
        <div className={styles.unsent} role="alert">
          <p>
            Your booking is saved, so nobody else can take your spot. Sending the details to Jimmy didn&rsquo;t go through.
          </p>
          <button
            type="button"
            className="btn btn--sky"
            onClick={onResend}
            disabled={delivery.status === "retrying"}
            aria-busy={delivery.status === "retrying"}
          >
            {delivery.status === "retrying" ? "Sending it to Jimmy…" : "Try sending again"}
          </button>
          <p className={styles.unsentCall}>
            Or call or text <a href={site.phone.href}>{site.phone.display}</a> and give him booking {booking.ref}.
          </p>
        </div>
      )}
      <p className={styles.doneWhen}>
        {formatLong(booking.date)}
        {!dayOnly && `, ${slotLabel(booking.slotId)}`}
        <br />
        <span>{address}</span>
      </p>
      <dl className={styles.doneFacts}>
        <div>
          <dt>House</dt>
          <dd>
            {pkg?.name}
            {booking.rinse ? ", with a rinse" : ""}
          </dd>
        </div>
        {plan && yearTotal !== null ? (
          <>
            <div>
              <dt>{booking.priceIsEstimate ? "Starting at" : "Plan price"}</dt>
              <dd>
                ${perCleaning} a cleaning, {planRules.discountPercent}% off
                {regular !== null && regular > perCleaning && ` $${regular}`}
              </dd>
            </div>
            {off > 0 && (
              <div>
                <dt>Referral</dt>
                <dd>${off} off this first cleaning</dd>
              </div>
            )}
            <div>
              <dt>This year</dt>
              <dd>
                {from}${yearTotal}, paid up front after this first cleaning
              </dd>
            </div>
          </>
        ) : (
          <div>
            <dt>{booking.priceIsEstimate ? "Starting at" : "Total"}</dt>
            <dd>
              ${booking.priceDollars}
              {off > 0 && ` after your $${off} referral discount`}, invoiced after
            </dd>
          </div>
        )}
      </dl>
      <h4 className={styles.nextTitle}>What happens now</h4>
      <ol className={styles.nextList}>
        {delivery.status === "sent" ? (
          <li>Jimmy has your booking details. Keep this reference number; he&rsquo;ll be in touch at {booking.email} if anything changes.</li>
        ) : (
          !booking.demo && <li>Keep this reference number. We&rsquo;ll be in touch at {booking.email} if anything changes.</li>
        )}
        <li>On the day, we clean. You don&rsquo;t need to be home if we can reach the gutters.</li>
        <li>Photos and the invoice come after.</li>
        {booking.planLabel && (
          <li>
            Your recurring plan: {booking.planLabel.toLowerCase()}, under the{" "}
            <Link href={legalPaths.planTerms} className="textlink">
              Recurring Plan Terms
            </Link>{" "}
            you agreed to. Every cleaning is {planRules.discountPercent}% off. You pay for the whole year up front
            {yearTotal !== null && ` (${from}$${yearTotal})`}, invoiced after this first cleaning. We text or email{" "}
            {planRules.noticeHours.join(" and ")} hours before each visit, and the plan renews every year until you cancel.
          </li>
        )}
      </ol>
      <div className={styles.doneActions}>
        <button
          type="button"
          className="btn btn--sky"
          onClick={() =>
            downloadIcs(
              `keystone-${booking.date}.ics`,
              buildIcs({ ref: booking.ref, date: booking.date, slotId: dayOnly ? null : booking.slotId, address }),
            )
          }
        >
          Add to my calendar
        </button>
        {!booking.planLabel && planRequests && (
          <PlanDialog
            className="btn"
            initial={{ ...booking.address, name, phone, email: booking.email }}
            price={{ regular: regular ?? perCleaning, isFrom: booking.priceIsEstimate }}
            booking={{ ref: booking.ref, date: booking.date }}
            onPlanAdded={onPlanAdded}
          >
            Make it recurring and save {planRules.discountPercent}%
          </PlanDialog>
        )}
        <Link href={anotherHref} className={styles.back}>
          Book another house
        </Link>
      </div>
      <p className={styles.doneFoot}>
        Need to change something? Call or text {site.phone.display}.{" "}
        <Link href={referralPaths.refer} className="textlink">
          Send a neighbor our way
        </Link>
        : they get ${referralRules.friendDiscount} off, and you get ${referralRules.cashReward} cash or ${referralRules.planCredit} off a plan&rsquo;s first year.
      </p>
    </div>
  );
}
