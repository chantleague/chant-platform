"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

let adsenseScriptPromise: Promise<void> | null = null;

function loadAdSenseScript(adClient: string) {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (adsenseScriptPromise) {
    return adsenseScriptPromise;
  }

  adsenseScriptPromise = new Promise((resolve) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      "script[data-adsense-script='true']",
    );

    if (existingScript) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adClient)}`;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-adsense-script", "true");
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

  return adsenseScriptPromise;
}

type AdSlotProps = {
  slot?: string;
  className?: string;
};

export default function AdSlot({
  slot,
  className = "",
}: AdSlotProps) {
  const adClient = String(process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || "").trim();
  const adSlot = String(slot || "").trim();
  const shouldRenderAd = Boolean(adClient && adSlot);

  const adRef = useRef<HTMLModElement | null>(null);
  const hasPushedRef = useRef(false);

  useEffect(() => {
    if (!shouldRenderAd) {
      return;
    }

    let cancelled = false;

    loadAdSenseScript(adClient).then(() => {
      if (cancelled || hasPushedRef.current) {
        return;
      }

      const isFilled = adRef.current?.getAttribute("data-adsbygoogle-status") === "done";
      if (isFilled) {
        hasPushedRef.current = true;
        return;
      }

      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        hasPushedRef.current = true;
      } catch {}
    });

    return () => {
      cancelled = true;
    };
  }, [adClient, adSlot, shouldRenderAd]);

  if (!shouldRenderAd) {
    return null;
  }

  return (
    <div className={`my-8 flex w-full justify-center ${className}`.trim()}>
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60 p-2">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: "block", width: "100%", minHeight: "90px" }}
          data-ad-client={adClient}
          data-ad-slot={adSlot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}