"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Cat timp pagina e deschisa si exista un meci in desfasurare, cere o reimprospatare la 2 minute
// (serverul decide daca chiar sincronizeaza) si reincarca datele paginii cand s-a schimbat ceva.
export default function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    let stopped = false;

    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/refresh", { method: "POST" });
        if (!res.ok) return;
        const json = (await res.json()) as { updated?: boolean };
        if (!stopped && json.updated) router.refresh();
      } catch {
        // fara retea: incercam la urmatorul interval
      }
    };

    tick();
    const id = setInterval(tick, 120_000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [active, router]);

  return null;
}
