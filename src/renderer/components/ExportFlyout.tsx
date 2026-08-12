import { useEffect, useRef, useState } from "react";
import { useLocale } from "../i18n/LocaleContext";

export function ExportFlyout({
  onExport,
}: {
  onExport: (kind: "txt" | "html" | "pdf") => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function clearClose() {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    clearClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  }

  function pick(kind: "txt" | "html" | "pdf") {
    setOpen(false);
    onExport(kind);
  }

  return (
    <div
      ref={rootRef}
      className={`export-flyout ${open ? "is-open" : ""}`}
      onMouseEnter={() => {
        clearClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <div className={`export-flyout-rail ${open ? "is-open" : ""}`} role="menu" aria-hidden={!open}>
        <button type="button" role="menuitem" onClick={() => pick("txt")}>
          TXT
        </button>
        <button type="button" role="menuitem" onClick={() => pick("html")}>
          HTML
        </button>
        <button type="button" role="menuitem" onClick={() => pick("pdf")}>
          PDF
        </button>
      </div>
      <button
        type="button"
        className="export-flyout-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {t("export")}
        <span className="export-flyout-chevron" aria-hidden="true">
          ‹
        </span>
      </button>
    </div>
  );
}
