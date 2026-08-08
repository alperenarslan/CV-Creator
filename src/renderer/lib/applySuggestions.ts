import type { EditSuggestion } from "../../shared/analysis";
import type { CVData } from "../../shared/cv";

export function applySuggestions(cv: CVData, suggestions: EditSuggestion[]): CVData {
  const next: CVData = structuredClone(cv);

  for (const s of suggestions) {
    switch (s.section) {
      case "summary":
        next.summary = s.suggestedText;
        break;
      case "skills": {
        const field = (s.field || "softwareLanguages") as keyof CVData["skills"];
        if (field in next.skills) {
          next.skills[field] = s.suggestedText;
        } else {
          next.skills.softwareLanguages = s.suggestedText;
        }
        break;
      }
      case "experience": {
        if (s.targetId) {
          const item = next.experience.find((e) => e.id === s.targetId);
          if (item) {
            const field = (s.field || "description") as keyof typeof item;
            if (field === "description" || field === "position" || field === "company") {
              item[field] = s.suggestedText;
            } else {
              item.description = s.suggestedText;
            }
          }
        } else if (next.experience[0]) {
          next.experience[0].description = s.suggestedText;
        }
        break;
      }
      case "education": {
        if (s.targetId) {
          const item = next.education.find((e) => e.id === s.targetId);
          if (item) {
            item.degree = s.suggestedText || item.degree;
          }
        }
        break;
      }
      case "personal": {
        const field = (s.field || "firstName") as keyof CVData["personal"];
        if (field in next.personal) {
          next.personal[field] = s.suggestedText;
        }
        break;
      }
      default:
        break;
    }
  }

  return next;
}
