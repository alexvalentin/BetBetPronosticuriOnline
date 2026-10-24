"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// While the page is open and a match is in progress, it asks for a refresh every 2 minutes
// (the server decides if it really syncs) and reloads the page data when something changed.
export default function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return; // no live match -> do nothing
    let stopped = false;

    // One refresh attempt.
    const tick = async () => {
      if (document.visibilityState !== "visible") return; // skip while the tab is hidden
      try {
        const res = await fetch("/api/refresh", { method: "POST" });
        if (!res.ok) return;
        const json = (await res.json()) as { updated?: boolean };
        if (!stopped && json.updated) router.refresh(); // new data saved -> reload the page data
      } catch {
        // no network: we try again at the next interval
      }
    };

    tick(); // run once immediately
    const id = setInterval(tick, 120_000); // then every 2 minutes
    // Cleanup when the component disappears or `active` changes.
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [active, router]);

  return null; // renders nothing
}
