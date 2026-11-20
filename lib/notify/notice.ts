// A notification for Jimmy, delivered by FormSubmit (formsubmit.co) from the visitor's browser.
// The server decides whether one is sent and writes it (lib/notify/formsubmit.ts). The browser only
// passes it on, after the server has accepted the request, so nothing reaches Jimmy about a booking
// that wasn't saved. FormSubmit only delivers email: the booking itself lives in the database,
// which also enforces the daily limit.
//
// Safe to import from client components.

export interface Notice {
  /** FormSubmit's AJAX endpoint for Jimmy's address */
  endpoint: string;
  /** Sent as-is. Keys starting with "_" are FormSubmit settings; the rest become the email's table. */
  fields: Record<string, string>;
}

export type NoticeResult =
  /**
   * FormSubmit has it. `held`: the form isn't activated for this site's address yet (the first
   * submission ever, or the first after moving to a new domain). FormSubmit keeps the submission,
   * emails Jimmy an "Activate Form" link, and delivers everything it kept once he clicks it
   * (formsubmit.co/help: "FormSubmit keeps your submissions until you confirm your form", for 30 days).
   * So it isn't a failure, and sending again would only reach him twice.
   */
  | { ok: true; held?: true; message?: string }
  | { ok: false; reason: "refused" | "network"; message?: string };

export const FORMSUBMIT_AJAX = "https://formsubmit.co/ajax/";

/**
 * Posts the notice to FormSubmit and reports whether FormSubmit has it. Only a `"success": "true"`
 * answer, or FormSubmit's "needs Activation" answer (`held`), counts. An unreachable server, an
 * error status, an unreadable answer and any other refusal are failures, so the page never claims
 * Jimmy will get something FormSubmit doesn't have.
 */
export async function sendNotice(notice: Notice, signal?: AbortSignal): Promise<NoticeResult> {
  // Never post customer details anywhere but FormSubmit, whatever the server sent.
  if (!notice.endpoint.startsWith(FORMSUBMIT_AJAX)) return { ok: false, reason: "refused", message: "unexpected endpoint" };

  let res: Response;
  try {
    // FormSubmit sends the email before it answers: about 6 seconds normally, and over 20 when it's
    // busy (measured 2026-11-10). Give up too early and the customer is told it failed when it may
    // still arrive, so wait up to a minute. The button says "Sending it to Jimmy…" meanwhile.
    const timeout = AbortSignal.timeout(60_000);
    res = await fetch(notice.endpoint, {
      method: "POST",
      // Form-encoded rather than JSON: a "simple" cross-origin request, so the browser sends it
      // straight away without a preflight, and `keepalive` lets it finish if the tab is closed.
      body: new URLSearchParams(notice.fields),
      headers: { Accept: "application/json" },
      keepalive: true,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch {
    return { ok: false, reason: "network" };
  }

  const data = (await res.json().catch(() => null)) as { success?: unknown; message?: unknown } | null;
  const message = typeof data?.message === "string" ? data.message : undefined;
  if (res.ok && (data?.success === "true" || data?.success === true)) return { ok: true };
  // "This form needs Activation…". Not "…deactivated", which would mean it's switched off for good.
  if (message && /activat/i.test(message) && !/deactivat/i.test(message)) {
    console.warn("[notify] FormSubmit is holding this until the form is activated for this site:", message);
    return { ok: true, held: true, message };
  }
  console.warn(`[notify] FormSubmit didn't accept the notice (${res.status})`, message ?? "");
  return { ok: false, reason: "refused", message };
}
