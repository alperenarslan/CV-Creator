import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AppLocale } from "../../shared/prefs";
import { t, type MessageKey } from "./messages";

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: MessageKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  setLocale,
  children,
}: {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: MessageKey) => t(locale, key),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
