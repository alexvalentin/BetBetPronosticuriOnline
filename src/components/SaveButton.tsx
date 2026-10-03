"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

export default function SaveButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  const [justSaved, setJustSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 2500);
      return () => clearTimeout(t);
    }
    wasPending.current = pending;
  }, [pending]);

  return (
    <div className="save-btn-wrap">
      <button className="btn" type="submit" disabled={pending}>
        {editing ? "Editează" : "Salvează"}
      </button>
      {justSaved && <span className="saved-flash">Scor actualizat</span>}
    </div>
  );
}
