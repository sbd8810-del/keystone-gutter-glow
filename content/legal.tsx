import Link from "next/link";
import type { ReactNode } from "react";
import { serviceRadius } from "./area";
import { legalPaths } from "./legalPaths";
import { getPlanFrequency, planAnnualTotal, planFrequencies, planPrice, planRules } from "./plans";
import { getPackage, rinse } from "./pricing";
import { referralPaths, referralRules } from "./referral";
import { site } from "./site";

// The legal pages: Terms of Service, Privacy Policy and Recurring Plan Terms. Drafted 2026-11-11 from
// what the business actually does (content/site.ts, plans.ts, faqs.ts) and from how this website
// handles data (Vercel, Supabase, FormSubmit, Google Ads tag, OpenStreetMap).
//
// These are a careful draft, not legal advice. Have a Pennsylvania attorney review them before
// relying on them (see the README, "Legal pages"). When a rule changes, change it here, and bump
// planRules.termsVersion in content/plans.ts if the Recurring Plan Terms change.

export const LEGAL_UPDATED = "November 14, 2026";

export { legalPaths };

export interface LegalSection {
  id: string;
  title: string;
  /** Short label for the side rail */
  nav: string;
  body: ReactNode;
}

export interface LegalDoc {
  path: string;
  title: string;
  description: string;
  intro: ReactNode;
  sections: LegalSection[];
}

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
const Phone = () => <a href={site.phone.href}>{site.phone.display}</a>;
const Email = () => <a href={`mailto:${site.email}`}>{site.email}</a>;
const Contact = () => (
  <>
    call or text <Phone />, or email <Email />
  </>
);

const off = `${planRules.discountPercent}%`;
const [noticeFar, noticeNear] = planRules.noticeHours;
// A worked example from the real prices: a two-story house every 6 months.
const examplePkg = getPackage("two-story")!;
const exampleFreq = getPlanFrequency("6-months")!;
const examplePlanPrice = planPrice(examplePkg.price);
const exampleAnnual = planAnnualTotal(examplePlanPrice, exampleFreq.id)!;
const frequencyList = planFrequencies
  .slice()
  .sort((a, b) => b.perYear - a.perYear)
  .map((f) => `${f.label.toLowerCase()} (${f.visits})`);

// ---------------------------------------------------------------------------------------------
// Recurring Plan Terms
// ---------------------------------------------------------------------------------------------

