import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer/Footer";
import { Keystone } from "@/components/Keystone";
import { MobileNav } from "@/components/nav/MobileNav";
import { Rail } from "@/components/nav/Rail";
import { ReferForm } from "@/components/refer/ReferForm";
import { serviceRadius } from "@/content/area";
import { legalPaths } from "@/content/legalPaths";
import type { NavItem } from "@/content/nav";
import { referralPaths, referralRewards, referralRules } from "@/content/referral";
import { site } from "@/content/site";
import { planRequestsOpen } from "@/lib/plan/open";
import styles from "./refer.module.css";

// Refer a neighbor: the customer picks their thank-you and gives their friend's details, Jimmy gets
// in touch and sends the friend /referred ($30 off). The rules are in content/referral.ts.

export const metadata: Metadata = {
  title: "Refer a neighbor",
  description: `Refer a neighbor to Keystone Gutter Glow. They get $${referralRules.friendDiscount} off a gutter cleaning, and you get $${referralRules.cashReward} cash or $${referralRules.planCredit} off the first year of a recurring plan.`,
  alternates: { canonical: referralPaths.refer },
};

const sections: NavItem[] = [
  { id: "reward", label: "The thank-you" },
  { id: "steps", label: "How it works" },
  { id: "refer", label: "Refer someone" },
  { id: "questions", label: "Questions" },
];

const { friendDiscount, cashReward, planCredit } = referralRules;

const steps = [
  {
    title: "You tell us who",
    body: "Fill in the form: your details, the thank-you you want, and their name and number.",
  },
  {
    title: "Jimmy gets in touch",
    body: `He reaches out to them and sends them our referral page, where their cleaning is $${friendDiscount} off.`,
  },
  {
    title: "They book, and we clean",
    body: "It counts as a referral once they've booked a cleaning and we've fully cleaned their gutters.",
  },
  {
    title: "You get your thank-you",
    body: `$${cashReward} cash, paid after their cleaning. Or $${planCredit} off the first year of a recurring plan, and Jimmy calls you to set it up.`,
  },
];

const faqs = [
  {
    q: "When do I get my thank-you?",
    a: `After the person you referred has booked and we've fully cleaned their gutters. A referral only counts once it's a real booking and the cleaning is done, so there's nothing to pay out before then.`,
  },
  {
    q: `How does the $${planCredit} off a recurring plan work?`,
    a: `Pick it on the form and Jimmy will call you to set it up. It comes off the first year of your plan only, not renewals. Plans are a cleaning every 3, 4 or 6 months, or once a year.`,
  },
  {
    q: `How does the person I refer get their $${friendDiscount} off?`,
    a: `Jimmy sends them our referral page. They book there and give your name, and $${friendDiscount} comes off that cleaning. If they put it on a recurring plan, it comes off the first cleaning.`,
  },
  {
    q: "Do they have to be in your service area?",
    a: `Yes. We clean houses within ${serviceRadius.miles} miles of Jamison, in Pennsylvania only. A referral counts once we've cleaned their house, so it has to be one we can get to.`,
  },
  {
    q: "What do you do with their details?",
    a: "Jimmy uses them to get in touch about a cleaning, and that's all. Only refer people who'd be happy to hear from us.",
  },
];

export default function ReferPage() {
  const open = planRequestsOpen();
  return (
    <div>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Rail items={sections} endId="__none" endLabel="Book a cleaning" homeHref="/" bookHref="/#book" homeLink planOffer />
      <MobileNav items={sections} endId="__none" homeHref="/" bookHref="/#book" bookLabel="Book a cleaning" />

      <main id="main">
        <header id="top" className={styles.hero}>
          <div className={`${styles.gutter} gutter-face`} aria-hidden="true" data-gutter-anchor="" />
          <div className="wrap">
            <Link href="/" className={`textlink ${styles.back}`}>
              <span aria-hidden="true">←</span> Back to the home page
            </Link>
            <p className={styles.kicker}>Referrals</p>
            <h1 className={styles.title}>Send a neighbor our way.</h1>
            <p className={styles.intro}>
              They get ${friendDiscount} off a gutter cleaning. You get ${cashReward} cash, or ${planCredit} off the first year of a
              recurring plan, once we&rsquo;ve cleaned their gutters.
            </p>
            <a href="#refer" className="btn">
              Refer someone
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </a>
          </div>
        </header>

        <section id="reward" className={styles.reward} aria-labelledby="reward-title">
          <div className="wrap">
            <h2 id="reward-title" className="vh">
              The thank-you
            </h2>
            <div className={styles.rewardGrid}>
              <div className={styles.rewardItem}>
                <p className={styles.rewardWho}>You get, your choice</p>
                <p className={styles.rewardValue}>
                  {referralRewards.cash.label}
                  <span className={styles.rewardOr}> or </span>
                  {referralRewards.plan.label}
                </p>
                <p className={styles.rewardHint}>
                  Paid after their gutters are cleaned. The ${planCredit} comes off your plan&rsquo;s first year only; pick it and Jimmy
                  will call you to set it up.
                </p>
              </div>
              <div className={styles.rewardItem}>
                <p className={styles.rewardWho}>They get</p>
                <p className={styles.rewardValue}>${friendDiscount} off a cleaning</p>
                <p className={styles.rewardHint}>Jimmy sends them our referral page, and it comes off when they book there.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="steps" className={styles.steps} aria-labelledby="steps-title">
          <div className="wrap">
            <h2 id="steps-title">How it works</h2>
            <ol className={styles.stepList}>
              {steps.map((s, i) => (
                <li key={s.title}>
                  <Keystone n={i + 1} size={30} />
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="refer" className={`${styles.refer} on-dark`} aria-labelledby="refer-title">
          <div className={`wrap ${styles.referGrid}`}>
            <div>
              <h2 id="refer-title">Refer someone</h2>
              <p className={styles.referIntro}>
                Tell us who they are and how to reach them. Jimmy gets in touch and sends them the ${friendDiscount}-off booking
                page.
              </p>
              <p className={styles.referIntro}>
                Only refer people who&rsquo;d be happy to hear from us. Rather do it by phone? Call or text Jimmy at{" "}
                <a href={site.phone.href}>{site.phone.display}</a> with their name and number.
              </p>
              <p className={styles.referSmall}>
                The program&rsquo;s rules are in our <Link href={legalPaths.terms}>Terms of Service</Link>, under Referrals.
              </p>
            </div>
            {open ? (
              <ReferForm />
            ) : (
              <p className={styles.closed}>
                Online referrals aren&rsquo;t open right now. Call or text Jimmy at{" "}
                <a href={site.phone.href}>{site.phone.display}</a> with your name, their name and their number, and tell him
                which thank-you you&rsquo;d like.
              </p>
            )}
          </div>
        </section>

        <section id="questions" className={styles.questions} aria-labelledby="q-title">
          <div className="wrap">
            <h2 id="q-title">Questions</h2>
            <div className={styles.qList}>
              {faqs.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer onHome={false} />
    </div>
  );
}
