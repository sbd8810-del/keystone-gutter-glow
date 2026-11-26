import type { Metadata } from "next";
import { BookingConfirmed } from "@/components/booking/BookingConfirmed";
import { Footer } from "@/components/footer/Footer";
import { MobileNav } from "@/components/nav/MobileNav";
import { Rail } from "@/components/nav/Rail";
import type { NavItem } from "@/content/nav";
import { googleTagOn } from "@/lib/ads";
import { planRequestsOpen } from "@/lib/plan/open";
import styles from "./booking-confirmed.module.css";

// Where the booking form sends people after a successful booking. Google Ads counts arriving here
// with a booking as a "Purchase" conversion (lib/ads.ts). Not a place to book from, so it's kept
// out of search results and the sitemap.

export const metadata: Metadata = {
  title: "Booking confirmed",
  description: "Your gutter cleaning booking with Keystone Gutter Glow.",
  alternates: { canonical: "/booking-confirmed" },
  robots: { index: false, follow: false },
};

const sections: NavItem[] = [{ id: "booking", label: "Your booking" }];

export default function BookingConfirmedPage() {
  return (
    <div>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Rail items={sections} endId="__none" endLabel="Book a cleaning" homeHref="/" bookHref="/#book" homeLink planOffer />
      <MobileNav items={sections} endId="__none" homeHref="/" bookHref="/#book" bookLabel="Book a cleaning" />

      <main id="main">
        <section id="booking" className={`${styles.page} on-dark`} aria-label="Your booking">
          <div className={`wrap ${styles.wrap}`}>
            <BookingConfirmed planRequests={planRequestsOpen()} measure={googleTagOn()} />
          </div>
        </section>
      </main>
      <Footer onHome={false} />
    </div>
  );
}
