/**
 * BookmarkButton (0.3.0-dev.6, Part VI): shared star toggle used from the
 * incident list, detail header, map popup, analytics drawer and activity
 * rows. Keyboard accessible with a visible pressed state.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isBookmarked, withBookmarkToggled } from "./bookmarks";
import { putIncident } from "../../storage/repositories";
import type { Incident } from "../../types/incident";

interface Props {
  incident: Incident;
  /** Called with the updated incident so list views can update in place. */
  onChanged?: (next: Incident) => void;
  size?: number;
}

export function BookmarkButton({ incident, onChanged, size = 15 }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const active = isBookmarked(incident);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = withBookmarkToggled(incident);
      await putIncident(next);
      onChanged?.(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className={`bookmark-btn${active ? " active" : ""}`}
      aria-pressed={active}
      aria-label={active ? t("bookmarkRemove", { defaultValue: "Remove bookmark" }) : t("bookmarkAdd", { defaultValue: "Bookmark" })}
      title={active ? t("bookmarkRemove", { defaultValue: "Remove bookmark" }) : t("bookmarkAdd", { defaultValue: "Bookmark" })}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        void toggle();
      }}
      disabled={busy}
    >
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M6 3h12v18l-6-4.5L6 21V3Z" />
      </svg>
    </button>
  );
}
