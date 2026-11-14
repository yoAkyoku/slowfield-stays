import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNavLinks,
  pinnedNavLinks,
  DEFAULT_LABELS,
  DEFAULT_SORT,
  FALLBACK_SORT,
  PINNED_LIMIT,
  type SiteNavLink,
} from "../app/modules/siteNav.ts";

/**
 * 聯絡我們 sits at the right-hand end of the main nav.
 *
 * 客戶: 主選單中「旅遊專欄」右側增加「聯絡我們」. It has been asked for twice and
 * been invisible twice, and both times the site the client looked at was the
 * parent — whose page management carries hand-set sort_orders that happened to
 * put it right. The rules below are the ones a site with no such settings gets,
 * which is every new site and every page the admin has never reordered.
 */

const NO_CMS = new Set<string>();
/** A site whose page management has never been touched. */
const BARE = { settings: {} };

const keys = (links: SiteNavLink[]) => links.map((l) => l.key);
const at = (links: SiteNavLink[], key: string) => links.findIndex((l) => l.key === key);

test("with no page settings at all, 聯絡我們 comes after 旅遊專欄", () => {
  const links = buildNavLinks(BARE, "zh", NO_CMS);
  const contact = at(links, "contact");
  const journal = at(links, "journal");
  assert.ok(contact > -1, "the contact link is not in the nav");
  assert.ok(journal > -1, "the journal link is not in the nav");
  assert.ok(
    contact > journal,
    `聯絡我們 sits left of 旅遊專欄: ${keys(links).join(" ")}`,
  );
});

test("it is the last item, not merely somewhere to the right", () => {
  // The bar is read left to right and the client pointed at its right-hand end.
  const links = buildNavLinks(BARE, "zh", NO_CMS);
  assert.equal(links[links.length - 1]?.key, "contact", keys(links).join(" "));
});

test("the same holds among the pinned links the top bar actually shows", () => {
  const pinned = pinnedNavLinks(buildNavLinks(BARE, "zh", NO_CMS));
  const contact = pinned.findIndex((l) => l.key === "contact");
  const journal = pinned.findIndex((l) => l.key === "journal");
  assert.ok(contact > -1, "聯絡我們 is not pinned to the bar");
  assert.ok(journal > -1, "旅遊專欄 is not pinned to the bar");
  assert.ok(contact > journal, `bar order: ${pinned.map((l) => l.key).join(" ")}`);
});

test("the bundled label reads 聯絡我們 / Contact", () => {
  // The parent reads 聯絡我們 only because it was typed into page management by
  // hand; the bundled default is what every other site falls back to, and it
  // said 聯繫我們 — a different word from the one the client asked for twice.
  assert.deepEqual(DEFAULT_LABELS.contact, ["聯絡我們", "Contact"]);
  assert.equal(
    buildNavLinks(BARE, "zh", NO_CMS).find((l) => l.key === "contact")?.label,
    "聯絡我們",
  );
  assert.equal(
    buildNavLinks(BARE, "en", NO_CMS).find((l) => l.key === "contact")?.label,
    "Contact",
  );
});

test("a sort_order set in page management still wins over the default", () => {
  // The default only decides where an unconfigured page lands. An admin who
  // deliberately puts 聯絡我們 first must still get it first.
  const site = { settings: { pages: { contact: { sort_order: 1 } } } };
  const links = buildNavLinks(site, "zh", NO_CMS);
  assert.equal(links[0]?.key, "contact", keys(links).join(" "));
});

test("the default sort is a real position, not a tie with everything else", () => {
  // Every other page shares FALLBACK_SORT and ties break alphabetically, where
  // "contact" lands before "journal". A default equal to the fallback would
  // reintroduce exactly that.
  assert.ok(
    (DEFAULT_SORT.contact ?? FALLBACK_SORT) > FALLBACK_SORT,
    "聯絡我們 is back in the alphabetical tie-break",
  );
});

test("only the pages the client named keep their own default order", () => {
  // A blanket reshuffle would move sections the client never mentioned.
  const links = buildNavLinks(BARE, "zh", NO_CMS);
  const others = links.filter((l) => l.key !== "contact");
  assert.deepEqual(
    others.map((l) => l.key),
    [...others.map((l) => l.key)].sort((a, b) => a.localeCompare(b)),
    "the rest of the nav is no longer in its alphabetical fallback order",
  );
});

/* ── The bar's capacity ──────────────────────────────────────────────────── */

const link = (key: string, sort: number, pinned = true): SiteNavLink => ({
  key, href: `/${key}`, label: key, group: "explore", sort, pinned,
});

test("an eighth pinned page does not push 聯絡我們 off the bar", () => {
  /* The parent pins exactly seven sections today, so it sits on the limit: the
     next page anyone pins would have dropped 聯絡我們 — which sorts last — with
     nothing on screen to show it had gone. That is the same disappearance the
     client reported twice. */
  const nav = [
    ...["a", "b", "c", "d", "e", "f", "g"].map((k, i) => link(k, i)),
    link("contact", 90),
  ];
  const bar = pinnedNavLinks(nav);
  assert.equal(bar.length, PINNED_LIMIT, "the bar grew past its limit");
  assert.ok(bar.some((l) => l.key === "contact"), "聯絡我們 fell off the bar again");
  assert.equal(bar[bar.length - 1]?.key, "contact", "it no longer sits at the end");
  // The link before it is the one that gave way, not one from the far left.
  assert.deepEqual(bar.map((l) => l.key), ["a", "b", "c", "d", "e", "f", "contact"]);
});

test("under the limit nothing is dropped or reordered", () => {
  const nav = [link("a", 0), link("b", 1), link("contact", 90)];
  assert.deepEqual(pinnedNavLinks(nav).map((l) => l.key), ["a", "b", "contact"]);
});

test("a site with nothing pinned still gets a bar", () => {
  const nav = ["a", "b", "c", "d", "e", "f"].map((k, i) => link(k, i, false));
  assert.deepEqual(pinnedNavLinks(nav).map((l) => l.key), ["a", "b", "c", "d", "e"]);
});

test("a site that pins many pages and no contact is left alone", () => {
  // The exemption must not invent a link that is not there.
  const nav = ["a", "b", "c", "d", "e", "f", "g", "h"].map((k, i) => link(k, i));
  const bar = pinnedNavLinks(nav);
  assert.equal(bar.length, PINNED_LIMIT);
  assert.deepEqual(bar.map((l) => l.key), ["a", "b", "c", "d", "e", "f", "g"]);
});

test("hiding 聯絡我們 from the nav is still the admin's call", () => {
  // nav_hidden is a deliberate switch; keeping the link pinned must not turn
  // into a link that cannot be removed.
  const site = { settings: { pages: { contact: { nav_hidden: true } } } };
  const links = buildNavLinks(site, "zh", NO_CMS);
  const contact = links.find((l) => l.key === "contact");
  assert.equal(contact?.navHidden, true, "the NAV toggle no longer reaches the link");
  assert.ok(
    !pinnedNavLinks(links.filter((l) => !l.navHidden)).some((l) => l.key === "contact"),
    "a hidden 聯絡我們 is forced back onto the bar",
  );
});
