# Keystone Gutter Glow: how the website works

This is for Jimmy, and for Claude when Jimmy asks it to change something. It covers what you can't see by opening the website: how booking works behind the scenes, where every booking and referral is stored, what reaches your inbox, what you have to do by hand, and how to change things like your availability.

What the site says to customers (prices, copy, the legal pages) is on the site itself. When this file and the code disagree, the code wins. Tell Claude to fix this file.

## Contents

1. [Taking over from Sam](#taking-over-from-sam)
2. [The pieces, and where each one lives](#the-pieces-and-where-each-one-lives)
3. [What you do by hand](#what-you-do-by-hand)
4. [Changing your availability](#changing-your-availability)
5. [How booking works](#how-booking-works)
6. [Recurring plans](#recurring-plans)
7. [Referrals](#referrals)
8. [The emails you get](#the-emails-you-get)
9. [The database](#the-database)
10. [Changing prices, plans and other rules](#changing-prices-plans-and-other-rules)
11. [Google Ads](#google-ads)
12. [Settings (environment variables)](#settings-environment-variables)
13. [Hosting somewhere other than Vercel](#hosting-somewhere-other-than-vercel)
14. [Moving to keystonegutterglow.com and showing up on Google](#moving-to-keystonegutterglowcom-and-showing-up-on-google)
15. [Firewood (switched off)](#firewood-switched-off)
16. [Working on the code, with or without Claude](#working-on-the-code-with-or-without-claude)
17. [Still to confirm](#still-to-confirm)

---

## Taking over from Sam

Sam (DivWebDesign) built the site under the Website Development Agreement. Under its section 5, you now have the complete source code (this folder), and the hosting, the accounts and keeping the site running are yours. Today the code, the hosting and the database are still in Sam's accounts. Your email, Google Ads and the domain are already yours. Do these with Sam, in this order.

Some of these services require account holders to be 18 or older. If one does, a parent or guardian should own that account and add you to it.

1. **GitHub (the code).**
   1. Make a GitHub account and send Sam your username.
   2. Sam opens the repository `keystone-gutter-glow`, then Settings, General, **Transfer ownership**, and enters your username.
   3. Accept the email GitHub sends you. The repository stays private.
2. **Vercel (hosting) and Supabase (the database).** Make a Vercel account.
   - **First, try moving the project as is.**
     1. Sam opens the project in Vercel, then Settings, General, **Transfer Project**, and picks your account.
     2. If Vercel offers to move the Supabase database (under Storage) along with it, do that too. Then everything stays the same: the address, the settings, your bookings and the daily keep-alive job.
     3. Afterwards, under Settings, then Git, connect the project to your GitHub copy of the code.
   - **If Vercel won't transfer it to your account**, set up a fresh copy:
     1. Sam exports the `bookings` and `referrals` tables to CSV. That's Supabase, then Table Editor, then Export.
     2. You import your GitHub repository into Vercel, and add Supabase under Storage (free plan, Production only).
     3. Run the four files in `db/migrations` in Supabase's SQL Editor, in order, then import the CSV files.
     4. Set `BOOKING_STORE=supabase` and `FORMSUBMIT_ENABLED=true` for Production, and deploy.
     5. FormSubmit emails you one "Activate Form" link for the new address. Click it.
     6. Sam deletes his copy, so bookings don't go to two places.

     Claude can walk you through it. Ask: "Help me set up this website on my own Vercel and Supabase accounts. The README explains the pieces."
   - **Or skip Vercel entirely.** The site runs on any host that runs Node.js. See [Hosting somewhere other than Vercel](#hosting-somewhere-other-than-vercel).
3. **Your domain.** To move the site onto keystonegutterglow.com, and turn on Google search listing once it's there, follow [Moving to keystonegutterglow.com](#moving-to-keystonegutterglowcom-and-showing-up-on-google).

**Approve the legal pages and business statements.** Section 6 of the agreement makes this your call.
- These pages were drafted from your rules but **haven't been reviewed by a lawyer**: `/terms` (including the referral rules and liability limits), `/privacy` and `/recurring-plan-terms`. Read them, and have a Pennsylvania attorney look them over before you rely on them.
- Also check the claims in [Still to confirm](#still-to-confirm): "Insured", the vacuum model, and your biography, age and school, which your parent or guardian should be OK with.

**What the agreement covers from here.**
- **Defects (section 4).** Sam fixes reproducible defects in the agreed work that you report within 14 days after launch. Two rounds of reasonable revisions within scope are included.
- **No maintenance (sections 4 and 5).** After handover there's no ongoing maintenance. Hosting, accounts, updates and keeping the site running are yours.
- **Ownership (section 5).** You own the custom code, design and copy made for you. Third-party parts keep their own licenses:

  | Part | License |
  |---|---|
  | Next.js, React | MIT |
  | Leaflet (the map) | BSD 2-Clause |
  | Map tiles and data | © OpenStreetMap contributors (ODbL). The credit on the map must stay. |
  | Fonts (Zilla Slab, Atkinson Hyperlegible) | SIL Open Font License |
  | Stripe library (firewood, dormant) | MIT |
  | Logo, your photo, the before-and-after photos | Yours |

  The vacuum figures in the tour are facts from the maker's published spec sheet. None of their images or logos are used.

---

## The pieces, and where each one lives

| Piece | What it does | Where you manage it |
|---|---|---|
| **This code** (GitHub repo `keystone-gutter-glow`) | The whole website. Built with Next.js (TypeScript). | This folder, and GitHub |
| **Vercel** | Hosts the site. Every push to the `main` branch goes live in about a minute. Holds the site's settings (environment variables) and runs the daily keep-alive job. Any host that runs Node.js can replace it ([Hosting somewhere other than Vercel](#hosting-somewhere-other-than-vercel)). | vercel.com, project `keystone-gutter-glow` |
| **Supabase** | The database: every booking and referral. Postgres, free plan, US East. | In Vercel: Storage, then `keystone-gutter-glow`, then **Open in Supabase**. You sign in through Vercel; there's no separate Supabase password. |
| **FormSubmit** (formsubmit.co) | Emails you every booking, plan and referral. Free; no account or key. | Nothing to manage. It sends to the address in `content/site.ts`. |
| **Zoho** | Your mailbox for jimmyesmond@keystonegutterglow.com | zoho.com |
| **Google Ads** | Ads, plus counting each booking as a conversion | ads.google.com |

The live address is **https://keystone-gutter-glow.vercel.app** for now. keystonegutterglow.com still shows the old site until the domain is moved (see [Moving to keystonegutterglow.com](#moving-to-keystonegutterglowcom-and-showing-up-on-google)).

Nothing is ever charged online. You invoice every customer yourself.

---

## What you do by hand

The website takes bookings and tells you about them. Everything after that is yours. Nothing below happens automatically.

| When | What you do |
|---|---|
| A booking arrives | You get a "New booking KGG-XXXXX" email. Reply to it to reach the customer (Reply goes to them). If the email looks odd, open its **Check it's real** link. |
| Someone asked for an arrival time | It's in the booking's additional information. Get back to them. |
| Before each visit on a recurring plan | Text or email them **72 hours and again 24 hours** before. The plan terms promise this. |
| After each cleaning | Send the before-and-after photos and the invoice. A plan's first cleaning gets the invoice **for the whole year**. |
| A customer cancels or moves a visit | Cancel or move it in Supabase (see [Useful database jobs](#useful-database-jobs)). Free with 24 hours' notice. |
| Someone isn't happy | You promised to come back within 48 hours of them telling you, at no charge. |
| Recurring plans | Book the later visits with the customer. Each plan year, invoice the year after its first cleaning. Plans renew every year until the customer cancels. **Nothing tracks renewals for you.** |
| A referral email arrives | Text or email the friend their personal link (it's in the email). If the referrer chose $50 off a plan, call them. |
| A referred friend's house is cleaned | Pay the referrer their thank-you ($25 cash, or set up the $50 off their plan's first year), then fill in `thanked_at` on their row in the `referrals` table. |
| Every week or two | Download a backup of the database (see [Backups](#backups)). The free plan doesn't keep any. |

---

## Changing your availability

All of your availability is in one file, **`content/booking.ts`**, in the `bookingRules` block. Change it, then commit and push to `main`. The site updates in about a minute. The booking form and the server both read this same block, so they always agree.

```ts
export const bookingRules = {
  timeZone: "America/New_York",
  scheduleMode: "day-only",   // customers pick a day, not a time
  maxJobsPerDay: 4,           // the most bookings on one day
  slots: [ ... ],             // internal only, see below
  closedWeekdays: [0],        // days of the week you never work: 0 = Sunday ... 6 = Saturday
  blackoutDates: [],          // single days off, "YYYY-MM-DD"
  minLeadDays: 1,             // 1 = the earliest booking is tomorrow
  horizonDays: 60,            // how far ahead the calendar opens
};
```

| You want to | Change |
|---|---|
| Take a day off, a holiday or a vacation | Add each date to `blackoutDates`, e.g. `["2026-11-26", "2026-12-24", "2026-12-25"]`. A week away is seven dates. |
| Stop working a weekday, e.g. only weekends | `closedWeekdays`. Weekends only: `[1, 2, 3, 4, 5]`. Monday to Saturday (today): `[0]`. |
| Take fewer jobs a day | `maxJobsPerDay: 3`. Nothing else is needed. |
| Take more than 4 a day | Set `maxJobsPerDay`, **and** raise the database's own limit in Supabase's SQL editor: `update booking_settings set max_jobs_per_day = 5;`. The database uses whichever of the two is lower. It can't go above the number of `slots` (5) without adding more slots. |
| Need more notice before a job | `minLeadDays: 2` means the earliest booking is the day after tomorrow. |
| Open the calendar further ahead | `horizonDays: 90` |

**Things to know**
- **Existing bookings stay put.** Blocking a day doesn't cancel bookings already on it. Check Supabase for that day, and contact those customers.
- **The `slots` list is internal.** Customers only pick a day. The server files each job under the first free slot so the database can stop double booking. Leave the slots alone, unless you want more than 5 jobs a day.
- **"Today" is Bucks County time,** whatever time zone the server or the customer is in.

**Asking Claude to do it.** Something like this works:

> "Block off November 26 and December 22 to January 2 in the booking calendar, then push it."
> "From now on I only work Saturdays. Change the booking rules and push."
> "Make it 3 jobs a day."

Claude should edit `bookingRules` in `content/booking.ts`, run `npm test`, then commit and push to `main`. For more than 4 jobs a day, it should also give you the SQL line to run in Supabase.

---

## How booking works

```
Booking form (browser)                    Server (Vercel)                         Database (Supabase)
--------------------------------          ---------------------------------       ----------------------------
1. House, rinse, plan (optional)
2. Picks a day  ------------------------> /api/availability: which days are open
3. Address and contact
4. Review, then Book  ------------------> /api/bookings: checks everything again,
                                          works out the price itself      ------> create_booking(): one atomic
                                                                                   step, refuses a full day
5. Sends your email (FormSubmit) <------- hands back the email to send
6. /booking-confirmed (Google Ads counts the booking here)
```

**What the server checks, whatever the browser sends**
- **The address.** It must be in Pennsylvania, **and its ZIP must be on the service-area list.** That's the 71 Pennsylvania ZIPs inside 15 miles of Jamison, in `content/area.ts`. Anything else is refused: New Jersey, Levittown, Norristown, Pittsburgh, even a ZIP just past the edge. The ZIP check on the home page uses the same list, and the map shades the same area: the 15-mile circle cut off at the Delaware River, so none of New Jersey is included.
- **The day.** Not in the past, not today (unless you change `minLeadDays`), not past the horizon, not a closed weekday or blackout date, and not full.
- **The price.** The server works it out from `content/pricing.ts`, the plan discount and any referral. It ignores any price the browser sends. See `content/quote.ts`.
- **A plan needs agreement.** A plan booking needs the "I agree to the Recurring Plan Terms" box ticked. The version of the terms they agreed to is saved with the booking.
- **Spam.** A hidden "honeypot" field catches bots, and each address can only make so many requests a minute.

**Two people can't book the last spot**
- The database itself enforces the daily limit, with a per-day lock and a one-booking-per-slot rule. So if two people press Book for the last spot at the same moment, one gets it and the other is sent back to pick another day.
- **Double taps and retries.** Each attempt carries an "idempotency key", so a double tap or a dropped connection gives back the same booking instead of making a second one. The key only stays the same while the booking stays the same: if the customer changes the day or anything else, the next try is a new booking attempt.

**After booking**
- The customer lands on `/booking-confirmed`. It shows their reference number, day, address and price, plus "Add to my calendar". It also has "Make it recurring" (see [Recurring plans](#recurring-plans)).
- The confirmation lives only in that browser tab. **No email goes to the customer.** The site doesn't promise one.
- **If your email fails to send** (FormSubmit down, the customer goes offline), the booking is still saved. The customer is told you haven't been notified yet, and gets "Try sending again" and your number.

**Prices** (`content/pricing.ts`): one-story $169, townhome $199, two-story $229, "bigger than that" from $249, and the rinse +$25. "From" prices are confirmed with the customer before the visit. Prices are whole dollars, because the database stores whole dollars.

---

## Recurring plans

**The rules** (`planRules` in `content/plans.ts`; the full wording is on `/recurring-plan-terms`):
- Every 3, 4 or 6 months, or once a year. Every 6 months is recommended.
- **10% off every cleaning**, rounded down to the whole dollar so it's never less than 10%. Two-story: $229 becomes $206.
- **The whole year is paid up front**, in one invoice after the year's first cleaning. For a two-story every 6 months, that's $412.
- **It renews every year until the customer cancels.** They cancel by call, text or email.
- **There's no cancellation fee.**
- **No refunds.** Payments already made aren't refunded, including for cleanings they haven't had yet.
- 72- and 24-hour notice before every visit. They don't need to be home.
- If **you** end a plan for a reason that isn't the customer's doing, you refund the cleanings they've paid for but not had.

**Two ways a plan starts**
1. **While booking.** The customer picks a plan on the first step and ticks the agreement. The booking is saved at the plan price.
2. **"Make it recurring" on the confirmation page, after a one-time booking.** The plan starts with the cleaning they just booked.
   - **The booking changes.** The server moves that booking to the plan price and adds the plan to its notes. It keeps any referral discount.
   - **You get an email.** It's "Recurring plan added to booking KGG-…", showing the old price and the new one.
   - **Safeguards:**
     - It only works on a booking still to come, made with the same email.
     - Sending it twice changes nothing the second time.
     - A booking already on a different plan is refused.
   - **If the database can't be reached** at that moment, the request still reaches you by email, and you change the booking's price by hand.
   - Code: `lib/plan/attach.ts`.

**How to spot a plan booking.** Its notes start with "Recurring plan: Every 6 months, 10% off ($206 a cleaning instead of $229; $412 for the year, …). Agreed to the Recurring Plan Terms (version 2026-11-14.2)."

**Terms versions.**
- `2026-11-11`: before the 10% discount.
- `2026-11-12`: with the discount and a 30% cancellation fee.
- `2026-11-14`: no fee.
- `2026-11-14.2`: no fee, and no refunds on cancelling.

Don't charge anyone a cancellation fee, whatever version they agreed to. Whenever the plan terms change, bump `planRules.termsVersion`.

---

## Referrals

**The rules** (`content/referral.ts`):
- The person who refers gets **$25 cash**, or **$50 off the first year of a recurring plan** (first year only, not renewals). Their choice.
- The friend gets **$30 off a cleaning.**
- The thank-you is paid **only after the friend has booked and their house is fully cleaned**. A referral that never becomes a booking is worth nothing.

**How it flows**
1. **The customer fills in `/referrals`.** (The old `/refer` address still takes people there.) They give their name and phone, their thank-you choice, and the friend's name and phone or email. They tick a box saying the friend is happy to hear from you.
2. **The server saves it** in the `referrals` table with a **personal 8-character code**, like `K7PQ2M9X`. If the same person sends the same friend again before that code is used, it reuses the same row and code instead of making a second one.
3. **You get a "New referral" email.** It has the friend's details, their personal link (`…/referred/K7PQ2M9X`), what you'll owe and when, and a **Check it's real** link. The person who referred never sees the code.
4. **You send the friend their link.**
5. **The friend books on that page.** The $30 comes off. If they choose a plan, the $30 comes off the first cleaning, and so off the first year's payment.

**What stops abuse** (checked by the server, and the database for the last one):
- **The code has to exist.** Codes can't be guessed: there are about 650 billion.
- **The booking must use the friend's details.** It has to use the phone number or email the referrer gave for the friend. A forwarded link doesn't work for anyone else.
- **The referrer can't use it.** The referrer's own phone or email is refused, and the referral form won't take the referrer's own phone or email as the friend's.
- **It works once.** The database uses the code up in the same step as the booking, so two tries at once still give one booking. A booking that fails (full day) leaves the code unused.
- **Who referred them** comes from the database, never from anything the customer types.

**Your referral list is the `referrals` table** in Supabase. `booking_ref` fills in when the friend books, and you fill in `thanked_at` when you've paid. See [Useful database jobs](#useful-database-jobs) for the "who do I owe?" query.

**What a link page can show**
- **Real and unused:** the $30-off prices and the booking form.
- **Used:** "This referral link has been used."
- **Unknown or mistyped:** "That referral link isn't valid."
- **Plain `/referred` with no code:** it explains that the discount comes with a personal link.

These pages are hidden from Google.

---

## The emails you get

Every email comes from FormSubmit to jimmyesmond@keystonegutterglow.com. It's sent from the customer's browser right after the server accepts the request. The server never emails anyone itself.

| Subject | When | What's in it |
|---|---|---|
| New booking KGG-XXXXX: date | Someone booked | Reference, day, address, house, price (and plan or referral details), name, phone, email, notes, **Check it's real** link |
| Recurring plan added to booking KGG-XXXXX | "Make it recurring" after booking | The plan, the booking's old and new price, the year's total, the Check link |
| Recurring plan request | The rare case the booking couldn't be updated | The plan and the customer's details. Change the booking by hand. |
| New referral: friend, from referrer | Someone used `/referrals` | Both people's details, the friend's personal link and code, the thank-you owed, the Check link |

**Reply** goes straight to the customer. A referral without an email address has no Reply address.

**Is an email real?** Anyone who knows your address could send you something that looks like a booking. Every real email has a **Check it's real** link.
- **Real email:** the link opens a page showing that booking or referral straight from the database.
- **Fake email:** a made-up email can't have a working link. Its link says "This link wasn't made by the website."
- **How it works:** the links are signed with a secret only the server knows. That's `NOTICE_SECRET` if it's set, otherwise one made from the Supabase server key. If either one changes, links in older emails stop working; nothing else is affected.
- **Don't forward these emails.** The pages are hidden from Google, but they show customer details to anyone with the link.

**If the emails stop**
1. Check spam.
2. Check the `bookings` table. Bookings always save, emailed or not.
3. **Send yourself a test:**
   1. In Vercel, under Settings then Environment Variables, set `NOTIFY_TEST_ENABLED` to `true` for Production. On another host, set it in that host's environment settings.
   2. Redeploy.
   3. Open `/notify-test` and press "Send a test message".
   4. Set the variable back to off and redeploy. The page is a 404 while it's off, so strangers can't use it to fill your inbox.
4. **After moving to a new domain**, FormSubmit sees a new site and sends one more "Activate Form" email. Click it. FormSubmit holds anything sent before you click it and delivers it once you do, so the customer's page says they're booked rather than showing an error.

**Switching emails off.** Remove `FORMSUBMIT_ENABLED` from the host's settings and redeploy. Bookings keep working; you just aren't told. FormSubmit never runs on preview copies (Vercel previews, or `SITE_ENV=preview` on another host) or the demo store, so test bookings never reach you.

---

## The database

Supabase (Postgres). Open it from Vercel: Storage, then `keystone-gutter-glow`, then **Open in Supabase**. **Table Editor** is a spreadsheet view; **SQL Editor** runs queries.

### Tables

**`bookings`**, one row per booking:

| Column | Meaning |
|---|---|
| `ref` | The reference the customer sees, e.g. `KGG-7F3K2` |
| `service_date` | The day booked |
| `slot_id` | Internal slot (`08:00` … `16:00`). Customers never see it. It isn't an arrival time. |
| `package_id` | `one-story`, `townhome`, `two-story` or `large` |
| `rinse` | Whether they added the rinse |
| `price_dollars` | The price of **this** cleaning, after any plan or referral discount |
| `price_is_estimate` | `true` for "from" prices, to confirm before the visit |
| `customer_name`, `customer_email`, `customer_phone` | Contact (phone is 10 digits, no punctuation) |
| `street`, `city`, `zip` | Where the gutters are |
| `notes` | Their additional information, plus the plan line and referral line when there are any |
| `status` | `confirmed` or `cancelled`. A cancelled booking frees its spot. |
| `idempotency_key`, `id`, `created_at` | Internal |

**`referrals`**, one row per referral: `code`, `referrer_name`, `referrer_phone`, `referrer_email`, `reward` (`cash` or `plan`), `friend_name`, `friend_phone`, `friend_email`, `friend_town`, `notes`, `created_at`. Then:
- `booking_ref`, `booked_at`: filled in when the friend books.
- `thanked_at`: **you** fill this in when you've paid the thank-you.

**`booking_settings`**, one row: `max_jobs_per_day`, the database's own daily limit (4).

**`firewood_orders`**: for the switched-off firewood shop. Empty.

### What protects it
- **Row-level security** is on for every table. The public key can't read or write anything.
- **Only the website's server key** (`SUPABASE_SERVICE_ROLE_KEY`, in the host's settings) can. Never share it or put it in the website's browser code.
- **Two kinds of server key.** The site accepts both: the older `service_role` key (starts `eyJ`) and the newer secret key (starts `sb_secret_`). Supabase says it's phasing out the older kind by the end of 2026. If it stops working, make a secret key in Supabase (Settings, then API Keys), put it in `SUPABASE_SERVICE_ROLE_KEY`, and redeploy. "Check it's real" links in older emails then stop working (see [The emails you get](#the-emails-you-get)); new ones work.
- **`create_booking()`** is the one database function the site books through. It enforces the daily limit and the one-booking-per-slot rule, and uses up referral codes.
- **A trigger** re-checks the daily limit even for rows added by hand.

### Useful database jobs

Paste these into the **SQL Editor** and press Run. Change the quoted values first.

```sql
-- Upcoming bookings
select ref, service_date, customer_name, customer_phone, city, price_dollars, notes
from bookings where status = 'confirmed' and service_date >= current_date
order by service_date;

-- Cancel a booking (frees the spot)
update bookings set status = 'cancelled' where ref = 'KGG-XXXXX';

-- Move a booking to another day. If that day already has a booking in the same slot, also
-- change slot_id to a free one: '08:00', '10:00', '12:00', '14:00' or '16:00'.
update bookings set service_date = '2026-12-01' where ref = 'KGG-XXXXX';

-- Everyone on a recurring plan
select ref, service_date, customer_name, customer_phone, notes
from bookings where status = 'confirmed' and notes like '%Recurring plan:%'
order by service_date;

-- Referral thank-yous you owe (friend booked, cleaning date has passed, not paid yet)
select r.referrer_name, r.referrer_phone, r.reward, r.friend_name, b.ref, b.service_date
from referrals r join bookings b on b.ref = r.booking_ref
where r.thanked_at is null and b.status = 'confirmed' and b.service_date < current_date
order by b.service_date;

-- Mark a thank-you as paid
update referrals set thanked_at = now() where code = 'K7PQ2M9X';

-- Let a friend use their link again (say their booking was cancelled)
update referrals set booking_ref = null, booked_at = null where code = 'K7PQ2M9X';
```

The database won't let a move go over the daily limit: the update is refused with "day_full".

### Free plan: pausing and backups

**Pausing.** Supabase pauses a free database after a week with no activity. A paused database means nobody can book: the booking form shows "call us".
- **What stops it:** Vercel runs `/api/keepalive` every day at 13:00 UTC (`vercel.json`). It does one small read, which counts as activity. You can see it in Vercel under Settings, then Cron Jobs. On any other host, a GitHub workflow does the same once you turn it on (see [Hosting somewhere other than Vercel](#hosting-somewhere-other-than-vercel)).
- **If it pauses anyway:** open the project in Supabase and press **Restore**.

### Backups

The free plan keeps **no backups**. If a row is deleted or the project is lost, it's gone. Two options:
- **Free:** every week or two, in Table Editor, open `bookings` and use **Export to CSV**. Do the same for `referrals`. Keep the files somewhere safe.
- **Supabase Pro ($25/month):** daily backups, and it never pauses.

### Changing the database's structure

Structure changes live in `db/migrations/` as numbered SQL files. All four have been run on the live database: `001` bookings, `002` hardening, `003` firewood orders, `004` referrals.
- **A new change** gets a new numbered file, written so it's safe to run twice.
- **Run it** in Supabase's SQL Editor **before** pushing code that needs it.
- **Tests** run every migration against a real in-memory Postgres (`tests/sql.test.ts`).

---

## Changing prices, plans and other rules

Everything a customer sees comes from the `content/` folder. Change it there and every page, the server's checks and the search markup follow.

| File | What's in it |
|---|---|
| `content/pricing.ts` | House types, prices, the rinse. **The server charges from this.** |
| `content/plans.ts` | Plan frequencies and `planRules`: discount, notice hours, no fee, no refunds, terms version |
| `content/referral.ts` | Referral amounts: $30, $25, $50 |
| `content/booking.ts` | Availability (see [Changing your availability](#changing-your-availability)), and the "additional information" box wording |
| `content/area.ts` | The service area: the ZIP list (15 miles, Pennsylvania only), the radius, the map's shape (`serviceShape`), and the towns |
| `content/site.ts` | Business name, phone, email, policies (24-hour reschedule, 48-hour come-back, late-cancel fee), the "Insured" flag |
| `content/legal.tsx` | Terms of Service, Privacy Policy, Recurring Plan Terms |
| `content/faqs.ts` | FAQ (also feeds Google's FAQ markup) |
| `content/owner.ts`, `services.ts`, `machine.ts` | Your section, what a cleaning includes, the vacuum tour |

**Rules worth knowing before changing anything**
- **Plan terms.** If you change anything in `planRules` or the plan terms, bump `planRules.termsVersion` and update `content/legal.tsx`, so every new agreement records the right version.
- **Prices.** Prices are whole dollars. The plan price is rounded down.
- **Service area.** Every listed ZIP has its distance in miles, so **shrinking** the radius is a filter: drop the ZIPs past the new radius and set `serviceRadius.miles`. **Widening** it means adding ZIPs back from the Census data. Either way, rebuild `serviceShape` (the map's shaded area: the circle clipped to Pennsylvania's Census boundary, so New Jersey stays out). Ask Claude; `content/area.ts` says how both were built.
- **Your home address** is never in the code or on the site. Only a center rounded to about half a mile is.

---

## Google Ads

- **The tag.** Google tag container `GTM-MVK64PHQ` loads on every page of the live site, and only there: never on previews or local runs (`lib/ads.ts`, `app/layout.tsx`). It fires your Google Ads tag (account `18566097431`). That was confirmed working on 2026-11-14. Vercel tells the site which copy is live on its own. On any other host, the live site needs `SITE_ENV=production`, or the tag and conversions stay off.
- **Conversions.** Each booking counts once as a **Purchase** conversion (`AW-18566097431/YzNNCIGmpLUdEJfUgJVF`). It's worth $1, with the booking reference as the transaction ID. It fires on `/booking-confirmed`, once per booking, and never when that page is opened without a booking.
- **Checking it.** In Google Ads, under Goals then Conversions, the first real booking should appear within a few hours. Don't make a test booking on the live site: it writes to the real database and emails you.

---

## Settings (environment variables)

In Vercel: the project, then **Settings**, then **Environment Variables**. After changing one, **redeploy** (Deployments, then the latest one's "⋯" menu, then Redeploy). On any other host, the same names go in that host's environment settings, and it needs a redeploy too.

| Variable | What it does | Live site now |
|---|---|---|
| `BOOKING_STORE` | `supabase` = real bookings | `supabase` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | The database connection (added by Vercel's Supabase integration; on another host, copied from Supabase by hand) | set |
| `FORMSUBMIT_ENABLED` | `true` = email you every booking, plan and referral | `true` |
| `NOTIFY_TEST_ENABLED` | `true` = `/notify-test` works. Only while testing. | off |
| `NOTICE_SECRET` | Optional secret for the Check it's real links | not set (uses the Supabase key) |
| `CRON_SECRET` | Optional. Only callers that send it can run the keep-alive: Vercel's scheduler, or the GitHub workflow off Vercel. | not set |
| `SITE_URL` | The site's real address, once the domain moves. Required on any host other than Vercel. | not set |
| `SITE_ENV` | Other hosts only: `production` on the live site (turns on the Google tag), `preview` on a test copy. Vercel works this out on its own. | not needed on Vercel |
| `ALLOW_INDEXING` | `true` = Google may list the site | **not set: the site is hidden from Google** |
| `GOOGLE_SITE_VERIFICATION` | Search Console's HTML-tag token | not set |
| `FIREWOOD_PREVIEW`, `SITE_MODE`, `STRIPE_*`, `RESEND_API_KEY` | Firewood only (switched off) | |
| `BOOKING_DEMO_MODE`, `BOOKING_DEMO_SEED` | Demo store for preview copies. Never on the real site. | |

All of them are explained in `.env.example`.

---

## Hosting somewhere other than Vercel

Nothing in the site needs Vercel. It runs on any host that runs a Node.js server, such as Render, Railway, Netlify, Fly.io or a server of your own. A host that only serves plain files (GitHub Pages, basic web hosting) won't work, because booking runs on the server.

Claude can do the move with you. Ask: "Help me move this website from Vercel to (the host). Follow the README section 'Hosting somewhere other than Vercel'."

**1. The database.** The Supabase database was made through Vercel, so it's managed through a Vercel account. To leave Vercel completely, give the site its own Supabase project:
1. Make a free account and project at supabase.com. US East is closest.
2. In the old project's Table Editor, export `bookings` and `referrals` to CSV.
3. In the new project's SQL Editor, run the four files in `db/migrations`, in order.
4. In the new project's Table Editor, import `bookings` first, then `referrals`, because each used referral points at a booking.
5. Copy the project URL (the **Connect** button shows it) and a **secret key** (Settings, then API Keys; it starts `sb_secret_`). Never use the publishable key.

**2. The host.**
- Connect it to your GitHub repository, so each push to `main` goes live.
- Node.js 20.9 or newer. `package.json` asks for it, and most hosts pick it up from there.
- Build command `npm ci && npm run build`. Start command `npm start`. It listens on the port the host gives it (`PORT`), or 3000.

**3. The settings.** Put these in the host's environment settings **before the first build**, because some are read while building:

| Variable | Value |
|---|---|
| `SITE_ENV` | `production`. Vercel says this on its own; other hosts need it, or the Google tag and booking conversions stay off. |
| `SITE_URL` | Where the site lives, e.g. `https://keystonegutterglow.com`. Without it, the links in your emails point at keystonegutterglow.com. |
| `BOOKING_STORE` | `supabase` |
| `SUPABASE_URL` | The project URL from step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | The secret key from step 1. The name says "service role", but the site accepts either kind of key. |
| `FORMSUBMIT_ENABLED` | `true` |
| `CRON_SECRET` | A long random password, for the keep-alive below |
| `ALLOW_INDEXING` | `true`, once the site is on keystonegutterglow.com |

Then deploy, open the site, and check that the booking calendar shows open days. If FormSubmit sends an "Activate Form" email, click it.

**4. The daily keep-alive.** Vercel ran it from `vercel.json`. Other hosts ignore that file, so GitHub runs it instead, for free (`.github/workflows/keepalive.yml`, every day at 13:30 UTC). It does nothing until you turn it on:
1. On GitHub, open the repository, then Settings, then Secrets and variables, then Actions.
2. Under **Variables**, add `SITE_URL` with the site's address.
3. Under **Secrets**, add `CRON_SECRET` with the same value as on the host.
4. In the **Actions** tab, open "Keep the database awake" and press **Run workflow**. A green check means the database answered. A red X means the site is down or the database is paused.

GitHub emails about failed scheduled runs to whoever created the workflow (Sam), unless someone disables and re-enables it. So in the Actions tab, open the workflow and use its "⋯" menu to **Disable** it, then **Enable** it. From then on the emails come to you.

**5. Afterwards.**
- **Move the domain** to the new host (its settings show the DNS records), then **delete the Vercel project**, so bookings don't go to two places. Before deleting it, check the old database for bookings or referrals made since your export, and add them to the new one.
- **Privacy policy.** It names Vercel as the host. Change that line in `content/legal.tsx` ("Who we share it with") to the new host, and update `LEGAL_UPDATED`.
- **The host's own address** (like `yoursite.onrender.com`) keeps working next to your domain. Every page tells Google that `SITE_URL` is the real address, so that's fine. If the host can redirect its own address to your domain, turn that on.
- **"Check it's real" links** in emails from before the move stop working, because the new database has a different key. Links in new emails work.
- **A test copy** on another host needs `SITE_ENV=preview` and `BOOKING_DEMO_MODE=true`, with no Supabase settings. It then uses fake bookings, never emails you, and never counts in Google Ads.

---

## Moving to keystonegutterglow.com and showing up on Google

Right now every page tells Google not to list it (`noindex`), and keystonegutterglow.com still shows the old GitHub Pages site. To switch over:

1. **Point the domain at Vercel.** In Vercel, open Settings, then Domains. Add `keystonegutterglow.com`, then add the DNS records Vercel shows at the domain registrar. Remove the old GitHub Pages records. Keep the Zoho email records. (On another host, add the domain in that host's settings and use the records it shows.)
2. **Set `SITE_URL`.** Once Vercel says the domain is valid, set `SITE_URL` on Production to the address the site ends up on. If Vercel sends `keystonegutterglow.com` to `www.keystonegutterglow.com`, that's `https://www.keystonegutterglow.com`; otherwise `https://keystonegutterglow.com`. From then on the `.vercel.app` address redirects to the domain. Email links (Check it's real, referral links) use the new address too; old links keep working through the redirect.
3. **Let Google list the site.** Set `ALLOW_INDEXING=true` on Production, then redeploy.
4. **Reactivate FormSubmit.** It sends one more "Activate Form" email for the new address. Click it. Bookings made before you click it arrive once you do.
5. **Google Search Console** (your Google account): add the domain, verify it with the DNS record it gives, and submit the sitemap: your `SITE_URL` followed by `/sitemap.xml`.
6. **Google Business Profile.** Set it up as a service-area business, so your address stays hidden. Add Bucks, Montgomery and Philadelphia Counties, and not New Jersey. Ask real customers for reviews.

---

## Firewood (switched off)

There's a complete firewood shop in the code, with Stripe card payment, an order page and an order database table. It's been **switched off since 2026-11-09**: `firewoodSwitch.off` is `true` in `content/season.ts`, so every firewood page is a 404 and checkout is closed.

Before turning it back on, all of these are needed:
- a Stripe account in your name;
- a decision on how you hear about paid orders (FormSubmit can't send those, because they're confirmed by Stripe, not a browser);
- every price and rule in `content/firewood.ts` confirmed;
- sales tax sorted out.

The code refuses real payments until all of that is true (`lib/firewood/gate.ts`). Ask Claude to walk you through it when the time comes.

---

## Working on the code, with or without Claude

**Running it on your computer** (needs Node 20.9 or newer):

```bash
npm install
npm run dev        # http://localhost:3000, with a demo calendar and fake bookings
npm test           # about 200 checks, no internet or passwords needed
npm run typecheck
npm run build
```

The local copy never touches the real database or your inbox. It uses an in-memory demo store, and emails are off.

**Putting a change live:** commit, then push to `main`. Vercel builds it and it's live in about a minute. If the build fails, the old version stays up. Other hosts connected to GitHub work the same way.

**Running the real build yourself** (any computer or server): `npm ci`, `npm run build`, then `npm start`, with the settings from [Hosting somewhere other than Vercel](#hosting-somewhere-other-than-vercel).

**Where things are**

```
content/      everything the business decides: prices, rules, text, the legal pages
app/          pages and API routes (app/api/*: availability, bookings, plan-requests, referrals, keepalive)
components/   the pieces of each page (booking form, plan dialog, referral form, ...)
lib/booking/  booking logic: dates, availability rules, validation, the database stores
lib/notify/   the emails to you (formsubmit.ts) and the Check it's real links (check.ts)
lib/plan/     adding a plan to an existing booking
lib/referral/ referral codes and the referral form's checks
db/migrations SQL for the database's structure
.github/      the daily keep-alive workflow for hosts other than Vercel
tests/        the automated checks
DESIGN.md     why the site looks the way it does
```

**Guidelines for Claude**
- **Rules live in one place.** Change the rule in `content/` and let pages and the server read it. Don't copy numbers into pages.
- **Check with `npm test`** after any change. Add a test for any new rule.
- **The server decides prices and eligibility**, never the browser.
- **The live database.** Never change it except through a numbered migration in `db/migrations/` that Jimmy runs, and never make test bookings or referrals on the live site.
- **No new fees, refunds, taxes or promises.** Never invent them on Jimmy's behalf: ask him.
- **Plan terms.** When they change, bump `planRules.termsVersion`.
- **Privacy.** Don't put Jimmy's home address anywhere.
- **No host lock-in.** Don't tie code to Vercel. Use `deployEnv()` (`lib/deploy.ts`) to tell the live site from a test copy, never `VERCEL_ENV` directly.
- **Finishing.** Commit and push to `main` only when Jimmy says to. Afterwards, check the live site (https://keystone-gutter-glow.vercel.app until the domain moves).

---

## Still to confirm

- **"Insured"** shows in the footer. Make sure it's true, or set `insured: false` in `content/site.ts`.
- **The vacuum.** The vacuum tour describes the Gutter Pro Vac Cyclone Classic Pro with the 40 ft pole. If yours is different, the figures in `content/machine.ts` need changing.
- **Late cancellations.** The site says a one-time cleaning cancelled inside 24 hours "may" have a fee. To set an amount, put it in `lateCancelFeeDollars` in `content/site.ts`. To drop the idea, ask Claude to remove the wording.
- **Daily limit.** It's 4 jobs a day. Your agreement mentions 3.
- **Legal review.** Have an attorney review the Terms, Privacy Policy and Recurring Plan Terms. Open questions include:
  - whether Pennsylvania's home improvement contractor registration (HICPA) applies to gutter cleaning;
  - federal rules on online auto-renewal (ROSCA), including whether to send a reminder before each renewal;
  - text-message consent;
  - running the LLC while you're under 18.
