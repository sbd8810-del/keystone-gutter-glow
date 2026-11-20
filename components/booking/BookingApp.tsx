"use client";

import { useRouter } from "next/navigation";
import { cloneElement, useCallback, useEffect, useId, useRef, useState } from "react";
import { BOOK_EVENT, type BookIntent } from "@/components/BookLink";
import { PlanAgreement } from "@/components/plan/PlanAgreement";
import { House } from "@/components/pricing/Houses";
import { areaPlaces } from "@/content/area";
import { additionalInfo, bookingRules } from "@/content/booking";
import { legalPaths } from "@/content/legalPaths";
import { getPlanFrequency, planFrequencies, planRules, planSaving, recommendedPlan, recommendedWhy } from "@/content/plans";
import { getPackage, packages, rinse, type PackageId } from "@/content/pricing";
import { quoteFor } from "@/content/quote";
import { site } from "@/content/site";
import { addDays, addMonths, formatLong, formatShort, monthStart } from "@/lib/booking/dates";
import type { DayDetail, DaySummary } from "@/lib/booking/types";
import { formatPhone, PLAN_TERMS_ERROR, validateContact, type FieldErrors } from "@/lib/booking/validate";
import { sendNotice } from "@/lib/notify/notice";
import { fetchDay, fetchRange, submitBooking, type Meta } from "./api";
import styles from "./Booking.module.css";
import { Calendar } from "./Calendar";
import { CONFIRMED_PATH, deliveryAfter, saveConfirmation } from "./confirmation";
import { DemoNote, type Delivery } from "./Done";

type Step = 0 | 1 | 2 | 3;
const dayOnly = bookingRules.scheduleMode === "day-only";
const STEPS = ["House", dayOnly ? "Day" : "Day & time", "Address & contact", "Check & book"] as const;

interface Draft {
  packageId: PackageId | null;
  rinse: boolean;
  /** "" means just this once */
  plan: string;
  date: string | null;
  slotId: string | null;
  street: string;
  city: string;
  zip: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  company: string;
  /** Agreed to the Recurring Plan Terms. Cleared whenever the plan, house or rinse changes. */
  planTerms: boolean;
}

const EMPTY: Draft = {
  packageId: null,
  rinse: false,
  plan: "",
  date: null,
  slotId: null,
  street: "",
  city: "",
  zip: "",
  name: "",
  phone: "",
  email: "",
  notes: "",
  company: "",
  planTerms: false,
};

const slotLabel = (id: string | null) => bookingRules.slots.find((s) => s.id === id)?.label ?? "";


/** A friend's personal referral, checked by the server when /referred/<code> loads */
export interface ReferralLink {
  code: string;
  referrerName: string;
}

/**
 * The booking form. With `referral` it's the referral page's version (/referred/<code>): $30 off
 * the cleaning being booked. The code goes with the booking; the server checks it again and the
 * database uses it up, so it only works once.
 */
