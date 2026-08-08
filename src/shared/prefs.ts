export type ThemeMode = "light" | "dark";
export type AppLocale = "tr" | "en";
export type ImportEngine = "local" | "gemini";

export interface AppPrefs {
  theme: ThemeMode;
  locale: AppLocale;
}

export const defaultPrefs: AppPrefs = {
  theme: "light",
  locale: "tr",
};
