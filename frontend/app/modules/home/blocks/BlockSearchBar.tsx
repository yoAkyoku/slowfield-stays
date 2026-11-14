import StaySearchBar from "../../StaySearchBar";
import { buildLocationGroups } from "../../stayLocations";
import { getCurrentSite, getStaySearchOptions } from "../../api";
import { t, type Locale } from "../../i18n";
import { clearableT, type ShortAmenityRule } from "../../tr";
import { experienceOptions, guestOptions, serviceOptions, typeOptions } from "../../searchOptions";

export type BlockSearchBarConfig = {
  title?: string | Record<string, string>;
};

/** The filter already applied to the page, so the bar shows what the listing is
 *  showing. The homepage has none; /stays passes its query string. Without it
 *  the bar renders empty beside a filtered list and clears the filter on the
 *  next submit. */
export type SearchBarInitial = {
  region?: string;
  destination?: string;
  amenities?: string[];
  guests?: string;
  tag?: string;
  experiences?: string[];
};

/**
 * The hero search — previously hard-coded into the homepage between the hero
 * and the block list, so it could not be reordered, hidden, or restyled like
 * everything else. Fetches a small location projection, so it works wherever
 * it is placed without loading every stay's story, rooms, gallery and SEO.
 */
export default async function BlockSearchBar({ locale, config, initial }: { locale: Locale; config?: BlockSearchBarConfig; initial?: SearchBarInitial }) {
  const zh = locale === "zh";
  const c = (config ?? {}) as Record<string, unknown>;
  const [site, stayOptions] = await Promise.all([getCurrentSite(), getStaySearchOptions()]);

  const regionMap = new Map<string, string>();
  for (const s of stayOptions) {
    if (s.region && s.region.trim()) regionMap.set(s.region.toLowerCase(), s.region.trim());
  }
  const regions = Array.from(regionMap.values()).sort((a, b) => a.localeCompare(b, "zh-Hant"));

  // 縣市 → 地區, labelled in the language being read while still submitting the
  // Chinese the API matches on. Shared with /stays so the two search bars
  // cannot drift apart again.
  const locations = buildLocationGroups(stayOptions, locale);

  /* Cleared means cleared. cfgT treats "" as missing and hands back the
     built-in line, so emptying 標題 in the editor left 依你想要的旅行方式探索
     on the page and the field looked as though it refused to clear
     (客戶: 怎麼清空文本還有這句?). An absent key still takes the default, so a
     block that has never been edited is unchanged. */
  const title = clearableT(c, "title", locale, zh ? "依你想要的旅行方式探索" : "Find a stay that fits your mood");

  return (
    <div className="home-stays-search-wrap">
      {title && (
        <div className="home-stays-search-head">
          <h2>{title}</h2>
        </div>
      )}
      <StaySearchBar
        regions={regions}
        amenities={[]}
        serviceOptions={serviceOptions(locale, site.settings)}
        guestRanges={guestOptions(locale, site.settings)}
        stayTypes={typeOptions(locale, site.settings)}
        experienceOptions={experienceOptions(locale, site.settings)}
        locations={locations}
        locale={locale}
        shortLabels={site.settings?.amenity_short as ShortAmenityRule[] | undefined}
        labels={{
          region: zh ? "所有地區" : "Region",
          county: zh ? "縣市" : "County",
          district: zh ? "地區" : "District",
          amenity: zh ? "服務設施" : "Facilities",
          // Was hand-typed as 人數 during the rewrite — that's stays.guests, a
          // different i18n key than the one this replaced (home.guests, 入住人數).
          guests: t(locale).home.guests,
          submit: zh ? "開始探索" : "Find a stay",
        }}
        initial={initial}
      />
    </div>
  );
}
