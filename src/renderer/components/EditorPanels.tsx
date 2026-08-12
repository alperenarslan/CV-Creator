import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";
import type { CVData, EducationItem, ExperienceItem } from "../../shared/cv";
import { createId } from "../../shared/cv";
import { useLocale } from "../i18n/LocaleContext";
import { fileToPhotoDataUrl } from "../lib/photo";
import { ClipboardQuickBar } from "./ClipboardQuickBar";

const stepIds = ["personal", "education", "experience", "skills", "summary"] as const;
export type StepId = (typeof stepIds)[number];

interface Props {
  step: StepId;
  onStepChange: (step: StepId) => void;
  cv: CVData;
  onChange: (cv: CVData) => void;
  onToast: (message: string) => void;
}

export function EditorPanels({ step, onStepChange, cv, onChange, onToast }: Props) {
  const { t } = useLocale();
  const p = cv.personal;
  const steps: Array<{ id: StepId; label: string }> = [
    { id: "personal", label: t("personal") },
    { id: "education", label: t("education") },
    { id: "experience", label: t("experience") },
    { id: "skills", label: t("skills") },
    { id: "summary", label: t("summary") },
  ];

  return (
    <div className="surface flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius)] p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {steps.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`btn text-sm ${step === s.id ? "btn-primary" : "btn-ghost"}`}
            onClick={() => onStepChange(s.id)}
          >
            {s.label}
          </button>
        ))}
        <div className="ml-auto">
          <ClipboardQuickBar cv={cv} onToast={onToast} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto scroll-thin">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="space-y-3"
          >
            {step === "personal" && (
              <>
                <PhotoField
                  photo={p.photo}
                  onChange={(photo) => onChange({ ...cv, personal: { ...p, photo } })}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label={t("firstName")}
                    value={p.firstName}
                    onChange={(v) => onChange({ ...cv, personal: { ...p, firstName: v } })}
                  />
                  <Field
                    label={t("lastName")}
                    value={p.lastName}
                    onChange={(v) => onChange({ ...cv, personal: { ...p, lastName: v } })}
                  />
                </div>
                <Field
                  label={t("email")}
                  value={p.email}
                  onChange={(v) => onChange({ ...cv, personal: { ...p, email: v } })}
                />
                <Field
                  label={t("phone")}
                  value={p.phone}
                  onChange={(v) => onChange({ ...cv, personal: { ...p, phone: v } })}
                />
                <Field
                  label={t("address")}
                  value={p.address}
                  textarea
                  onChange={(v) => onChange({ ...cv, personal: { ...p, address: v } })}
                />
                <Field
                  label={t("birthDate")}
                  value={p.birthDate}
                  type="date"
                  onChange={(v) => onChange({ ...cv, personal: { ...p, birthDate: v } })}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label={t("nationality")}
                    value={p.nationality}
                    onChange={(v) => onChange({ ...cv, personal: { ...p, nationality: v } })}
                  />
                  <Field
                    label={t("postCode")}
                    value={p.postCode}
                    onChange={(v) => onChange({ ...cv, personal: { ...p, postCode: v } })}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label={t("linkedIn")}
                    value={p.linkedIn}
                    onChange={(v) => onChange({ ...cv, personal: { ...p, linkedIn: v } })}
                  />
                  <Field
                    label={t("portfolio")}
                    value={p.portfolio}
                    onChange={(v) => onChange({ ...cv, personal: { ...p, portfolio: v } })}
                  />
                </div>
              </>
            )}

            {step === "education" && (
              <ListBlock
                title={t("education")}
                addLabel={t("add")}
                onAdd={() =>
                  onChange({
                    ...cv,
                    education: [
                      ...cv.education,
                      { id: createId(), school: "", degree: "", startYear: "", endYear: "" },
                    ],
                  })
                }
              >
                {cv.education.map((item, index) => (
                  <EduCard
                    key={item.id}
                    item={item}
                    onChange={(next) => {
                      const education = [...cv.education];
                      education[index] = next;
                      onChange({ ...cv, education });
                    }}
                    onRemove={() =>
                      onChange({
                        ...cv,
                        education:
                          cv.education.length > 1
                            ? cv.education.filter((e) => e.id !== item.id)
                            : cv.education,
                      })
                    }
                  />
                ))}
              </ListBlock>
            )}

            {step === "experience" && (
              <ListBlock
                title={t("experience")}
                addLabel={t("add")}
                onAdd={() =>
                  onChange({
                    ...cv,
                    experience: [
                      ...cv.experience,
                      {
                        id: createId(),
                        company: "",
                        position: "",
                        startYear: "",
                        endYear: "",
                        description: "",
                      },
                    ],
                  })
                }
              >
                {cv.experience.map((item, index) => (
                  <ExpCard
                    key={item.id}
                    item={item}
                    onChange={(next) => {
                      const experience = [...cv.experience];
                      experience[index] = next;
                      onChange({ ...cv, experience });
                    }}
                    onRemove={() =>
                      onChange({
                        ...cv,
                        experience:
                          cv.experience.length > 1
                            ? cv.experience.filter((e) => e.id !== item.id)
                            : cv.experience,
                      })
                    }
                  />
                ))}
              </ListBlock>
            )}

            {step === "skills" && (
              <>
                <Field
                  label={t("spokenLanguages")}
                  value={cv.skills.languages}
                  textarea
                  onChange={(v) => onChange({ ...cv, skills: { ...cv.skills, languages: v } })}
                />
                <Field
                  label={t("softwareLanguages")}
                  value={cv.skills.softwareLanguages}
                  textarea
                  onChange={(v) =>
                    onChange({ ...cv, skills: { ...cv.skills, softwareLanguages: v } })
                  }
                />
                <Field
                  label={t("tools")}
                  value={cv.skills.computerPrograms}
                  textarea
                  onChange={(v) =>
                    onChange({ ...cv, skills: { ...cv.skills, computerPrograms: v } })
                  }
                />
                <Field
                  label={t("hobbies")}
                  value={cv.skills.hobbies}
                  textarea
                  onChange={(v) => onChange({ ...cv, skills: { ...cv.skills, hobbies: v } })}
                />
              </>
            )}

            {step === "summary" && (
              <Field
                label={t("professionalSummary")}
                value={cv.summary}
                textarea
                rows={8}
                onChange={(v) => onChange({ ...cv, summary: v })}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function PhotoField({
  photo,
  onChange,
}: {
  photo: string;
  onChange: (photo: string) => void;
}) {
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasPhoto = Boolean(photo?.startsWith("data:image/"));

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToPhotoDataUrl(file);
      onChange(dataUrl);
    } catch {
      setError(t("photoError"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="photo-field">
      <div className="mb-1.5 text-sm text-[var(--ink-soft)]">{t("photo")}</div>
      <div className="photo-field-row">
        <div className={`photo-field-preview ${hasPhoto ? "has-image" : ""}`}>
          {hasPhoto ? (
            <img
              src={photo}
              alt=""
              onError={() => {
                onChange("");
                setError(t("photoBroken"));
              }}
            />
          ) : (
            <span>{t("photoEmpty")}</span>
          )}
        </div>
        <div className="photo-field-actions">
          {/* photoHint: PDF/DOCX’ten otomatik çekilir (Gemini sadece metni okur). Yoksa buradan ekle. */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? t("photoProcessing") : hasPhoto ? t("photoChange") : t("photoAdd")}
            </button>
            {hasPhoto ? (
              <button type="button" className="btn btn-danger" onClick={() => onChange("")}>
                {t("photoRemove")}
              </button>
            ) : null}
          </div>
          {error ? <p className="m-0 text-xs text-[var(--danger,#b42318)]">{error}</p> : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
  rows = 3,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  rows?: number;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-[var(--ink-soft)]">{label}</span>
      {textarea ? (
        <textarea
          className="field min-h-[88px] resize-y"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="field"
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function ListBlock({
  title,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="display m-0 text-lg font-semibold">{title}</h3>
        <button type="button" className="btn btn-ghost" onClick={onAdd}>
          {addLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

function EduCard({
  item,
  onChange,
  onRemove,
}: {
  item: EducationItem;
  onChange: (item: EducationItem) => void;
  onRemove: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-strong)] p-3">
      <Field label={t("school")} value={item.school} onChange={(v) => onChange({ ...item, school: v })} />
      <Field label={t("degree")} value={item.degree} onChange={(v) => onChange({ ...item, degree: v })} />
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("start")} value={item.startYear} onChange={(v) => onChange({ ...item, startYear: v })} />
        <Field label={t("end")} value={item.endYear} onChange={(v) => onChange({ ...item, endYear: v })} />
      </div>
      <button type="button" className="btn btn-danger" onClick={onRemove}>
        {t("remove")}
      </button>
    </div>
  );
}

function ExpCard({
  item,
  onChange,
  onRemove,
}: {
  item: ExperienceItem;
  onChange: (item: ExperienceItem) => void;
  onRemove: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-strong)] p-3">
      <Field label={t("company")} value={item.company} onChange={(v) => onChange({ ...item, company: v })} />
      <Field label={t("position")} value={item.position} onChange={(v) => onChange({ ...item, position: v })} />
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("start")} value={item.startYear} onChange={(v) => onChange({ ...item, startYear: v })} />
        <Field label={t("end")} value={item.endYear} onChange={(v) => onChange({ ...item, endYear: v })} />
      </div>
      <Field
        label={t("description")}
        value={item.description}
        textarea
        onChange={(v) => onChange({ ...item, description: v })}
      />
      <button type="button" className="btn btn-danger" onClick={onRemove}>
        {t("remove")}
      </button>
    </div>
  );
}
