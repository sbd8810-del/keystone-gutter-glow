import { today } from "@/lib/booking/service";
import { getBookingStore } from "@/lib/booking/store";

// GET /api/keepalive
// Called once a day: by Vercel on Vercel (vercel.json, "crons"), or by GitHub on any other host
// (.github/workflows/keepalive.yml, once SITE_URL is set there). Supabase's free plan pauses a database after
// a week with no activity, and a paused database means nobody can book until someone restores it
// by hand. One small read a day counts as activity, so the database never sits idle that long.
// It reads one day's taken slots and returns nothing about them.
//   200 { ok: true }    the database answered
//   503 { ok: false }   it didn't: look at Supabase (paused, or having an outage)

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  // If CRON_SECRET is set on the host, only a caller that sends it can run this: Vercel's scheduler
  // sends it automatically, and the GitHub workflow sends the CRON_SECRET stored in GitHub.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401, headers: noStore });
  }
  try {
    const day = today();
    await getBookingStore().listTaken(day, day);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (err) {
    console.error("[keepalive] the database didn't answer", err);
    return Response.json({ ok: false }, { status: 503, headers: noStore });
  }
}
