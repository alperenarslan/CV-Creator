import { motion } from "framer-motion";
import { useLocale } from "../i18n/LocaleContext";

interface Props {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useLocale();
  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(12,24,32,0.45)] p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="surface-solid w-full max-w-md rounded-[var(--radius)] p-5"
        initial={{ scale: 0.97, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.98, y: 8 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="display mt-0 mb-2 text-xl font-semibold">
          {title}
        </h3>
        {body ? <p className="mt-0 mb-4 text-sm text-[var(--ink-soft)]">{body}</p> : <div className="mb-4" />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel ?? t("cancel")}
          </button>
          <button
            type="button"
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel ?? t("confirm")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
