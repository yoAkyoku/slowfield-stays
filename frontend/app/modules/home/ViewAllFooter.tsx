import Link from "next/link";
import type { ArrowRight } from "lucide-react";

/** Centred "view all" link at the bottom of a section — BlockStays' showcase,
 *  news and default variants all end with one, and BlockArticles' news variant
 *  drew a fourth near-identical copy under its own `home-news-foot` class
 *  (margin-top only, no text-align — it only looked centred because its
 *  ancestor `.home-news-section` already sets `text-align: center`). One
 *  shared component now backs every "view all" footer across both files, so a
 *  future style change moves all of them at once instead of needing four
 *  coordinated edits. */
export default function ViewAllFooter({
  href, label, icon: Icon, reveal = false,
}: { href: string; label: string; icon: typeof ArrowRight; reveal?: boolean }) {
  return (
    <div className={`home-showcase-foot${reveal ? " home-reveal" : ""}`}>
      <Link href={href} className="home-showcase-viewall">{label} <Icon size={15} /></Link>
    </div>
  );
}
