"use client";
import { useEffect, useState } from "react";
export const publicationWithdrawnEvent = "adme:publication-withdrawn";
// Clear only after successful global withdrawal. A normal server refresh must
// preserve unsaved fields and the form's save confirmation.
export function usePublicationChoice(initial: boolean) {
  const [checked, setChecked] = useState(initial);
  useEffect(() => {
    const clear = () => setChecked(false);
    window.addEventListener(publicationWithdrawnEvent, clear);
    return () => window.removeEventListener(publicationWithdrawnEvent, clear);
  }, []);
  return [checked, setChecked] as const;
}
