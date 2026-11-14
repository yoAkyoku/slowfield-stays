import { IconFacebook, IconInstagram, IconLine, IconThreads, IconTikTok } from "./icons/SocialIcons";
import type { Locale } from "./i18n";

export type SocialLinks = {
  instagram?: string;
  facebook?: string;
  line?: string;
  threads?: string;
  tiktok?: string;
};

/** True when there is at least one link to show — the caller's render guard. */
export function hasSocialLinks(social?: SocialLinks): boolean {
  return Boolean(social && (social.instagram || social.facebook || social.line || social.threads || social.tiktok));
}

const NETWORKS: Array<[keyof SocialLinks, string, (p: { size: number }) => React.JSX.Element]> = [
  ["instagram", "Instagram", IconInstagram],
  ["facebook", "Facebook", IconFacebook],
  ["line", "LINE", IconLine],
  ["threads", "Threads", IconThreads],
  ["tiktok", "TikTok", IconTikTok],
];

/**
 * The row of social icons, one implementation.
 *
 * Both headers and the villa menu had their own copy of the same five `<a>`
 * lines, which is how the villa footer ended up with none and nobody noticed
 * that hiding the header row on a phone left no route to LINE at all — a
 * booking channel here. URLs are validated upstream (`httpOnly`, `lineUrl`);
 * an empty string means "not set" and the icon is dropped.
 */
export default function HeaderSocial({
  social,
  locale,
  size = 16,
  className = "header-social",
}: {
  social?: SocialLinks;
  locale: Locale;
  size?: number;
  className?: string;
}) {
  if (!hasSocialLinks(social)) return null;
  return (
    /* role="group": a bare <div> maps to role="generic", where ARIA forbids
       aria-label and browsers discard it — so this row of five icon links had
       no accessible name at all. */
    <div className={className} role="group" aria-label={locale === "zh" ? "社群連結" : "Social links"}>
      {NETWORKS.map(([key, label, Icon]) => {
        const href = social?.[key];
        if (!href) return null;
        return (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
            <Icon size={size} />
          </a>
        );
      })}
    </div>
  );
}
