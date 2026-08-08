/** Print / export CV visual templates. All stay single-column for ATS safety. */

export type CVTemplateId = "ats" | "modern" | "warm" | "cool" | "retro" | "source";

/** 0 = modern … 100 = retro */
export type EraAxis = number;
/** 0 = cool … 100 = warm */
export type TemperatureAxis = number;

export interface StyleAxes {
  era: EraAxis;
  temperature: TemperatureAxis;
}

export interface TemplateDef {
  id: CVTemplateId;
  /** i18n key suffix: templateAts, … */
  nameKey: "templateAts" | "templateModern" | "templateWarm" | "templateCool" | "templateRetro" | "templateSource";
  descKey:
    | "templateAtsDesc"
    | "templateModernDesc"
    | "templateWarmDesc"
    | "templateCoolDesc"
    | "templateRetroDesc"
    | "templateSourceDesc";
  /** Strong pick for job applications */
  atsFriendly: boolean;
  recommended?: boolean;
}

export const TEMPLATE_CATALOG: TemplateDef[] = [
  {
    id: "ats",
    nameKey: "templateAts",
    descKey: "templateAtsDesc",
    atsFriendly: true,
    recommended: true,
  },
  {
    id: "source",
    nameKey: "templateSource",
    descKey: "templateSourceDesc",
    atsFriendly: true,
  },
  {
    id: "modern",
    nameKey: "templateModern",
    descKey: "templateModernDesc",
    atsFriendly: true,
  },
  {
    id: "cool",
    nameKey: "templateCool",
    descKey: "templateCoolDesc",
    atsFriendly: true,
  },
  {
    id: "warm",
    nameKey: "templateWarm",
    descKey: "templateWarmDesc",
    atsFriendly: false,
  },
  {
    id: "retro",
    nameKey: "templateRetro",
    descKey: "templateRetroDesc",
    atsFriendly: false,
  },
];

export const defaultStyleAxes: StyleAxes = { era: 28, temperature: 42 };

export function isTemplateId(value: unknown): value is CVTemplateId {
  return (
    value === "ats" ||
    value === "modern" ||
    value === "warm" ||
    value === "cool" ||
    value === "retro" ||
    value === "source"
  );
}

/**
 * Opinionated mapper from vibe sliders → template.
 * Biases toward ATS/modern for job-hunting defaults; warm/retro only when axes clearly ask for it.
 */
export function recommendTemplate(axes: StyleAxes, opts?: { wasImported?: boolean }): {
  templateId: CVTemplateId;
  reasonKey: "recommendAts" | "recommendModern" | "recommendWarm" | "recommendCool" | "recommendRetro" | "recommendSource";
} {
  const era = clamp(axes.era, 0, 100);
  const temp = clamp(axes.temperature, 0, 100);

  // Strong retro signal
  if (era >= 68) {
    return { templateId: "retro", reasonKey: "recommendRetro" };
  }

  // Warm modern / soft-modern
  if (temp >= 62 && era < 55) {
    return { templateId: "warm", reasonKey: "recommendWarm" };
  }

  // Cool modern
  if (temp <= 38 && era < 50) {
    return { templateId: "cool", reasonKey: "recommendCool" };
  }

  // Clearly modern, balanced temperature
  if (era <= 35) {
    return { templateId: "modern", reasonKey: "recommendModern" };
  }

  // Mid zone after import → keep source echo
  if (opts?.wasImported && era >= 40 && era < 68) {
    return { templateId: "source", reasonKey: "recommendSource" };
  }

  // Default opinion: ATS classic for applications
  return { templateId: "ats", reasonKey: "recommendAts" };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
}
