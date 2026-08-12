import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  APPLICATION_STATUSES,
  followUpClipboardText,
  isFollowUpDue,
  rejectionThanksClipboardText,
  thankYouClipboardText,
  type ApplicationStatus,
  type JobApplication,
  type UpdateApplicationPatch,
} from "../../shared/tracker";
import { useLocale } from "../i18n/LocaleContext";
import type { MessageKey } from "../i18n/messages";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  refreshToken: number;
  onOpenUrl?: (url: string) => void;
  onLoadSnapshotCv?: (cv: import("../../shared/cv").CVData) => void;
  onToast?: (message: string) => void;
}

const STATUS_LABEL: Record<ApplicationStatus, MessageKey> = {
  saved: "statusSaved",
  applied: "statusApplied",
  interviewing: "statusInterviewing",
  offer: "statusOffer",
  rejected: "statusRejected",
  withdrawn: "statusWithdrawn",
};

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export function ApplicationsPanel({
  open,
  onClose,
  refreshToken,
  onOpenUrl,
  onLoadSnapshotCv,
  onToast,
}: Props) {
  const { t, locale } = useLocale();
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [filter, setFilter] = useState<ApplicationStatus | "all" | "due">("all");
  const [loading, setLoading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setApps(await window.api.loadApplications());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void reload();
  }, [open, refreshToken]);

  const dueCount = useMemo(() => apps.filter((a) => isFollowUpDue(a)).length, [apps]);

  const visible = useMemo(() => {
    if (filter === "due") return apps.filter((a) => isFollowUpDue(a));
    if (filter === "all") return apps;
    return apps.filter((a) => a.status === filter);
  }, [apps, filter]);

  if (!open) return null;

  async function patch(id: string, data: Omit<UpdateApplicationPatch, "id">) {
    const updated = await window.api.updateApplication({ id, ...data });
    if (updated) {
      setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
    }
  }

  function requestRemove(id: string) {
    setPendingDeleteId(id);
  }

  async function confirmRemove() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    const result = await window.api.deleteApplication(id);
    if (result.ok) setApps((prev) => prev.filter((a) => a.id !== id));
  }

  async function copyFollowUp(app: JobApplication) {
    await navigator.clipboard.writeText(followUpClipboardText(app, locale));
    onToast?.(t("followUpCopied"));
  }

  async function restoreSnapshot(app: JobApplication) {
    const result = await window.api.loadSnapshot(app.id);
    if (!result.ok || !result.cv) {
      onToast?.(t("snapshotMissing"));
      return;
    }
    onLoadSnapshotCv?.(result.cv);
    onToast?.(t("snapshotLoaded"));
  }

  return (
    <>
      <motion.aside
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.99 }}
        transition={{ duration: 0.2 }}
        className="surface-solid absolute inset-x-3 bottom-3 top-20 z-20 overflow-hidden rounded-[var(--radius)] sm:inset-x-4 sm:bottom-4 sm:top-24 md:inset-x-auto md:left-5 md:w-[min(520px,calc(100%-2rem))]"
      >
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
            <div>
              <h2 className="display m-0 text-lg font-semibold sm:text-xl">{t("trackerTitle")}</h2>
              <p className="mt-1 mb-0 text-xs text-[var(--ink-soft)]">
                {apps.length} {t("trackerCount")}
                {dueCount > 0 ? ` · ${dueCount} ${t("followUpDueShort")}` : ""}
              </p>
            </div>
            <button type="button" className="btn btn-ghost shrink-0" onClick={onClose}>
              {t("close")}
            </button>
          </header>

          <div className="flex flex-wrap gap-1.5 border-b border-[var(--line)] px-4 py-3 sm:px-5">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={t("filterAll")} />
            <FilterChip
              active={filter === "due"}
              onClick={() => setFilter("due")}
              label={`${t("followUpDueFilter")}${dueCount ? ` (${dueCount})` : ""}`}
            />
            {APPLICATION_STATUSES.map((status) => (
              <FilterChip
                key={status}
                active={filter === status}
                onClick={() => setFilter(status)}
                label={t(STATUS_LABEL[status])}
              />
            ))}
          </div>

          <div className="flex-1 space-y-2 overflow-auto px-4 py-4 sm:px-5 scroll-thin">
            {loading && <p className="m-0 text-sm text-[var(--ink-soft)]">{t("loading")}</p>}
            {!loading && visible.length === 0 && (
              <p className="m-0 text-sm text-[var(--ink-soft)]">{t("trackerEmpty")}</p>
            )}
            {visible.map((app) => {
              const due = isFollowUpDue(app);
              const linkHost =
                app.url && !app.url.startsWith("manual://")
                  ? hostnameFromUrl(app.url)
                  : "";
              return (
                <article
                  key={app.id}
                  className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-strong)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="display text-base font-semibold truncate">
                        {app.jobTitle || t("jobMatch")}
                      </div>
                      <div className="text-sm text-[var(--ink-soft)] truncate">
                        {app.company || "—"}
                      </div>
                      {due && (
                        <div className="mt-1 text-xs font-medium text-[#c49a4a]">
                          {t("followUpDue")}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="display text-xl font-semibold text-[var(--accent)]">
                        {app.matchScore}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-[var(--ink-soft)]">
                        {t("matchScore")}
                      </div>
                    </div>
                  </div>

                  {app.url && !app.url.startsWith("manual://") && (
                    <div className="mt-2 flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost shrink-0 py-1.5 text-xs"
                        onClick={() => onOpenUrl?.(app.url)}
                        title={app.url}
                      >
                        {t("applicationLink")}
                      </button>
                      {linkHost ? (
                        <span className="truncate text-xs text-[var(--ink-soft)]">{linkHost}</span>
                      ) : null}
                    </div>
                  )}

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="block text-xs">
                      <span className="mb-1 block text-[var(--ink-soft)]">{t("appStatus")}</span>
                      <select
                        className="field py-2 text-sm"
                        value={app.status}
                        onChange={(e) =>
                          void patch(app.id, { status: e.target.value as ApplicationStatus })
                        }
                      >
                        {APPLICATION_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {t(STATUS_LABEL[status])}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs">
                      <span className="mb-1 block text-[var(--ink-soft)]">{t("appliedAt")}</span>
                      <input
                        className="field py-2 text-sm"
                        type="date"
                        value={app.appliedAt?.slice(0, 10) || ""}
                        onChange={(e) =>
                          void patch(app.id, {
                            appliedAt: e.target.value || null,
                            status: e.target.value && app.status === "saved" ? "applied" : undefined,
                          })
                        }
                      />
                    </label>
                    <label className="block text-xs sm:col-span-2">
                      <span className="mb-1 block text-[var(--ink-soft)]">{t("followUpAt")}</span>
                      <input
                        className="field py-2 text-sm"
                        type="date"
                        value={app.followUpAt?.slice(0, 10) || ""}
                        onChange={(e) =>
                          void patch(app.id, { followUpAt: e.target.value || null })
                        }
                      />
                    </label>
                    <label className="block text-xs sm:col-span-2">
                      <span className="mb-1 block text-[var(--ink-soft)]">{t("interviewAt")}</span>
                      <input
                        className="field py-2 text-sm"
                        type="datetime-local"
                        value={toLocalInput(app.interviewAt)}
                        onChange={(e) =>
                          void patch(app.id, {
                            interviewAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                            status:
                              e.target.value && app.status !== "interviewing"
                                ? "interviewing"
                                : undefined,
                          })
                        }
                      />
                    </label>
                  </div>

                  <label className="mt-2 block text-xs">
                    <span className="mb-1 block text-[var(--ink-soft)]">{t("appNotes")}</span>
                    <textarea
                      className="field min-h-[64px] text-sm"
                      defaultValue={app.notes}
                      key={`${app.id}-notes-${app.updatedAt}`}
                      onBlur={(e) => {
                        if (e.target.value !== app.notes) {
                          void patch(app.id, { notes: e.target.value });
                        }
                      }}
                    />
                  </label>

                  {(app.status === "rejected" || app.status === "withdrawn" || app.rejectionNote) && (
                    <label className="mt-2 block text-xs">
                      <span className="mb-1 block text-[var(--ink-soft)]">{t("rejectionNote")}</span>
                      <textarea
                        className="field min-h-[56px] text-sm"
                        defaultValue={app.rejectionNote || ""}
                        key={`${app.id}-rej-${app.updatedAt}`}
                        onBlur={(e) => {
                          const value = e.target.value;
                          if (value === (app.rejectionNote || "")) return;
                          const learned = value
                            .split(/[,;\n]+/)
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .slice(0, 8);
                          void patch(app.id, {
                            rejectionNote: value || null,
                            learnedKeywords: learned.length ? learned : null,
                          });
                        }}
                      />
                      {app.learnedKeywords && app.learnedKeywords.length > 0 && (
                        <span className="mt-1 block text-[10px] text-[var(--ink-soft)]">
                          {t("learnedKeywords")}: {app.learnedKeywords.join(", ")}
                        </span>
                      )}
                    </label>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className="btn btn-ghost text-xs py-1 px-2"
                      onClick={() => void copyFollowUp(app)}
                    >
                      {t("copyFollowUp")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost text-xs py-1 px-2"
                      onClick={async () => {
                        await navigator.clipboard.writeText(thankYouClipboardText(app, locale));
                        onToast?.(t("copied"));
                      }}
                    >
                      {t("copyThankYou")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost text-xs py-1 px-2"
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          rejectionThanksClipboardText(app, locale),
                        );
                        onToast?.(t("copied"));
                      }}
                    >
                      {t("copyRejectionThanks")}
                    </button>
                    {app.interviewAt && (
                      <button
                        type="button"
                        className="btn btn-ghost text-xs py-1 px-2"
                        onClick={async () => {
                          const result = await window.api.exportIcs({ applicationId: app.id });
                          if (result.canceled) return;
                          if (!result.ok) {
                            onToast?.(result.error || "Error");
                            return;
                          }
                          onToast?.(t("icsExported"));
                        }}
                      >
                        {t("exportIcs")}
                      </button>
                    )}
                    {app.packageFolder && (
                      <button
                        type="button"
                        className="btn btn-ghost text-xs py-1 px-2"
                        onClick={async () => {
                          const result = await window.api.openPath(app.packageFolder!);
                          if (!result.ok) onToast?.(result.error || "Error");
                        }}
                      >
                        {t("openPackageFolder")}
                      </button>
                    )}
                    {app.hasSnapshot && (
                      <button
                        type="button"
                        className="btn btn-ghost text-xs py-1 px-2"
                        onClick={() => void restoreSnapshot(app)}
                      >
                        {t("loadSnapshot")}
                      </button>
                    )}
                    {app.coverLetter && (
                      <button
                        type="button"
                        className="btn btn-ghost text-xs py-1 px-2"
                        onClick={async () => {
                          const text = app.coverSubject
                            ? `Subject: ${app.coverSubject}\n\n${app.coverLetter}`
                            : app.coverLetter || "";
                          await navigator.clipboard.writeText(text);
                          onToast?.(t("copied"));
                        }}
                      >
                        {t("copyCover")}
                      </button>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[var(--ink-soft)]">
                    <span>
                      {t("analyzedAt")}:{" "}
                      {new Date(app.analyzedAt).toLocaleString(locale === "tr" ? "tr-TR" : "en-US")}
                      {app.hasSnapshot ? ` · ${t("hasSnapshot")}` : ""}
                    </span>
                    <button
                      type="button"
                      className="btn btn-danger text-xs py-1 px-2"
                      onClick={() => requestRemove(app.id)}
                    >
                      {t("remove")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </motion.aside>

      <AnimatePresence>
        {pendingDeleteId && (
          <ConfirmDialog
            open={Boolean(pendingDeleteId)}
            title={t("deleteAppConfirm")}
            body={t("deleteAppConfirmBody")}
            confirmLabel={t("delete")}
            danger
            onCancel={() => setPendingDeleteId(null)}
            onConfirm={() => void confirmRemove()}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[8px] px-2.5 py-1 text-xs font-semibold ${
        active ? "btn-primary text-white" : "btn-ghost"
      }`}
      style={active ? { background: "var(--accent)", color: "#fff", border: "none" } : undefined}
    >
      {label}
    </button>
  );
}

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : `${iso}T10:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
