"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type TeamOption = { name: string; league: string };

// Normalizes text for comparison: removes accents (diacritics), lowercases and trims.
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Team search for Meciuri / Rezultate.
 * It filters directly in the page the elements that have data-teams="Team 1|Team 2" (no new requests).
 * Days (data-day) that have no visible match are hidden too.
 */
export default function TeamSearch({ teams, scopeId }: { teams: TeamOption[]; scopeId: string }) {
  const [q, setQ] = useState(""); // text typed in the box
  const [selected, setSelected] = useState<string | null>(null); // team picked from the dropdown (active filter)
  const [open, setOpen] = useState(false); // is the dropdown open?
  const [count, setCount] = useState(0); // number of matches visible under the filter
  const boxRef = useRef<HTMLDivElement>(null);

  // Dropdown suggestions: teams containing the typed text (only from 3 letters, max 8).
  const suggestions = useMemo(() => {
    const n = norm(q);
    if (n.length < 3) return [];
    return teams.filter((t) => norm(t.name).includes(n)).slice(0, 8);
  }, [q, teams]);

  // Applies the filter on the elements in the page (and reapplies it if the page refreshes)
  useEffect(() => {
    const scope = document.getElementById(scopeId); // the container that holds the match list
    if (!scope) return;
    const target = selected ? norm(selected) : null;
    const apply = () => {
      let visible = 0;
      // Show only the matches where one of the two teams is the selected one.
      scope.querySelectorAll<HTMLElement>("[data-teams]").forEach((el) => {
        const show = !target || (el.dataset.teams ?? "").split("|").some((t) => norm(t) === target);
        el.hidden = !show;
        if (show) visible++;
      });
      // Hide the day sections that have no visible match left.
      scope.querySelectorAll<HTMLElement>("[data-day]").forEach((sec) => {
        sec.hidden = !!target && !sec.querySelector("[data-teams]:not([hidden])");
      });
      setCount(visible);
    };
    apply();
    if (!target) return;
    // While a filter is active, reapply it whenever the list changes (e.g. after an auto refresh).
    const obs = new MutationObserver(apply);
    obs.observe(scope, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [selected, scopeId]);

  // Closes the dropdown on click outside
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Selects a team: applies the filter and closes the dropdown.
  const pick = (name: string) => {
    setSelected(name);
    setQ(name);
    setOpen(false);
  };
  // Clears the search and the filter.
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
            // Typing changes the text, cancels the current filter and opens the dropdown.
            setQ(e.target.value);
            setSelected(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            // Enter picks the first suggestion; Escape closes the dropdown.
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
      {/* Suggestions dropdown (appears from 3 typed letters) */}
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
      {/* Summary of the active filter */}
      {selected && (
        <p className="tsearch-chip">
          Filtru: {selected} · {count} {count === 1 ? "meci" : "meciuri"}
        </p>
      )}
    </div>
  );
}
