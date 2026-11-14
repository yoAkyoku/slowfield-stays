"use client";

import { Check, Globe2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useDismiss } from "./useDismiss";
import type { Locale } from "./i18n";

const labels: Record<Locale, string> = {
  en: "EN",
  zh: "中文"
};

const options: { locale: Locale; label: string }[] = [
  { locale: "zh", label: "中文" },
  { locale: "en", label: "English" }
];

export default function LanguageToggle({ locale }: { locale: Locale; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useDismiss(menuRef, () => setOpen(false), open);

  function setLanguage(nextLocale: Locale) {
    document.cookie = `site-locale=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="language-menu" ref={menuRef}>
      <button
        className={`language-toggle${open ? " is-open" : ""}`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Globe2 size={16} />
        <span>{labels[locale]}</span>
      </button>
      {open && (
        <div className="language-dropdown" role="menu">
          {options.map((option) => (
            <button
              className={option.locale === locale ? "is-selected" : ""}
              type="button"
              role="menuitem"
              key={option.locale}
              onClick={() => setLanguage(option.locale)}
            >
              <span>{option.label}</span>
              {option.locale === locale && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
