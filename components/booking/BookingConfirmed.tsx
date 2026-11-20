"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { site } from "@/content/site";
import { reportBookingConversion } from "@/lib/ads";
import { sendNotice } from "@/lib/notify/notice";
import styles from "./Booking.module.css";
import { deliveryAfter, loadConfirmation, saveConfirmation, type StoredConfirmation } from "./confirmation";
import { Done } from "./Done";

// /booking-confirmed: where the booking form sends people once their booking is saved. It shows the
// confirmation from this browser tab and reports the booking to Google Ads as a conversion, once.
// Opened any other way (a bookmark, a shared link), there's no booking to show and nothing is reported.

export function BookingConfirmed({ planRequests, measure }: { planRequests: boolean; measure: boolean }) {
  // undefined until this tab's storage has been read
  const [saved, setSaved] = useState<StoredConfirmation | null | undefined>(undefined);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage only exists in the browser
    setSaved(loadConfirmation());
  }, []);

  const ref = saved?.booking.ref;
  useEffect(() => {
    if (!saved) return;
    headingRef.current?.focus();
    if (measure && !saved.booking.demo) reportBookingConversion(saved.booking.ref);
    // Once per booking shown, not on every state change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, measure]);

  async function resend() {
    if (!saved || saved.delivery.status !== "failed") return;
    const { notice } = saved.delivery;
    setSaved({ ...saved, delivery: { status: "retrying", notice } });
    const sent = await sendNotice(notice);
    const next: StoredConfirmation = { ...saved, delivery: deliveryAfter(sent, notice) };
    saveConfirmation(next);
    setSaved(next);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  if (saved === undefined) {
    return (
      <div className={`${styles.app} ${styles.done}`} aria-busy="true">
        <p className={styles.doneRef}>
          <span className="skel-text">Booking KGG-XXXXX</span>
        </p>
        <p className={styles.doneTitle}>
          <span className="skel-text">You&rsquo;re on the schedule.</span>
        </p>
      </div>
    );
  }

  if (saved === null) {
    return (
      <div className={`${styles.app} ${styles.done}`}>
        <h1 ref={headingRef} tabIndex={-1} className={styles.doneTitle}>
          No booking to show here.
        </h1>
        <p className={styles.doneFoot}>
          This page shows your booking right after you make it. To book a cleaning, pick a day on the home page, or call or text{" "}
          <a href={site.phone.href}>{site.phone.display}</a>.
        </p>
        <div className={styles.doneActions} style={{ marginTop: 20 }}>
          <Link href="/#book" className="btn btn--sky">
            Book a cleaning
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Done
      booking={saved.booking}
      delivery={saved.delivery}
      onResend={resend}
      name={saved.name}
      phone={saved.phone}
      anotherHref="/#book"
      headingRef={headingRef}
      headingLevel="h1"
      planRequests={planRequests}
      onPlanAdded={(update) => {
        // The booking is on the plan now: show its plan price and plan, here and after a reload.
        const next: StoredConfirmation = {
          ...saved,
          booking: { ...saved.booking, priceDollars: update.priceDollars, planLabel: update.planLabel, planFrequencyId: update.planFrequencyId },
        };
        saveConfirmation(next);
        setSaved(next);
      }}
    />
  );
}
