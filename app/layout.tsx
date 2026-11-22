import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Zilla_Slab } from "next/font/google";
import { BotanicalDefs } from "@/components/botanical/Botanical";
import { site } from "@/content/site";
import { GOOGLE_TAG_ID, GOOGLE_TAG_ID_2, GOOGLE_TAG_INLINE, googleTagOn } from "@/lib/ads";
import { allowIndexing, googleSiteVerification, publicUrl } from "@/lib/env";
import "./globals.css";

const display = Zilla_Slab({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

// Atkinson Hyperlegible was drawn for low-vision readers: phone numbers, ZIPs and times
// can't be misread. (The newer "Next" cut has no fallback metrics yet, so it would shift layout.)
const body = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicUrl),
  title: {
    default: "Gutter Cleaning in Bucks County, PA | Keystone Gutter Glow",
    template: "%s | Keystone Gutter Glow",
  },
  applicationName: site.name,
  formatDetection: { telephone: false },
  robots: allowIndexing ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: { siteName: site.name, locale: "en_US", type: "website" },
  twitter: { card: "summary_large_image" },
  verification: googleSiteVerification ? { google: googleSiteVerification } : undefined,
};

export const viewport: Viewport = {
  themeColor: "#0d2a4e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-scroll-behavior tells Next to turn off the CSS smooth scrolling during page changes.
    <html lang="en-US" className={`${display.variable} ${body.variable}`} data-scroll-behavior="smooth">
      <head>
        {/* Google tags for Jimmy's two Google Ads accounts (lib/ads.ts), first in <head> as Google asks. Production only. */}
        {googleTagOn() && (
          <>
            <script async src={`https://www.googletagmanager.com/gtm.js?id=${GOOGLE_TAG_ID}`} />
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID_2}`} />
            <script dangerouslySetInnerHTML={{ __html: GOOGLE_TAG_INLINE }} />
          </>
        )}
      </head>
      <body>
        <BotanicalDefs />
        {children}
      </body>
    </html>
  );
}
