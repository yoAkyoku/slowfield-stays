import type { LocationGroup } from "./StaySearchBar";
import type { Locale } from "./i18n";
import { trs } from "./tr";

type StayLike = {
  region?: string | null;
  destination?: string | null;
  translations?: Record<string, Record<string, string>>;
};

/** Display location in the same hierarchy as the search controls:
 * county/city first, then township/district. */
export function stayLocationLabel(stay: StayLike, locale: Locale): string {
  const county = trs(stay as Parameters<typeof trs>[0], "region", locale) || (stay.region ?? "").trim();
  const rawDistrict = trs(stay as Parameters<typeof trs>[0], "destination", locale) || (stay.destination ?? "").trim();
  const district = stripCounty(rawDistrict, county);
  if (county && district && sameOption(county) !== sameOption(district)) {
    return `${county} / ${district}`;
  }
  return county || district;
}

/**
 * The county / district options for the search bar.
 *
 * Two rules hold this together:
 *
 *   · the submitted value is always the Chinese the stay is filed under, since
 *     the API matches `region` and `destination` exactly;
 *   · the label is whatever that stay reads as in the language being browsed.
 *
 * They used to be the same string, so 宜蘭縣 and 冬山鄉 sat in the dropdowns of
 * an otherwise English page. Building both here rather than in each page also
 * settles a split the two search bars had: the homepage read the raw column and
 * the villa list read it through `trs`, for the same field.
 */
/** The key two options are the same option under. */
function sameOption(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, "");
}

export function buildLocationGroups(stays: StayLike[], locale: Locale): LocationGroup[] {
  /* Grouped by what the option READS AS, not by the raw column.
     `region` is free text typed per stay, so the same county is filed under
     more than one spelling — this catalogue has stays under both "Yilan" and
     "宜蘭". Keyed on the raw value, that produced two chips that both displayed
     宜蘭, and picking either returned half the county's stays with nothing on
     screen to say the other half existed. Measured: /stays returned 2,
     ?region=Yilan returned 1, ?region=宜蘭 returned 1.
     Every raw value behind a merged option is submitted together (the API
     matches any of a comma-separated list), so one chip means one county. */
  const counties = new Map<string, { label: string; values: Set<string>; districts: Map<string, Set<string>> }>();
  const districtLabels = new Map<string, string>();

  for (const stay of stays) {
    const county = (stay.region ?? "").trim();
    if (!county) continue;

    const countyLabel = trs(stay as Parameters<typeof trs>[0], "region", locale) || county;
    const key = sameOption(countyLabel);
    const entry = counties.get(key)
      ?? { label: countyLabel, values: new Set<string>(), districts: new Map<string, Set<string>>() };
    entry.values.add(county);
    // A later stay can supply the translation an earlier one lacked.
    if (entry.label === county && countyLabel !== county) entry.label = countyLabel;

    const destination = (stay.destination ?? "").trim();
    if (destination) {
      const destinationLabel = trs(stay as Parameters<typeof trs>[0], "destination", locale) || destination;
      const shownValue = stripCounty(destination, county);
      const shownLabel = stripCounty(destinationLabel, entry.label);
      const dKey = sameOption(shownLabel);
      // Districts merge the same way, for the same reason.
      const values = entry.districts.get(dKey) ?? new Set<string>();
      values.add(shownValue);
      entry.districts.set(dKey, values);
      if (!districtLabels.has(dKey)) districtLabels.set(dKey, shownLabel);
    }
    counties.set(key, entry);
  }

  return Array.from(counties.values())
    .map(({ label, values, districts }) => ({
      county: Array.from(values).join(","),
      label,
      districts: Array.from(districts.entries())
        .map(([dKey, dValues]) => ({
          value: Array.from(dValues).join(","),
          label: districtLabels.get(dKey) ?? dKey,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, locale === "zh" ? "zh-Hant" : "en")),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale === "zh" ? "zh-Hant" : "en"));
}

/**
 * "宜蘭縣冬山鄉" under 宜蘭縣 is 冬山鄉, and "Dongshan, Yilan" under Yilan is
 * Dongshan. Chinese writes the county first and English writes it last, so both
 * ends are trimmed; a destination that does not name its county is left alone.
 */
function stripCounty(destination: string, county: string): string {
  if (!county || destination === county) return destination;
  if (destination.startsWith(county)) {
    return destination.slice(county.length).replace(/^[\s,、]+/, "").trim() || destination;
  }
  if (destination.endsWith(county)) {
    return destination.slice(0, -county.length).replace(/[\s,、]+$/, "").trim() || destination;
  }
  return destination;
}
