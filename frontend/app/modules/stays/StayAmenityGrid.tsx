import {
  Waves, Droplets, Music2, Dices, Gamepad2, Flame, ConciergeBell,
  UtensilsCrossed, Coffee, PawPrint, Home, Wifi, Car, Tv, Bath, Check,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "../i18n";
import { shortAmenity, type ShortAmenityRule } from "../tr";

/**
 * Facilities as an icon grid (八代町 / OA Hotel / Archipelago register). Amenity
 * strings are stored as "中文 English" pairs, so each label is localised to the
 * current language. Entries that map to the same icon (e.g. "14 米中庭泳池" and the
 * canonical search tag "戲水池") collapse to one, keeping the first/descriptive
 * label, so the grid never shows near-duplicates.
 */

const RULES: [RegExp, LucideIcon][] = [
  [/泳池|戲水|swim|pool/i, Waves],
  [/湯池|溫泉|風呂|spa|hot ?spring|onsen/i, Droplets],
  [/ktv|卡拉|karaoke|影音|戲院|劇院|theat/i, Music2],
  [/麻將|mahjong/i, Dices],
  [/桌遊|board ?game|桌游/i, Gamepad2],
  [/switch|電玩|gaming|遊戲/i, Gamepad2],
  [/烤肉|燒烤|bbq|grill|烤爐/i, Flame],
  [/管家|butler|concierge/i, ConciergeBell],
  [/私廚|餐桌|晚宴|chef|dining|慢域餐|private dining/i, UtensilsCrossed],
  [/早餐|breakfast|手作/i, Coffee],
  [/寵物|pet|友善/i, PawPrint],
  [/浴缸|bath|衛浴/i, Bath],
  [/包棟|villa|整棟|whole/i, Home],
  [/wi-?fi|網路|wireless/i, Wifi],
  [/停車|parking|車位/i, Car],
  [/電視|tv|螢幕|screen|投影/i, Tv],
];

function match(name: string): { Icon: LucideIcon; key: string } {
  for (let i = 0; i < RULES.length; i++) {
    if (RULES[i][0].test(name)) return { Icon: RULES[i][1], key: `i${i}` };
  }
  return { Icon: Check, key: `t${name.toLowerCase()}` };
}

export default function StayAmenityGrid({
  amenities,
  locale = "zh",
  shortLabels,
}: {
  amenities: string[];
  locale?: Locale;
  shortLabels?: ShortAmenityRule[];
}) {
  const seen = new Set<string>();
  const items: { label: string; Icon: LucideIcon }[] = [];
  for (const a of amenities) {
    const raw = (a ?? "").trim();
    if (!raw) continue;
    const { Icon, key } = match(raw);
    if (seen.has(key)) continue; // collapse same-icon / exact-dup entries
    seen.add(key);
    // short, single-language label (handles acronyms like KTV correctly)
    items.push({ label: shortAmenity(raw, locale, shortLabels), Icon });
  }
  if (!items.length) return null;
  return (
    <ul className="stay-amenity-grid">
      {items.map(({ label, Icon }) => (
        <li className="stay-amenity-item" key={label}>
          <span className="stay-amenity-icon"><Icon size={20} strokeWidth={1.6} /></span>
          <span className="stay-amenity-label">{label}</span>
        </li>
      ))}
    </ul>
  );
}
