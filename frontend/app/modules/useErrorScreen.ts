"use client";

import { useEffect, useState } from "react";
import type { Locale } from "./i18n";

function localeFromCookie(): Locale {
  if (typeof document === "undefined") return "en";
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith("site-locale="))
    ?.split("=")[1] === "zh"
    ? "zh"
    : "en";
}

/**
 * What an error boundary screen needs before it can say anything: the error
 * logged, and the reader's language read off the site-locale cookie (a client
 * boundary has no server locale to ask). The site and admin error screens each
 * carried this pair. English for the first paint, so server and client agree.
 */
export function useErrorScreen(error: Error): Locale {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => { setLocale(localeFromCookie()); }, []);
  return locale;
}
