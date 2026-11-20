"use client";

import { useRef, useState } from "react";
import { sendNotice, type Notice, type NoticeResult } from "@/lib/notify/notice";
import styles from "./notify-test.module.css";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "done"; result: NoticeResult } | { kind: "error"; message: string };

export function NotifyTest({ email }: { email: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const statusRef = useRef<HTMLDivElement>(null);

  async function send() {
    if (state.kind === "sending") return;
    setState({ kind: "sending" });
    let notice: Notice;
    try {
      const res = await fetch("/api/notify-test", { method: "POST", signal: AbortSignal.timeout(15_000) });
      const data = (await res.json().catch(() => ({}))) as { notice?: Notice; error?: string };
      if (!res.ok || !data.notice) {
        setState({ kind: "error", message: data.error ?? `The site answered ${res.status}.` });
        return;
      }
      notice = data.notice;
    } catch {
      setState({ kind: "error", message: "Couldn't reach the site." });
      return;
    }
    const result = await sendNotice(notice);
    setState({ kind: "done", result });
    requestAnimationFrame(() => statusRef.current?.focus());
  }

  const r = state.kind === "done" ? state.result : null;
  return (
    <>
      <button type="button" className="btn btn--sky" onClick={send} disabled={state.kind === "sending"} aria-busy={state.kind === "sending"}>
        {state.kind === "sending" ? "Sending…" : "Send a test message"}
      </button>
      <div ref={statusRef} tabIndex={-1} role="status" aria-live="polite" className={styles.status}>
        {r?.ok && !r.held && (
          <p className={styles.good}>
            <strong>FormSubmit confirmed it.</strong> A message titled &ldquo;Test: Keystone Gutter Glow website notifications&rdquo; is on its
            way to {email}. Check the spam folder if it isn&rsquo;t in the inbox within a few minutes.
          </p>
        )}
        {r?.ok && r.held && (
          <p className={styles.wait}>
            <strong>FormSubmit needs activating for this address.</strong> It has just emailed {email} a message with an &ldquo;Activate
            Form&rdquo; button. Once that&rsquo;s clicked, this test is delivered too, along with anything else sent before. Then send
            another test: it should say &ldquo;FormSubmit confirmed it&rdquo;.
          </p>
        )}
        {r && !r.ok && (
          <p className={styles.bad}>
            <strong>FormSubmit didn&rsquo;t confirm it, so nothing was delivered.</strong>{" "}
            {r.reason === "network" ? "It couldn't be reached." : r.message ? `It said: "${r.message}"` : "It sent no reason."} Try again in a
            minute. If it keeps failing, FormSubmit may be having an outage.
          </p>
        )}
        {state.kind === "error" && <p className={styles.bad}>Nothing was sent. {state.message}</p>}
      </div>
    </>
  );
}
