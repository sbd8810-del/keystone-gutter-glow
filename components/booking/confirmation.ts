import type { Notice, NoticeResult } from "@/lib/notify/notice";
import type { Confirmation } from "./api";
import type { Delivery } from "./Done";

/** What the confirmation shows once FormSubmit has answered. Only a real failure offers to send again. */
export function deliveryAfter(result: NoticeResult, notice: Notice): Delivery {
  if (!result.ok) return { status: "failed", notice };
  return result.held ? { status: "held" } : { status: "sent" };
}

// Hands a finished booking from the booking form to /booking-confirmed. Kept in memory for the
// page change, and in sessionStorage so a reload of the confirmation still shows it. Both stay in
// this browser tab; nothing goes anywhere.

export const CONFIRMED_PATH = "/booking-confirmed";

export interface StoredConfirmation {
  booking: Confirmation;
  /** Whether Jimmy's FormSubmit email went out. "retrying" is never stored. */
  delivery: Delivery;
  name: string;
  phone: string;
}

const KEY = "kgg:booking-confirmation";
let latest: StoredConfirmation | null = null;

export function saveConfirmation(c: StoredConfirmation) {
  const stored: StoredConfirmation =
    c.delivery.status === "retrying" ? { ...c, delivery: { status: "failed", notice: c.delivery.notice } } : c;
  latest = stored;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Private mode or storage blocked: the in-memory copy still covers the page change.
  }
}

export function loadConfirmation(): StoredConfirmation | null {
  if (latest) return latest;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConfirmation;
    return parsed?.booking?.ref ? parsed : null;
  } catch {
    return null;
  }
}
