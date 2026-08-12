import { useEffect, useRef, useState } from "react";
import { fullName, type CVData } from "../../shared/cv";
import { pitchFromCv } from "../../shared/tracker";
import { useLocale } from "../i18n/LocaleContext";

export function ClipboardQuickBar({
  cv,
  onToast,
}: {
  cv: CVData;
  onToast: (message: string) => void;
}) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const p = cv.personal;

  const items: { key: string; label: string; value: string }[] = [
    { key: "name", label: t("firstName"), value: fullName(cv) },
    { key: "email", label: t("email"), value: p.email },
    { key: "phone", label: t("phone"), value: p.phone },
    { key: "linkedin", label: t("linkedIn"), value: p.linkedIn },
    { key: "pitch", label: t("pitchCopy"), value: pitchFromCv(cv, locale) },
  ].filter((item) => item.value.trim());

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

  if (!items.length) return null;

  async function copy(label: string, value: string) {
    const text = value.trim();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setOpen(false);
    onToast(`${label} · ${t("copied")}`);
  }

  return (
    <div className="copy-menu" ref={rootRef}>
      <button
        type="button"
        className="btn btn-ghost !px-2.5 !py-1.5 text-xs"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {t("copyMenu")}
        <span className="copy-menu-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="copy-menu-panel" role="menu">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => void copy(item.label, item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
