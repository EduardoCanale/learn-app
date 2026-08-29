"use client";

import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, dict, type Locale } from "@/lib/i18n";

const NEXT: Record<Locale, Locale> = { en: "es", es: "en" };

export default function LangToggle({ locale }: { locale: Locale }) {
  const router = useRouter();
  const t = dict[locale];
  const next = NEXT[locale];

  return (
    <button
      className="toggle"
      aria-label={t.langSwitch(t.langName[locale], t.langName[next])}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
        // Server components hold the strings, so the whole tree re-renders.
        // Client state — a half-typed answer mid-review — survives a refresh.
        router.refresh();
      }}
    >
      {locale}
    </button>
  );
}
