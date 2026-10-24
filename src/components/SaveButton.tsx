"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

// Submit button of the prediction form. It is disabled while saving and
// shows a short "Scor actualizat" message for 2.5 seconds after a successful save.
export default function SaveButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus(); // true while the form is being submitted
  const [justSaved, setJustSaved] = useState(false);
  const wasPending = useRef(false); // remembers the previous value of `pending`

  useEffect(() => {
    // pending went from true to false = the save just finished
    if (wasPending.current && !pending) {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 2500); // hide the message after 2.5 s
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
