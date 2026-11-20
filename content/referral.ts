// The referral program (Sam, for Jimmy, 2026-11-12):
//  - A customer refers someone on /referrals by giving their own details and their friend's.
//  - Jimmy gets in touch with the friend and sends them /referred, where a cleaning is $30 off.
//  - The customer's thank-you is their choice of $25 cash or $50 off the first year of a recurring
//    plan (first year only, not renewals; Sam, 2026-11-14). If they pick the plan, Jimmy calls
//    them to set it up.
//  - The thank-you is paid only AFTER the friend's house is fully cleaned, and a referral only
//    counts when it becomes an actual booking.
// The Terms of Service has the same rules in its "Referrals" section (content/legal.tsx).

export const referralPaths = {
  /** Where customers refer someone. The page is app/referrals; the old /refer redirects here (next.config.ts). */
  refer: "/referrals",
  /** The page Jimmy sends referred friends: booking with $30 off */
  friend: "/referred",
} as const;

export const referralRules = {
  /** Off the one cleaning a referred friend books from the referral page, in dollars */
  friendDiscount: 30,
  /** The referrer's thank-you, their choice */
  cashReward: 25,
  /** Off the first year of a recurring plan only */
  planCredit: 50,
};

export type ReferralReward = "cash" | "plan";

export const referralRewards: Record<ReferralReward, { label: string; detail: string }> = {
  cash: {
    label: `$${referralRules.cashReward} cash`,
    detail: "Paid to you after their gutters are cleaned.",
  },
  plan: {
    label: `$${referralRules.planCredit} off the first year of a recurring plan`,
    detail: "Jimmy will call you to set it up.",
  },
};

export function isReferralReward(v: unknown): v is ReferralReward {
  return v === "cash" || v === "plan";
}

/** The one-line offer, for the home page strip, the footer of the confirmation and the FAQ */
export const referralOffer = `They get $${referralRules.friendDiscount} off a cleaning. You get $${referralRules.cashReward} cash, or $${referralRules.planCredit} off the first year of a recurring plan.`;
