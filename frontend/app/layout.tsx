import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, EB_Garamond, Fraunces, Marcellus, Noto_Sans_TC, Noto_Serif_TC, Pinyon_Script, Playfair_Display } from "next/font/google";
import "./globals.css";
import { getLocale } from "./modules/i18n";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display"
});

// Alternative display face for the "editorial" font preset (per-site选用)
const playfairFont = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-playfair"
});

// Soft modern serif — travel/hospitality "coastal" & "boutique" presets
const frauncesFont = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces"
});

// Classical inscriptional serif — refined "resort" preset
const marcellusFont = Marcellus({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-marcellus"
});

// Elegant high-contrast book serif — "elegant" preset
const ebGaramondFont = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-ebgaramond"
});

// Flowing calligraphy script — "script" preset (latin display headings)
const pinyonFont = Pinyon_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pinyon"
});

const serifTc = Noto_Serif_TC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif-tc"
});

const sansTc = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans-tc"
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Slowfield Stays",
  description: "Curated boutique villas and private stays."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Was hardcoded "en" while the default locale is zh and the copy is Chinese,
  // so a screen reader read 中文 with an English voice and browsers offered to
  // translate the site from a language it was not written in. zh-Hant rather
  // than plain zh: the content is Traditional.
  const locale = await getLocale();
  const htmlLang = locale === "zh" ? "zh-Hant" : "en";
  return (
    <html lang={htmlLang} data-scroll-behavior="smooth" className={`${displayFont.variable} ${playfairFont.variable} ${frauncesFont.variable} ${marcellusFont.variable} ${ebGaramondFont.variable} ${pinyonFont.variable} ${serifTc.variable} ${sansTc.variable}`} suppressHydrationWarning>
      <head>
        {/* LXGW WenKai TC (霞鶩文楷) — full Traditional-Chinese kaisho/handwriting face,
            used by the "kai" font preset. next/font/google has no TC kai font, so it is
            loaded from Google Fonts (CSP allows fonts.googleapis.com + font-src https:). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@300;400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
