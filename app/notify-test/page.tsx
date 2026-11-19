import type { Metadata } from "next";
import Link from "next/link";
import { Keystone } from "@/components/Keystone";
import { site } from "@/content/site";
import { notFound } from "next/navigation";
import { formSubmitEnabled, notifyTestEnabled } from "@/lib/notify/formsubmit";
import { NotifyTest } from "./NotifyTest";
import styles from "./notify-test.module.css";

// For Sam and Jimmy, not customers: activates FormSubmit for this site and checks that Jimmy's
// notifications arrive. Not linked from anywhere, kept out of search engines and the sitemap.
// Steps are in the README under "Notifications to Jimmy".

export const metadata: Metadata = {
  title: "Notification test",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function NotifyTestPage() {
  // Off unless NOTIFY_TEST_ENABLED=true (README, "Notifications to Jimmy").
  if (!notifyTestEnabled()) notFound();
  const enabled = formSubmitEnabled();
  return (
    <main id="main" className={styles.page}>
      <Link href="/" className={styles.home} aria-label={`${site.name} home`}>
        <Keystone className={styles.logo} />
        <span>{site.name}</span>
      </Link>
      <h1>Notification test</h1>
      <p>
        Bookings and recurring-plan requests reach Jimmy at <strong>{site.email}</strong> through FormSubmit. This page sends that address
        one clearly marked test message, the same way.
      </p>
      {enabled ? (
        <NotifyTest email={site.email} />
      ) : (
        <p className={styles.off} role="status">
          Notifications are <strong>off</strong> on this deployment, so nothing can be sent from here. They turn on with{" "}
          <code>FORMSUBMIT_ENABLED=true</code> in the live site&rsquo;s settings (on Vercel, the Production environment), followed by a
          redeploy. They never run on previews or the demo store.
        </p>
      )}
    </main>
  );
}