export const planTerms: LegalDoc = {
  path: legalPaths.planTerms,
  title: "Recurring Plan Terms",
  description:
    "How Keystone Gutter Glow's recurring gutter cleaning plans work: the plan discount, visits and notice, paying for the year up front, automatic renewal, and how to cancel.",
  intro: (
    <>
      These terms apply to every recurring gutter cleaning plan with {site.legalName}, a Pennsylvania company owned by {site.owner}{" "}
      (&ldquo;we&rdquo;, &ldquo;us&rdquo;). You agree to them by ticking the box when you book a plan or send a plan request. Our{" "}
      <Link href={legalPaths.terms}>Terms of Service</Link> also apply; where the two differ, these terms decide how your plan works.
    </>
  ),
  sections: [
    {
      id: "short-version",
      nav: "The short version",
      title: "The short version",
      body: (
        <ul>
          <li>We clean your gutters on the schedule you pick: every 3, 4 or 6 months, or once a year.</li>
          <li>Every cleaning on a plan is {off} off the regular price for your house.</li>
          <li>
            We show up on each scheduled date, and we tell you {noticeFar} hours and again {noticeNear} hours before every visit.
          </li>
          <li>You don&rsquo;t need to be home.</li>
          <li>You pay for the whole year up front, in one payment after the year&rsquo;s first cleaning.</li>
          <li>The plan renews every year until you cancel.</li>
          <li>
            You can cancel any time, with no cancellation fee. To cancel, <Contact />.
          </li>
          <li>If you cancel, payments already made aren&rsquo;t refunded, including for cleanings you haven&rsquo;t had yet.</li>
        </ul>
      ),
    },
    {
      id: "your-plan",
      nav: "Your plan",
      title: "Your plan",
      body: (
        <>
          <p>
            Your plan covers the house, cleaning and rinse option you chose when you booked, at the frequency you chose:{" "}
            {frequencyList.slice(0, -1).join(", ")} or {frequencyList.at(-1)}.
          </p>
          <p>
            The cleaning you book on our website is your plan&rsquo;s first cleaning. A plan year starts on the date of that first
            cleaning and runs for 12 months. Each renewal starts a new plan year.
          </p>
        </>
      ),
    },
    {
      id: "visits-and-notice",
      nav: "Visits and notice",
      title: "Visits and notice",
      body: (
        <>
          <p>
            We schedule each cleaning for you and show up on the scheduled date. Before every visit we text or email you{" "}
            {noticeFar} hours ahead and again {noticeNear} hours ahead, using the contact details you gave us.
          </p>
          <p>
            You don&rsquo;t need to be home, as long as we can safely reach your gutters: gates unlocked (or a code in your notes)
            and pets inside.
          </p>
          <p>
            If a date doesn&rsquo;t work for you, tell us at least {site.policies.freeRescheduleHours} hours before the visit and
            we&rsquo;ll move it at no cost. If {site.policies.weather.slice(0, -1).join(", ")} or {site.policies.weather.at(-1)} make a
            visit unsafe, we move it to the next open day and let you know.
          </p>
        </>
      ),
    },
    {
      id: "price-and-payment",
      nav: "Price and payment",
      title: "Price and payment",
      body: (
        <>
          <p>
            <strong>Every cleaning on a plan is {off} off</strong> the regular price per cleaning for your house (including the{" "}
            {money(rinse.price)} rinse, if you chose it), rounded down to the whole dollar. That plan price is the price shown when
            you booked, and it applies to every cleaning in the plan, the first one included.
          </p>
          <p>
            Your annual total is the plan price times the number of cleanings in a plan year. For example, a{" "}
            {examplePkg.name.toLowerCase()} house is {money(examplePkg.price)} a cleaning, or {money(examplePlanPrice)} on a plan;{" "}
            {exampleFreq.label.toLowerCase()} that is {exampleFreq.perYear} &times; {money(examplePlanPrice)} ={" "}
            {money(exampleAnnual)} for the year.
          </p>
          <p>
            <strong>You pay for the whole plan year up front:</strong> the full annual total, in one payment, by the invoice we send
            after the first cleaning of each plan year. Nothing is charged when you book.
          </p>
          <p>
            If your house is priced &ldquo;starting at&rdquo;, we confirm the exact regular price with you before the first
            cleaning, and your plan price and annual total use that price.
          </p>
        </>
      ),
    },
    {
      id: "renewal",
      nav: "Automatic renewal",
      title: "Automatic renewal",
      body: (
        <>
          <p>
            <strong>Your plan renews automatically at the end of each plan year and keeps renewing until you cancel.</strong> Each
            renewal year is paid the same way: up front, in one payment after that year&rsquo;s first cleaning, at the plan price.
          </p>
          <p>
            Your price per cleaning stays the same unless we tell you about a change in writing before your renewal year starts, so
            you can cancel first if you&rsquo;d rather.
          </p>
        </>
      ),
    },
    {
      id: "cancelling",
      nav: "Cancelling",
      title: "Cancelling",
      body: (
        <>
          <p>
            You can cancel at any time. To cancel, <Contact />, and give us your name and address. We&rsquo;ll confirm the
            cancellation by text or email, and we won&rsquo;t schedule any more visits.
          </p>
          <p>
            <strong>There&rsquo;s no cancellation fee.</strong>
          </p>
          <p>
            <strong>Payments already made aren&rsquo;t refunded.</strong> If you cancel partway through a plan year you&rsquo;ve
            paid for, we don&rsquo;t refund that payment or any part of it, including for cleanings in that year you haven&rsquo;t
            had yet. Your plan doesn&rsquo;t renew after you cancel.
          </p>
        </>
      ),
    },
    {
      id: "if-we-end-it",
      nav: "If we end a plan",
      title: "If we end your plan",
      body: (
        <p>
          We may end your plan if we can&rsquo;t safely reach your gutters, if an invoice isn&rsquo;t paid, or if we stop serving your
          address. If we end it for a reason that isn&rsquo;t your doing, we refund any cleanings you&rsquo;ve paid for but
          haven&rsquo;t received.
        </p>
      ),
    },
    {
      id: "changes",
      nav: "Changes",
      title: "Changes to these terms",
      body: (
        <p>
          If we change these terms, we&rsquo;ll post the new version here with a new date. A change applies to your plan from your next
          plan year, after we&rsquo;ve told you about it. The version you agreed to is recorded with your booking.
        </p>
      ),
    },
    {
      id: "questions",
      nav: "Questions",
      title: "Questions",
      body: (
        <p>
          Anything unclear? <Contact />. We&rsquo;re happy to explain any of this before you sign up.
        </p>
      ),
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// Terms of Service
// ---------------------------------------------------------------------------------------------

export const terms: LegalDoc = {
  path: legalPaths.terms,
  title: "Terms of Service",
  description: "The terms for booking gutter cleaning with Keystone Gutter Glow and using this website.",
  intro: (
    <>
      These terms cover booking and receiving gutter cleaning from {site.legalName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;), and using
      this website. By booking, you agree to them. Recurring plans also follow our{" "}
      <Link href={legalPaths.planTerms}>Recurring Plan Terms</Link>, and our <Link href={legalPaths.privacy}>Privacy Policy</Link>{" "}
      explains how we handle your information.
    </>
  ),
  sections: [
    {
      id: "who-we-are",
      nav: "Who we are",
      title: "Who we are",
      body: (
        <p>
          {site.legalName} is a Pennsylvania company owned by {site.owner}. We clean gutters at homes within {serviceRadius.miles}{" "}
          miles of {site.centerTown}, Pennsylvania, and we only work in Pennsylvania. To reach us, <Contact />.
        </p>
      ),
    },
    {
      id: "booking",
      nav: "Booking",
      title: "Booking",
      body: (
        <>
          <p>
            When you book on this website, you&rsquo;re asking us to clean the gutters at the address you give, on the day you pick.
            Your booking is confirmed when the website shows your booking reference.
          </p>
          <p>
            Please give us accurate details: the right address, house type and contact information. If the house turns out to be a
            different size or type than you booked, or the gutters can&rsquo;t be reached safely, we&rsquo;ll tell you the right price
            before we start, and you can cancel at no charge.
          </p>
          <p>By booking, you agree that we may call, text or email you about your booking and your visits.</p>
        </>
      ),
    },
    {
      id: "the-service",
      nav: "What we do",
      title: "What a cleaning includes",
      body: (
        <p>
          A standard cleaning means vacuuming every gutter run we can safely reach, clearing each downspout and running water down it to
          check that it drains, and before-and-after photos when conditions allow. The rinse is an optional extra. We clean; we
          don&rsquo;t repair or replace gutters, guards, downspouts or roofs. If we see damage, we&rsquo;ll tell you.
        </p>
      ),
    },
    {
      id: "access",
      nav: "Access",
      title: "Access to your home",
      body: (
        <p>
          You don&rsquo;t need to be home. Please make sure we can reach the gutters: gates unlocked or a code in your booking notes, pets
          inside, and cars or other things moved away from the walls where we need to work. Tell us about anything we should know, such
          as loose gutters or fragile plants. If we can&rsquo;t safely reach the gutters when we arrive, we may need to reschedule.
        </p>
      ),
    },
    {
      id: "prices-and-payment",
      nav: "Prices and payment",
      title: "Prices and payment",
      body: (
        <p>
          Prices are shown on this website and confirmed when you book. For homes priced &ldquo;starting at&rdquo;, we confirm the exact
          price with you before the visit. Nothing is charged when you book. We send an invoice after the cleaning, and payment is due
          when you receive it. On a recurring plan every cleaning is {off} off, and the year is paid up front, as described in the{" "}
          <Link href={legalPaths.planTerms}>Recurring Plan Terms</Link>.
        </p>
      ),
    },
    {
      id: "referrals",
      nav: "Referrals",
      title: "Referrals",
      body: (
        <>
          <p>
            <strong>Referring someone.</strong> Tell us about someone on our <Link href={referralPaths.refer}>Refer a neighbor</Link>{" "}
            page and we&rsquo;ll get in touch with them and send them their own referral link. Only refer people who are happy to
            hear from us; we use their details to contact them about a cleaning, and to know who to thank, and for nothing else.
          </p>
          <p>
            <strong>Your thank-you</strong> is your choice of ${referralRules.cashReward} cash or ${referralRules.planCredit} off the
            first year of a recurring plan. The ${referralRules.planCredit} applies to that first plan year only, not to renewals, and
            isn&rsquo;t cash. If you choose the plan, we&rsquo;ll call you to set it up. A referral only counts when the person you
            referred books a cleaning and we&rsquo;ve fully cleaned their house, and your thank-you is paid after that cleaning, not
            before. Nothing is owed for a referral that doesn&rsquo;t become a booking, or before the cleaning is done.
          </p>
          <p>
            <strong>If you were referred,</strong> ${referralRules.friendDiscount} comes off the one cleaning you book with the
            personal link we send you. Each link works for one booking. If that cleaning starts a recurring plan, the $
            {referralRules.friendDiscount}{" "}
            comes off the first cleaning, and so off the first year&rsquo;s payment. It isn&rsquo;t cash and can&rsquo;t be exchanged
            for cash.
          </p>
          <p>
            We may change or end the referral program. Referrals made before a change keep the terms they were made under.
          </p>
        </>
      ),
    },
    {
      id: "cancelling",
      nav: "Cancelling",
      title: "Rescheduling and cancelling",
      body: (
        <>
          <p>
            You can cancel or move a one-time cleaning for free with at least {site.policies.freeRescheduleHours} hours&rsquo; notice:
            just <Contact />. Inside {site.policies.freeRescheduleHours} hours, a cancellation fee may apply
            {site.policies.lateCancelFeeDollars !== null ? ` (${money(site.policies.lateCancelFeeDollars)})` : ""}; we&rsquo;ll tell
            you the amount before charging anything. Recurring plans have their own cancellation terms.
          </p>
          <p>
            If {site.policies.weather.slice(0, -1).join(", ")} or {site.policies.weather.at(-1)} make the work unsafe, we move your
            cleaning to the next open day at no cost and tell you as early as we can.
          </p>
        </>
      ),
    },
    {
      id: "satisfaction",
      nav: "If you're not happy",
      title: "If you're not happy",
      body: (
        <p>
          Tell us within {site.policies.returnVisitHours} hours and we&rsquo;ll come back and sort it out at no charge. If a second visit
          doesn&rsquo;t fix it, we&rsquo;ll talk with you about a partial or full refund.
        </p>
      ),
    },
    {
      id: "liability",
      nav: "Care and liability",
      title: "Care and liability",
      body: (
        <>
          <p>
            We work carefully. Gutters, roofs and downspouts are often already worn, loose or damaged, though, so we aren&rsquo;t
            responsible for damage or problems that existed before our visit, that come from hidden defects we couldn&rsquo;t
            reasonably see, or that arise after our visit (for example from new storms or falling leaves). If you think we caused
            damage, tell us within {site.policies.returnVisitHours} hours, with photos if you can, so we can look at it.
          </p>
          <p>
            To the fullest extent Pennsylvania law allows, our total liability for any claim about a cleaning is limited to the amount
            you paid for that cleaning, and we aren&rsquo;t liable for indirect or consequential losses. Nothing in these terms limits
            liability that the law doesn&rsquo;t allow us to limit, including for gross negligence or willful misconduct.
          </p>
        </>
      ),
    },
    {
      id: "website",
      nav: "This website",
      title: "This website",
      body: (
        <p>
          We try to keep this website accurate and working, but it&rsquo;s provided as it is. Prices, availability and our service area
          can change. The ZIP check and the map are a guide; the address you book decides whether it&rsquo;s in our area. Please
          don&rsquo;t misuse the site, for example by sending fake bookings.
        </p>
      ),
    },
    {
      id: "disputes",
      nav: "Disputes",
      title: "Disputes",
      body: (
        <p>
          If something goes wrong, please <Contact /> first; most problems are sorted out in one conversation. These terms are governed
          by the laws of Pennsylvania. Any court case about them or our services will be brought in the courts of {site.county},
          Pennsylvania.
        </p>
      ),
    },
    {
      id: "changes",
      nav: "Changes",
      title: "Changes to these terms",
      body: (
        <p>
          We may update these terms; the date at the top shows the latest version. The terms in place when you booked apply to that
          booking.
        </p>
      ),
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// Privacy Policy
// ---------------------------------------------------------------------------------------------

export const privacy: LegalDoc = {
  path: legalPaths.privacy,
  title: "Privacy Policy",
  description: "What information Keystone Gutter Glow collects through this website and when we clean your gutters, and how it's used.",
  intro: (
    <>
      This policy explains what information {site.legalName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects through this website and
      when we clean your gutters, how we use it, and the choices you have.
    </>
  ),
  sections: [
    {
      id: "what-we-collect",
      nav: "What we collect",
      title: "What we collect",
      body: (
        <ul>
          <li>
            <strong>When you book or send a plan request:</strong> your name, phone number, email address, the service address, your
            house type, the day you picked, any notes you add, the plan you chose, and that you agreed to our terms.
          </li>
          <li>
            <strong>When you refer someone:</strong> your name, phone number and email address, the thank-you you chose, and the name,
            phone number, email address and town you give us for the person you&rsquo;re referring. We keep each referral in our
            booking database, with the booking it leads to, so we know who to thank.
          </li>
          <li>
            <strong>When you use the ZIP check:</strong> nothing. It runs in your browser and isn&rsquo;t sent to us.
          </li>
          <li>
            <strong>Automatically:</strong> like most websites, our hosting provider records technical details such as your IP address,
            browser type and the pages you visit. The Google tag on our site also collects information about your visit (see
            &ldquo;Advertising and cookies&rdquo;).
          </li>
          <li>
            <strong>When we clean:</strong> before-and-after photos of your gutters.
          </li>
        </ul>
      ),
    },
    {
      id: "how-we-use-it",
      nav: "How we use it",
      title: "How we use it",
      body: (
        <>
          <p>
            To schedule and do the work, tell you before visits, send invoices, answer your questions, keep business and tax records,
            run and improve this website, and measure whether our advertising works. If someone referred you, we use their details to
            get in touch with you about a cleaning, and to thank the person who referred you once it&rsquo;s done.
          </p>
          <p>We don&rsquo;t sell your personal information, and we don&rsquo;t share it for anyone else&rsquo;s marketing.</p>
        </>
      ),
    },
    {
      id: "who-we-share-with",
      nav: "Who sees it",
      title: "Who we share it with",
      body: (
        <>
          <p>Only the services that help us run the business, for that purpose:</p>
          <ul>
            {/* If the site moves to another host, name that host here and update LEGAL_UPDATED. */}
            <li>
              <strong>Vercel</strong> hosts this website.
            </li>
            <li>
              <strong>Supabase</strong> stores bookings and referrals in a database in the United States.
            </li>
            <li>
              <strong>FormSubmit</strong> (formsubmit.co) delivers your booking, plan request or referral to {site.owner}&rsquo;s email,
              and keeps a copy for up to 30 days. Our email provider stores the emails we receive and send.
            </li>
            <li>
              <strong>Google</strong> receives information about visits through the Google tag (see below).
            </li>
            <li>
              <strong>OpenStreetMap</strong> supplies the map on our home page. Your browser loads the map images directly from it, so it
              sees your IP address.
            </li>
          </ul>
          <p>We may also share information if the law requires it, or to protect our rights or someone&rsquo;s safety.</p>
        </>
      ),
    },
    {
      id: "advertising-and-cookies",
      nav: "Advertising and cookies",
      title: "Advertising and cookies",
      body: (
        <>
          <p>
            Our website uses the Google tag for Google Ads. Google may use cookies and similar technology to measure whether someone who
            clicked one of our ads went on to book, and to show our ads to people who have visited our site. Google&rsquo;s use of that
            information is covered by{" "}
            <a href="https://policies.google.com/privacy" rel="noopener noreferrer">
              Google&rsquo;s Privacy Policy
            </a>
            . You can turn off personalized ads at{" "}
            <a href="https://myadcenter.google.com/" rel="noopener noreferrer">
              My Ad Center
            </a>
            , or block cookies in your browser.
          </p>
          <p>
            We don&rsquo;t set our own advertising cookies. After you book, your browser tab keeps your confirmation (in session storage)
            so the confirmation page can show it again if you reload; it&rsquo;s cleared when you close the tab. Our site doesn&rsquo;t
            respond to &ldquo;Do Not Track&rdquo; signals.
          </p>
        </>
      ),
    },
    {
      id: "how-long",
      nav: "How long we keep it",
      title: "How long we keep it",
      body: (
        <p>
          We keep booking records for as long as we need them to provide our services and to meet tax, accounting and legal
          requirements, then delete them.
        </p>
      ),
    },
    {
      id: "your-choices",
      nav: "Your choices",
      title: "Your choices",
      body: (
        <p>
          You can ask what information we have about you, ask us to correct it, or ask us to delete it (unless we have to keep it, for
          example for tax records). You can also ask us to stop contacting you; if you have a recurring plan, we still need a way to tell
          you before visits. To ask, <Contact />.
        </p>
      ),
    },
    {
      id: "security",
      nav: "Security",
      title: "Security",
      body: (
        <p>
          We use reputable providers and limit who can see your information. No website or email is completely secure, so please
          don&rsquo;t put sensitive details such as payment card numbers in the booking notes.
        </p>
      ),
    },
    {
      id: "children",
      nav: "Children",
      title: "Children",
      body: (
        <p>
          Our services are for homeowners and residents. This website isn&rsquo;t meant for children under 13, and we don&rsquo;t knowingly
          collect their information.
        </p>
      ),
    },
    {
      id: "changes",
      nav: "Changes",
      title: "Changes and contact",
      body: (
        <p>
          We&rsquo;ll post any changes here with a new date. Questions about your information? <Contact />.
        </p>
      ),
    },
  ],
};

export const legalDocs = { terms, privacy, planTerms };
