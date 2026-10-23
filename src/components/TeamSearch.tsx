"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type TeamOption = { name: string; league: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Cautare de echipa pentru Meciuri / Rezultate.
 * Filtreaza direct in pagina elementele cu data-teams="Echipa 1|Echipa 2" (fara cereri noi).
 * Zilele (data-day) fara niciun meci vizibil se ascund si ele.
 */
export default function TeamSearch({ teams, scopeId }: { teams: TeamOption[]; scopeId: string }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const n = norm(q);
    if (n.length < 3) return [];
    return teams.filter((t) => norm(t.name).includes(n)).slice(0, 8);
  }, [q, teams]);

  // Aplica filtrul pe elementele din pagina (si reaplica daca pagina se reimprospateaza)
  useEffect(() => {
    const scope = document.getElementById(scopeId);
    if (!scope) return;
    const target = selected ? norm(selected) : null;
    const apply = () => {
      let visible = 0;
      scope.querySelectorAll<HTMLElement>("[data-teams]").forEach((el) => {
        const show = !target || (el.dataset.teams ?? "").split("|").some((t) => norm(t) === target);
        el.hidden = !show;
        if (show) visible++;
      });
      scope.querySelectorAll<HTMLElement>("[data-day]").forEach((sec) => {
        sec.hidden = !!target && !sec.querySelector("[data-teams]:not([hidden])");
      });
      setCount(visible);
    };
    apply();
    if (!target) return;
    const obs = new MutationObserver(apply);
    obs.observe(scope, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [selected, scopeId]);

  // Inchide dropdown-ul la click in afara
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (name: string) => {
    setSelected(name);
    setQ(name);
    setOpen(false);
  };
  const clear = () => {
    setSelected(null);
    setQ("");
    setOpen(false);
  };

  return (
    <div className="tsearch" ref={boxRef}>
      <div className="tsearch-box">
        <input
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Caută echipa…"
          aria-label="Caută echipa"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSelected(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && suggestions[0]) {
              e.preventDefault();
              pick(suggestions[0].name);
            }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {(q || selected) && (
          <button type="button" className="tsearch-x" onClick={clear} aria-label="Șterge căutarea">×</button>
        )}
      </div>
      {open && !selected && q.trim().length >= 3 && (
        <ul className="tsearch-dd" role="listbox">
          {suggestions.length === 0 && <li className="tsearch-empty">Nicio echipă găsită</li>}
          {suggestions.map((t) => (
            <li key={t.name} role="option" aria-selected={false}>
              <button type="button" onClick={() => pick(t.name)}>
                <b>{t.name}</b>
                <small>{t.league}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <p className="tsearch-chip">
          Filtru: {selected} · {count} {count === 1 ? "meci" : "meciuri"}
        </p>
      )}
    </div>
  );
}
