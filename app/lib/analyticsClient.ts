"use client";

type AnalyticsEventParams = Record<
  string,
  string | number | boolean | null | undefined
>;

type GtagFunction = (
  command: "event",
  eventName: string,
  params?: AnalyticsEventParams,
) => void;

export function trackAnalyticsEvent(
  eventName: string,
  params: AnalyticsEventParams = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  const gtag = (window as Window & { gtag?: GtagFunction }).gtag;
  gtag?.("event", eventName, params);

  // Keep a console breadcrumb for quick validation during manual QA.
  console.info(`[analytics] ${eventName}`, params);
}