export function BookingApp({ referral }: { referral?: ReferralLink }) {
  const router = useRouter();
  const uid = useId();
  const [step, setStep] = useState<Step>(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  /** Set when a recurring-plan button sent the visitor here */
  const [planPicked, setPlanPicked] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** What the button says while it works: saving the booking, telling Jimmy, then opening the confirmation. */
  const [submitStage, setSubmitStage] = useState<"saving" | "notifying" | "opening">("saving");

  const [meta, setMeta] = useState<Meta | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [monthDays, setMonthDays] = useState<Map<string, DaySummary> | null>(null);
  const [day, setDay] = useState<DayDetail | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  // One key per attempt to book, so a retried request can't create a second booking.
  // The key goes with exactly one request: change anything (the day, the house, the address) and the
  // next try gets a new key, so a retry can't come back with an earlier booking for a different day.
  const attemptKey = useRef<{ key: string; fingerprint: string } | null>(null);
  // Until the customer picks a month, skip past any with nothing open (late in the month, say).
  const seekOpenMonth = useRef(true);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const timesRef = useRef<HTMLFieldSetElement>(null);
  const focusOnStep = useRef(false);

  // Editing a field clears its error, so a fixed field stops showing red straight away.
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    // The plan agreement covers the plan and price shown, so changing either needs a fresh tick.
    const resetsTerms = key === "plan" || key === "packageId" || key === "rinse";
    setDraft((d) => ({ ...d, [key]: value, ...(resetsTerms && d[key] !== value ? { planTerms: false } : {}) }));
    setErrors((e) => {
      const k = key as keyof FieldErrors;
      if (!e[k]) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });
  };

  const go = useCallback((next: Step) => {
    setBanner(null);
    focusOnStep.current = true;
    setStep(next);
  }, []);

  // After a step change, bring the new step's heading on screen (if it isn't) and focus it,
  // so keyboard and screen-reader users land at the start of the new step.
  useEffect(() => {
    if (!focusOnStep.current) return;
    focusOnStep.current = false;
    const el = headingRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 60 || top > window.innerHeight * 0.55) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }
    el.focus({ preventScroll: true });
  }, [step]);

  // Load the confirmation page ahead of time, so moving there after booking is instant.
  useEffect(() => {
    if (step === 3) router.prefetch(CONFIRMED_PATH);
  }, [step, router]);

  // ---- Preselection from links elsewhere on the page (pricing, hero "next opening") ----
  useEffect(() => {
    const onIntent = (e: Event) => {
      const intent = (e as CustomEvent<BookIntent>).detail ?? {};
      setDraft((d) => ({
        ...d,
        packageId: intent.packageId ?? d.packageId,
        date: intent.date ?? d.date,
        slotId: intent.date ? (intent.slotId ?? null) : d.slotId,
        plan: intent.plan ?? d.plan,
      }));
      if (intent.date) setMonth(monthStart(intent.date));
      // A plan button says so at the top of the form, where the page lands.
      if (intent.plan) setPlanPicked(true);
      // A link can preselect the house, day or plan, but booking always starts on the house step.
      if (intent.packageId || intent.date || intent.plan) go(0);
    };
    window.addEventListener(BOOK_EVENT, onIntent);
    return () => window.removeEventListener(BOOK_EVENT, onIntent);
  }, [go]);

  // ---- Availability: month view ----
  useEffect(() => {
    if (step !== 1) return;
    const ctrl = new AbortController();
    const load = async () => {
      try {
        setLoadError(false);
        let m = month;
        if (!m) {
          // First visit to this step: ask the server what "today" is in Bucks County.
          const first = await fetchRange(addDays(todayGuess(), 0), addDays(todayGuess(), 0), ctrl.signal);
          setMeta(first.meta);
          m = monthStart(draft.date ?? addDays(first.meta.today, first.meta.minLeadDays));
          setMonth(m);
          return;
        }
        setMonthDays(null);
        const last = addDays(addMonths(m, 1), -1);
        const res = await fetchRange(m, last, ctrl.signal);
        setMeta(res.meta);
        const horizonMonth = monthStart(addDays(res.meta.today, res.meta.horizonDays));
        if (seekOpenMonth.current && !draft.date && m < horizonMonth && !res.days.some((d) => d.status === "open")) {
          setMonth(addMonths(m, 1));
          return;
        }
        seekOpenMonth.current = false;
        setMonthDays(new Map(res.days.map((d) => [d.date, d])));
      } catch (err) {
        if ((err as Error).name !== "AbortError") setLoadError(true);
      }
    };
    load();
    return () => ctrl.abort();
  }, [step, month, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Availability: chosen day's start times (fresh from the server every time) ----
  const loadDay = useCallback(async (date: string, signal?: AbortSignal) => {
    setDayLoading(true);
    try {
      const res = await fetchDay(date, signal);
      setDay(res.day);
      setLoadError(false);
      setDraft((d) => {
        if (d.date !== date || !d.slotId) return d;
        const still = res.day.slots.find((s) => s.id === d.slotId)?.state === "open";
        return still ? d : { ...d, slotId: null };
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") setLoadError(true);
    } finally {
      // An aborted request has been replaced by a newer one, which owns the spinner now.
      if (!signal?.aborted) setDayLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step !== 1 || !draft.date) return;
    const ctrl = new AbortController();
    loadDay(draft.date, ctrl.signal);
    return () => ctrl.abort();
  }, [step, draft.date, loadDay, retry]);

  const pkg = draft.packageId ? getPackage(draft.packageId) : undefined;
  const plan = getPlanFrequency(draft.plan);
  // A plan takes 10% off every cleaning, and a referral $30 off this one (content/quote.ts). `regular`
  // is the price with neither, `total` what this cleaning costs, `yearTotal` a plan's first year.
  const q = pkg ? quoteFor(pkg, draft.rinse, draft.plan, !!referral) : null;
  const regular = q?.regular ?? null;
  const total = q?.thisCleaning ?? null;
  const yearTotal = q?.firstYear ?? null;
  const off = q?.referralOff ?? 0;
  const cardPrice = (p: (typeof packages)[number]) => {
    const pq = quoteFor(p, false, draft.plan, !!referral);
    return plan ? pq.perCleaning : pq.thisCleaning;
  };
  const from = pkg?.needsQuote ? "from " : "";

  // ---- Step transitions with validation ----
  function next() {
    setBanner(null);
    if (step === 0) {
      if (!draft.packageId) {
        setErrors({ packageId: "Pick the house type that fits best." });
        return;
      }
      setErrors({});
      go(1);
    } else if (step === 1) {
      if (!draft.date || (!dayOnly && !draft.slotId)) {
        setErrors({ slotId: !draft.date ? "Pick a day first." : "Pick a start time." });
        return;
      }
      // In day-only mode the day also has to still be open.
      if (dayOnly && day?.date === draft.date && day.status !== "open") {
        setErrors({ slotId: "That day just filled up. Pick another." });
        return;
      }
      setErrors({});
      go(2);
    } else if (step === 2) {
      const errs = validateContact(draft);
      setErrors(errs);
      const first = Object.keys(errs)[0];
      if (first) {
        document.getElementById(`${uid}-${first}`)?.focus();
        return;
      }
      go(3);
    }
  }

  async function submit() {
    if (submitting || !draft.packageId || !draft.date || (!dayOnly && !draft.slotId)) return;
    if (draft.plan && !draft.planTerms) {
      setErrors((e) => ({ ...e, planTerms: PLAN_TERMS_ERROR }));
      document.getElementById(`${uid}-planterms`)?.focus();
      return;
    }
    setSubmitting(true);
    setSubmitStage("saving");
    setBanner(null);
    const request = {
      packageId: draft.packageId,
      rinse: draft.rinse,
      planFrequencyId: draft.plan,
      planTerms: draft.plan ? draft.planTerms : false,
      date: draft.date,
      slotId: draft.slotId ?? "",
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
      street: draft.street,
      city: draft.city,
      zip: draft.zip,
      notes: draft.notes,
      company: draft.company,
      referralCode: referral?.code,
    };
    const fingerprint = JSON.stringify(request);
    if (attemptKey.current?.fingerprint !== fingerprint) attemptKey.current = { key: crypto.randomUUID(), fingerprint };
    const result = await submitBooking({ idempotencyKey: attemptKey.current.key, ...request });

    if (result.kind === "ok") {
      attemptKey.current = null;
      // The booking is saved. Now tell Jimmy, and only call it done once FormSubmit confirms.
      let delivery: Delivery = { status: "off" };
      if (result.notice) {
        setSubmitStage("notifying");
        const sent = await sendNotice(result.notice);
        delivery = deliveryAfter(sent, result.notice);
      }
      // Then on to the confirmation page, which Google Ads counts as the conversion. The button stays
      // busy until the page changes.
      setSubmitStage("opening");
      saveConfirmation({ booking: result.booking, delivery, name: draft.name, phone: draft.phone });
      router.push(CONFIRMED_PATH);
      return;
    }
    setSubmitting(false);
    // Anything else was refused, so the next try is a new attempt. A network error is the one
    // exception: that request may have gone through, and the same key finds it if it did.
    if (result.kind !== "error") attemptKey.current = null;
    if (result.kind === "conflict") {
      setDay(result.day);
      setMonthDays((m) => {
        if (!m) return m;
        const copy = new Map(m);
        const { slots: _s, ...summary } = result.day;
        copy.set(result.day.date, summary);
        return copy;
      });
      setDraft((d) => ({ ...d, slotId: null, date: result.code === "slot_taken" ? d.date : null }));
      go(1);
      setBanner(result.message);
      return;
    }
    if (result.kind === "invalid") {
      setErrors(result.errors);
      const keys = Object.keys(result.errors);
      if (keys.every((k) => k === "planTerms")) {
        document.getElementById(`${uid}-planterms`)?.focus();
        return;
      }
      if (keys.some((k) => k === "packageId")) go(0);
      else if (keys.some((k) => k === "date" || k === "slotId")) go(1);
      else go(2);
      setBanner("A couple of details need another look.");
      return;
    }
    setBanner(`${result.message} Or call or text ${site.phone.display} and we'll book you by hand.`);
  }

  // ---------------------------------------------------------------- render

  const minMonth = meta ? monthStart(addDays(meta.today, meta.minLeadDays)) : null;
  const maxMonth = meta ? monthStart(addDays(meta.today, meta.horizonDays)) : null;

  return (
    <div className={styles.app}>
      <ol className={styles.progress}>
        {STEPS.map((label, i) => {
          const state = i < step ? "done" : i === step ? "now" : "todo";
          return (
            <li key={label} data-state={state}>
              {i < step ? (
                <button type="button" onClick={() => go(i as Step)}>
                  <span className={styles.stepNum}>{i + 1}</span>
                  <span className={styles.stepLabel}>{label}</span>
                  <span className="vh"> (done, edit)</span>
                </button>
              ) : (
                <span aria-current={i === step ? "step" : undefined}>
                  <span className={styles.stepNum}>{i + 1}</span>
                  <span className={styles.stepLabel}>{label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className={styles.body}>
        <div className={styles.main}>
          <div role="status" aria-live="assertive" className={banner ? styles.banner : "vh"}>
            {banner}
          </div>

          <div key={step} className={styles.stepPane}>
            {/* ---------------- 1. House ---------------- */}
            {step === 0 && planPicked && draft.plan && (
              <p className={styles.planPicked} role="status">
                <strong>
                  {getPlanFrequency(draft.plan)?.label} plan selected: {planRules.discountPercent}% off every cleaning.
                </strong>{" "}
                Pick your house and a day for the first cleaning, and Jimmy will set up the rest with you.{" "}
                <a href={`#${uid}-plan`} className={styles.planChange}>
                  Change it
                </a>
              </p>
            )}
            {step === 0 && (
              <fieldset className={styles.fieldset} aria-describedby={errors.packageId ? `${uid}-pkg-err` : undefined}>
                <legend>
                  <h3 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
                    Which one looks like your house?
                  </h3>
                </legend>
                <div className={styles.houses}>
                  {packages.map((p) => (
                    <label key={p.id} className={styles.houseOpt}>
                      <input
                        type="radio"
                        name={`${uid}-pkg`}
                        value={p.id}
                        checked={draft.packageId === p.id}
                        onChange={() => {
                          set("packageId", p.id);
                          setErrors({});
                        }}
                      />
                      <House shape={p.shape} className={styles.houseSvg} />
                      <span className={styles.houseText}>
                        <span className={styles.houseName}>{p.name}</span>
                        <span className={styles.houseFits}>{p.fits}</span>
                      </span>
                      <span className={styles.housePrice}>
                        {/* With a plan, the regular price struck through over the plan price for every cleaning.
                            The referral's $30 is for one cleaning, so it only shows here without a plan; with a
                            plan it's in the work order and the review step. */}
                        {cardPrice(p) !== p.price ? (
                          <>
                            <s className={styles.housePriceWas}>
                              <span className="vh">Regular price </span>${p.price}
                            </s>
                            <span className="vh">{plan ? ", each cleaning on your plan " : ", this cleaning "}</span>
                            {p.isFrom && <small>from </small>}${cardPrice(p)}
                          </>
                        ) : (
                          <>
                            {p.isFrom && <small>from </small>}${p.price}
                          </>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                {errors.packageId && (
                  <p id={`${uid}-pkg-err`} className={styles.err}>
                    {errors.packageId}
                  </p>
                )}
                {pkg?.needsQuote && (
                  <p className={styles.hint}>
                    For bigger houses we confirm the final price with you before the visit. Booking {dayOnly ? "a day" : "a time"} now
                    just holds your spot.
                  </p>
                )}

                <label className={styles.rinseOpt}>
                  <input type="checkbox" checked={draft.rinse} onChange={(e) => set("rinse", e.target.checked)} />
                  <span>
                    <strong>
                      Add a rinse, +${rinse.price}
                      {rinse.regularPrice && <span className={styles.was}> (normally ${rinse.regularPrice})</span>}
                    </strong>
                    <span className={styles.rinseText}>{rinse.short}</span>
                  </span>
                </label>

                <fieldset
                  id={`${uid}-plan`}
                  className={styles.repeat}
                  data-picked={(planPicked && draft.plan) || undefined}
                  aria-describedby={`${uid}-repeat-why`}
                >
                  <legend>
                    Want this on a schedule? <span className={styles.repeatDeal}>Plans are {planRules.discountPercent}% off</span>
                  </legend>
                  <div className={styles.repeatOpts}>
                    {[{ id: "", label: "Just this once", perYear: 0 }, ...planFrequencies].map((f) => (
                      <label key={f.id} className={styles.repeatOpt}>
                        <input type="radio" name={`${uid}-plan`} checked={draft.plan === f.id} onChange={() => set("plan", f.id)} />
                        <span>
                          {f.label}
                          {f.id === recommendedPlan && <span className={styles.repeatTag}>Recommended</span>}
                          {/* What this plan saves in a year, once the house is known */}
                          {f.id && regular !== null && (
                            <span className={styles.repeatSave}>
                              saves {from}${planSaving(regular) * f.perYear} a year
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p id={`${uid}-repeat-why`} className={styles.repeatWhy}>
                    Every cleaning on a plan is {planRules.discountPercent}% off. You pay for the whole year up front, in one payment
                    after the first cleaning, and the plan renews every year until you cancel. You&rsquo;ll see the terms before you
                    book. {recommendedWhy}
                  </p>
                </fieldset>
              </fieldset>
            )}

            {/* ---------------- 2. Day & time ---------------- */}
            {step === 1 && (
              <div>
                <h3 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
                  {dayOnly ? "Pick a day" : "Pick a day, then a start time"}
                </h3>
                {meta?.demo && <DemoNote />}
                {loadError && (
                  <p className={styles.err}>
                    We couldn&rsquo;t load the schedule.{" "}
                    <button type="button" className={styles.linkBtn} onClick={() => setRetry((n) => n + 1)}>
                      Try again
                    </button>{" "}
                    or call {site.phone.display}.
                  </p>
                )}
                <div className={styles.when}>
                  {month && meta ? (
                    <Calendar
                      month={month}
                      days={monthDays}
                      selected={draft.date}
                      today={meta.today}
                      maxPerDay={meta.maxJobsPerDay}
                      canPrev={!!minMonth && month > minMonth}
                      canNext={!!maxMonth && month < maxMonth}
                      onMonth={(delta) => {
                        seekOpenMonth.current = false;
                        setMonth(addMonths(month, delta));
                      }}
                      onSelect={(date) => {
                        setDraft((d) => ({ ...d, date, slotId: d.date === date ? d.slotId : null }));
                        setErrors({});
                        setBanner(null);
                        // With start times to pick next, phones scroll down to them. Otherwise stay put.
                        if (!dayOnly && window.matchMedia("(max-width: 899px)").matches) {
                          requestAnimationFrame(() =>
                            timesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                          );
                        }
                      }}
                    />
                  ) : (
                    <div className={styles.calLoading} aria-busy="true">
                      <span className="vh">Checking the schedule…</span>
                      <div className={styles.skHead} aria-hidden="true">
                        <span className="skel" />
                      </div>
                      <div className={styles.skGrid} aria-hidden="true">
                        {Array.from({ length: 35 }, (_, i) => (
                          <span key={i} className="skel" />
                        ))}
                      </div>
                    </div>
                  )}

                  {dayOnly ? (
                    <div className={styles.times} ref={timesRef as React.Ref<HTMLDivElement>}>
                      <p className={styles.timesTitle}>{draft.date ? formatShort(draft.date) : "What to expect"}</p>
                      <ul className={styles.dayOnlyNotes}>
                        <li>We don&rsquo;t normally give an exact arrival time. If you need one, ask in the additional information box on the next step.</li>
                        <li>You don&rsquo;t need to be home.</li>
                        <li>An invoice follows once the work is done.</li>
                      </ul>
                      {errors.slotId && <p className={styles.err} role="alert">{errors.slotId}</p>}
                    </div>
                  ) : (
                  <fieldset ref={timesRef} className={styles.times} aria-busy={dayLoading}>
                    <legend className={styles.timesTitle}>
                      {draft.date ? `Start times, ${formatShort(draft.date)}` : "Start times"}
                    </legend>
                    {!draft.date && <p className={styles.timesEmpty}>Pick a day to see its open times.</p>}
                    {draft.date && dayLoading && !day && <p className={styles.timesEmpty}>Checking…</p>}
                    {draft.date && day && day.date === draft.date && (
                      <div className={styles.slotList} data-loading={dayLoading || undefined}>
                        {day.slots.map((s) => {
                          const open = s.state === "open";
                          return (
                            <label key={s.id} className={styles.slot} data-state={s.state}>
                              <input
                                type="radio"
                                name={`${uid}-slot`}
                                value={s.id}
                                disabled={!open}
                                checked={draft.slotId === s.id}
                                onChange={() => {
                                  set("slotId", s.id);
                                  setErrors({});
                                }}
                              />
                              <span className={styles.slotTime}>{s.label}</span>
                              <span className={styles.slotState}>
                                {open ? s.part : s.state === "taken" ? "Booked" : s.state === "closed" ? "Closed" : "Day's full"}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {errors.slotId && <p className={styles.err} role="alert">{errors.slotId}</p>}
                  </fieldset>
                  )}
                </div>
              </div>
            )}

            {/* ---------------- 3. Address & contact ---------------- */}
            {step === 2 && (
              <div>
                <h3 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
                  Where&rsquo;s the house, and who do we talk to?
                </h3>
                <div className={styles.form}>
                  <Field id={`${uid}-street`} label="Street address" error={errors.street} wide>
                    <input
                      autoComplete="address-line1"
                      value={draft.street}
                      onChange={(e) => set("street", e.target.value)}
                    />
                  </Field>
                  <Field id={`${uid}-city`} label="Town" error={errors.city}>
                    <input
                      autoComplete="address-level2"
                      list={`${uid}-towns`}
                      value={draft.city}
                      onChange={(e) => set("city", e.target.value)}
                    />
                  </Field>
                  <datalist id={`${uid}-towns`}>
                    {areaPlaces.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  <Field
                    id={`${uid}-zip`}
                    label="ZIP"
                    error={errors.zip}
                  >
                    <input
                      autoComplete="postal-code"
                      inputMode="numeric"
                      maxLength={5}
                      value={draft.zip}
                      onChange={(e) => set("zip", e.target.value.replace(/\D/g, "").slice(0, 5))}
                    />
                  </Field>
                  <Field id={`${uid}-name`} label="Your name" error={errors.name} wide>
                    <input autoComplete="name" value={draft.name} onChange={(e) => set("name", e.target.value)} />
                  </Field>
                  <Field id={`${uid}-phone`} label="Mobile number" error={errors.phone}>
                    <input
                      type="tel"
                      autoComplete="tel-national"
                      inputMode="tel"
                      value={draft.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      onBlur={(e) => set("phone", formatPhone(e.target.value))}
                    />
                  </Field>
                  <Field id={`${uid}-email`} label="Email" error={errors.email} note="So Jimmy can reach you about your booking.">
                    <input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={draft.email}
                      onChange={(e) => set("email", e.target.value)}
                    />
                  </Field>
                  <Field id={`${uid}-notes`} label={additionalInfo.label} note={additionalInfo.note} optional wide>
                    <textarea
                      rows={3}
                      placeholder={additionalInfo.placeholder}
                      value={draft.notes}
                      onChange={(e) => set("notes", e.target.value)}
                    />
                  </Field>
                  <div className={styles.hp} aria-hidden="true">
                    <label>
                      Company
                      <input
                        tabIndex={-1}
                        autoComplete="off"
                        value={draft.company}
                        onChange={(e) => set("company", e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- 4. Check & book ---------------- */}
            {step === 3 && pkg && draft.date && (dayOnly || draft.slotId) && (
              <div>
                <h3 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
                  Look it over, then book
                </h3>
                <dl className={styles.review}>
                  <div>
                    <dt>House</dt>
                    <dd>
                      {pkg.name}
                      {draft.rinse && ", with a rinse"}
                    </dd>
                    <button type="button" className={styles.linkBtn} onClick={() => go(0)}>
                      Change
                    </button>
                  </div>
                  <div>
                    <dt>Schedule</dt>
                    <dd>{plan ? `${plan.label}, ${planRules.discountPercent}% off every cleaning` : "Just this once"}</dd>
                    <button type="button" className={styles.linkBtn} onClick={() => go(0)}>
                      Change
                    </button>
                  </div>
                  <div>
                    <dt>When</dt>
                    <dd>
                      {formatLong(draft.date)}
                      {!dayOnly && `, ${slotLabel(draft.slotId)}`}
                    </dd>
                    <button type="button" className={styles.linkBtn} onClick={() => go(1)}>
                      Change
                    </button>
                  </div>
                  <div>
                    <dt>Where</dt>
                    <dd>
                      {draft.street}, {draft.city} {draft.zip}
                    </dd>
                    <button type="button" className={styles.linkBtn} onClick={() => go(2)}>
                      Change
                    </button>
                  </div>
                  <div>
                    <dt>Contact</dt>
                    <dd>
                      {draft.name}, {formatPhone(draft.phone)}, {draft.email}
                    </dd>
                    <button type="button" className={styles.linkBtn} onClick={() => go(2)}>
                      Change
                    </button>
                  </div>
                  {referral && (
                    <div>
                      <dt>Referred by</dt>
                      <dd>{referral.referrerName}</dd>
                    </div>
                  )}
                  {draft.notes && (
                    <div>
                      <dt>Additional info</dt>
                      <dd>{draft.notes}</dd>
                    </div>
                  )}
                </dl>
                {plan && q && yearTotal !== null ? (
                  <>
                    <p className={styles.totalLine}>
                      <span>
                        {pkg.needsQuote ? "Starting at, per cleaning" : "Per cleaning"}, {planRules.discountPercent}% off on your plan
                      </span>
                      <strong>
                        <s className={styles.totalWas}>
                          <span className="vh">Regular price </span>${regular}
                        </s>{" "}
                        <span className="vh">Plan price </span>${q.perCleaning}
                      </strong>
                    </p>
                    {off > 0 && (
                      <p className={styles.yearLine}>
                        <span>Your referral discount, on this first cleaning</span>
                        <strong>&minus;${off}</strong>
                      </p>
                    )}
                    <p className={styles.yearLine}>
                      <span>
                        The year, paid up front after the first cleaning ({plan.perYear} &times; ${q.perCleaning}
                        {off > 0 && ` − $${off}`})
                      </span>
                      <strong>
                        {from}${yearTotal}
                      </strong>
                    </p>
                  </>
                ) : (
                  <p className={styles.totalLine}>
                    <span>
                      {pkg.needsQuote ? "Starting at" : "Total"}
                      {off > 0 && `, $${off} off for your referral`}
                    </span>
                    <strong>
                      {off > 0 && (
                        <>
                          <s className={styles.totalWas}>
                            <span className="vh">Regular price </span>${regular}
                          </s>{" "}
                          <span className="vh">Your price </span>
                        </>
                      )}
                      ${total}
                    </strong>
                  </p>
                )}
                {draft.plan && (
                  <PlanAgreement
                    id={`${uid}-planterms`}
                    frequencyId={draft.plan}
                    regularPrice={regular}
                    referralOff={off}
                    priceIsFrom={pkg.needsQuote}
                    checked={draft.planTerms}
                    onChange={(v) => set("planTerms", v)}
                    error={errors.planTerms}
                  />
                )}
                <ul className={styles.fine}>
                  <li>
                    {plan
                      ? `Nothing is charged now. After the first cleaning we invoice the whole year up front, ${from}$${yearTotal}.`
                      : "Nothing is charged now. We invoice after the cleaning."}
                  </li>
                  <li>
                    Free to cancel or move with {site.policies.freeRescheduleHours} hours&rsquo; notice.
                    {site.policies.lateCancelFeeDollars !== null &&
                      ` Inside ${site.policies.freeRescheduleHours} hours, a cancellation may cost $${site.policies.lateCancelFeeDollars}.`}{" "}
                    Bad weather means we reschedule at no cost.
                  </li>
                  {dayOnly && <li>We don&rsquo;t normally give an exact arrival time, and you don&rsquo;t need to be home.</li>}
                  {pkg.needsQuote && <li>We&rsquo;ll confirm the final price with you before the visit.</li>}
                  <li>
                    By booking, you agree to our{" "}
                    <a href={legalPaths.terms} target="_blank" rel="noopener">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href={legalPaths.privacy} target="_blank" rel="noopener">
                      Privacy Policy
                    </a>
                    , and to calls, texts and emails about your booking.
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className={styles.actions}>
            {step > 0 ? (
              <button type="button" className={styles.back} onClick={() => go((step - 1) as Step)}>
                ← Back
              </button>
            ) : (
              <span />
            )}
            {total !== null && (
              <span className={styles.actTotal} aria-hidden="true">
                {pkg?.isFrom ? "from " : ""}${total}
              </span>
            )}
            {step < 3 ? (
              <button type="button" className="btn" onClick={next}>
                {step === 0 ? "Choose a day" : step === 1 ? "Add your address" : "Review"}
                <span className="arrow" aria-hidden="true">
                  →
                </span>
              </button>
            ) : (
              <button type="button" className="btn btn--sky" onClick={submit} disabled={submitting} aria-busy={submitting}>
                {submitting
                  ? submitStage === "opening"
                    ? "Booked. Opening your confirmation…"
                    : submitStage === "notifying"
                      ? "Sending it to Jimmy…"
                      : "Checking the schedule…"
                  : `Book ${draft.date ? formatShort(draft.date) : ""}${dayOnly ? "" : `, ${slotLabel(draft.slotId)}`}`}
              </button>
            )}
          </div>
        </div>

        {/* Running summary, like a work order filling in */}
        <aside className={styles.ticket} aria-label="Your booking so far">
          <p className={styles.ticketHead}>Work order</p>
          <dl>
            <div>
              <dt>House</dt>
              <dd>{pkg ? pkg.name : "—"}</dd>
              <dd className={styles.amt}>{pkg ? `${pkg.isFrom ? "from " : ""}$${pkg.price}` : ""}</dd>
            </div>
            {draft.rinse && (
              <div>
                <dt>Rinse</dt>
                <dd>Yes</dd>
                <dd className={styles.amt}>+${rinse.price}</dd>
              </div>
            )}
            {plan && (
              <div>
                <dt>Plan</dt>
                <dd>
                  {plan.label}, {planRules.discountPercent}% off
                </dd>
                <dd className={styles.amt}>{regular !== null ? `−$${planSaving(regular)}` : ""}</dd>
              </div>
            )}
            {referral && (
              <div>
                <dt>Referral</dt>
                <dd>{plan ? "$30 off the first cleaning" : "$30 off"}</dd>
                <dd className={styles.amt}>{pkg ? `−$${off}` : ""}</dd>
              </div>
            )}
            <div>
              <dt>Day</dt>
              <dd>{draft.date ? formatShort(draft.date) : "—"}</dd>
            </div>
            {!dayOnly && (
              <div>
                <dt>Start</dt>
                <dd>{draft.slotId ? slotLabel(draft.slotId) : "—"}</dd>
              </div>
            )}
            <div>
              <dt>Where</dt>
              <dd>{draft.street && draft.city ? `${draft.street}, ${draft.city}` : "—"}</dd>
            </div>
          </dl>
          <p className={styles.ticketTotal}>
            <span>
              {plan ? (referral ? "This cleaning" : "A cleaning") : "Total"}
              {pkg?.needsQuote && ", from"}
            </span>
            <strong>{total !== null ? `$${total}` : "—"}</strong>
          </p>
          <p className={styles.ticketNote}>
            {plan
              ? yearTotal !== null
                ? `The year, ${from}$${yearTotal}, is paid up front after the first cleaning.`
                : "The year is paid up front, after the first cleaning."
              : "Paid after the job."}
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Rough local "today" just to make the first request; the server's answer replaces it. */
function todayGuess() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}


function Field({
  id,
  label,
  error,
  note,
  optional,
  wide,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  note?: string;
  optional?: boolean;
  wide?: boolean;
  children: React.ReactElement<React.InputHTMLAttributes<HTMLInputElement>>;
}) {
  const describedBy = [error ? `${id}-err` : null, note ? `${id}-note` : null].filter(Boolean).join(" ") || undefined;
  const control = cloneElement(children, {
    id,
    name: id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    required: !optional,
  });
  return (
    <div className={`${styles.field} ${wide ? styles.wide : ""}`} data-invalid={error ? "" : undefined}>
      <label htmlFor={id}>
        {label}
        {optional && <span className={styles.optional}> (optional)</span>}
      </label>
      {control}
      {note && !error && (
        <p id={`${id}-note`} className={styles.note}>
          {note}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className={styles.err}>
          {error}
        </p>
      )}
    </div>
  );
}

