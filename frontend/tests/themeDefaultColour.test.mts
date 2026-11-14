import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readCode, readStyles } from "./readCode";
import { jsxTags } from "./sourceEval";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  themeVars,
} from "../app/modules/fontPresets.ts";

/**
 * 主色 / 強調色 have ONE default, and it is the pair the pages already draw.
 *
 * There were four, and they disagreed:
 *
 *     globals.css :root                    #202820 / #8a6b42
 *     fontPresets themeVars (the renderer)  #283d34 / #a56d43
 *     SitePageEditor (the picker)           #2f4638 / #b78b58
 *     siteActions + 3 more save payloads    #2f4638 / #b78b58
 *
 * So a site that had never chosen a colour was SHOWN #2f4638, DREW #283d34, and
 * silently BECAME #2f4638 the moment any tab of 網站設定 was saved — the save
 * payload replaces theme_config wholesale, so the default it carries is written
 * through even for an admin who never opened the colour panel.
 *
 * #283d34 / #a56d43 is the surviving pair because it is the one the pages render
 * today; any other choice repaints every site that has not set a colour.
 */

test("the exported pair is the one the pages already render", () => {
  /* Pinned literally. Everything else in this file compares against the
     constants, so without this line a mutation that changed BOTH the constant
     and its readers would be reported as consistent — and would have repainted
     every site that never picked a colour. */
  assert.equal(DEFAULT_PRIMARY_COLOR, "#283d34", "主色 default moved; every site without its own primary repaints");
  assert.equal(DEFAULT_ACCENT_COLOR, "#a56d43", "強調色 default moved; every site without its own accent repaints");
});

test("the renderer's fallback is the exported pair", () => {
  // themeVars is what actually lands on the site wrapper, so this is the
  // definition of "what a site with no colour draws".
  const bare = themeVars(undefined);
  assert.equal(bare["--forest"], DEFAULT_PRIMARY_COLOR);
  assert.equal(bare["--accent"], DEFAULT_ACCENT_COLOR);
  assert.equal(themeVars({})["--forest"], DEFAULT_PRIMARY_COLOR);
  assert.equal(themeVars({})["--accent"], DEFAULT_ACCENT_COLOR);
  // A site that HAS chosen still wins, and --accent-text follows the accent
  // that actually resolved rather than the default.
  const chosen = themeVars({ primaryColor: "#123456", accentColor: "#654321" });
  assert.equal(chosen["--forest"], "#123456");
  assert.equal(chosen["--accent"], "#654321");
  assert.equal(chosen["--accent-text"], "color-mix(in srgb, #654321 76%, #000)");
  // A value the sanitiser refuses falls back to the default, not to nothing:
  // an empty custom property would win over every `var(…, fallback)` below it.
  const rejected = themeVars({ primaryColor: "url(x)", accentColor: "" });
  assert.equal(rejected["--forest"], DEFAULT_PRIMARY_COLOR);
  assert.equal(rejected["--accent"], DEFAULT_ACCENT_COLOR);
});

/* ── Nobody may retype the pair ────────────────────────────────────────── */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : walk(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

const SOURCES = walk("app").map((f) => [f, readCode(f)] as const);

test("the app files that name a theme colour are actually being read", () => {
  // Guards the guard below: a broken walk or a renamed key would leave the
  // sweep with nothing to sweep and pass on an empty set.
  const mentions = SOURCES.filter(([, src]) => /primary_color|primaryColor/.test(src));
  assert.ok(
    mentions.length >= 5,
    `only ${mentions.length} files mention a primary colour — the sweep below is looking at the wrong tree`,
  );
});

test("no save path, picker or mock spells a default colour out for itself", () => {
  /* The defect in one line. Each of these four was its own literal:
       siteActions      String(formData.get("primary_color") ?? "#2f4638")
       siteActions      site.theme_config?.primaryColor ?? "#2f4638"
       homepageActions  theme.primaryColor ?? "#2f4638"
       propertyPages…   site.theme_config?.primaryColor ?? "#2f4638"
     plus the picker's useState and two mock sites. A hex anywhere near one of
     these keys means a fifth default is being born. */
  const KEY = "(primary_color|accent_color|primaryColor|accentColor)";
  const HEX = '"#[0-9a-fA-F]{3,8}"';
  const PATTERNS = [
    // `primaryColor: "#283d34"` — a config object literal.
    new RegExp(`${KEY}\\s*:\\s*${HEX}`, "g"),
    // `… primaryColor ?? "#2f4638"` / `… || "#b78b58"` — a fallback.
    new RegExp(`${KEY}[^;\\n]{0,80}(\\?\\?|\\|\\|)\\s*${HEX}`, "g"),
  ];
  const offenders: string[] = [];
  for (const [file, src] of SOURCES) {
    for (const re of PATTERNS) {
      for (const m of src.matchAll(re)) offenders.push(`${file}: ${m[0]}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "these write a theme colour default by hand instead of importing "
      + `DEFAULT_PRIMARY_COLOR / DEFAULT_ACCENT_COLOR:\n    ${offenders.join("\n    ")}`,
  );
});

test("the patterns above would catch a retyped default", () => {
  /* The sweep asserts an EMPTY list, which is what a broken pattern also
     produces. Both forms are checked against a known positive here, and against
     the shapes that must NOT trip it. */
  const KEY = "(primary_color|accent_color|primaryColor|accentColor)";
  const HEX = '"#[0-9a-fA-F]{3,8}"';
  const object = new RegExp(`${KEY}\\s*:\\s*${HEX}`);
  const fallback = new RegExp(`${KEY}[^;\\n]{0,80}(\\?\\?|\\|\\|)\\s*${HEX}`);
  assert.match('theme_config: { primaryColor: "#2f4638" }', object);
  assert.match('accent_color: String(formData.get("accent_color") ?? "#b78b58"),', fallback);
  assert.match("primary_color: site.theme_config?.primaryColor ?? \"#2f4638\",", fallback);
  assert.doesNotMatch("primary_color: site.theme_config?.primaryColor ?? DEFAULT_PRIMARY_COLOR,", fallback);
  assert.doesNotMatch('nav_bg: theme.navBg ?? ""', fallback);
  // The unrelated hexes in these files must not be swept up with them.
  assert.doesNotMatch('const color = String(item.icon_color ?? "#b78b58");', fallback);
  assert.doesNotMatch('background: "var(--accent, #b78b58)"', object);
});

/* ── The stylesheet's own copy ─────────────────────────────────────────── */

const CSS = readStyles("app/globals.css");

/** The last `:root` declaration of a custom property, outside any at-rule. */
function rootValue(prop: string): string | null {
  let out: string | null = null;
  // `--accent` must not match `--accent-text`: the character after the name has
  // to be whitespace or the colon itself.
  const re = new RegExp(`${prop}\\s*:\\s*([^;}]+)`, "g");
  for (const m of CSS.matchAll(re)) {
    const open = CSS.lastIndexOf("{", m.index!);
    const prevClose = CSS.lastIndexOf("}", open);
    const selector = CSS.slice(prevClose + 1, open).replace(/\s+/g, " ").trim();
    if (selector !== ":root") continue;
    out = m[1].trim();
  }
  return out;
}

test("globals.css :root agrees with the exported pair", () => {
  /* Kept rather than deleted, on purpose: these two are shadowed on every site
     page and villa page (themeVars writes both onto the wrapper), but the routes
     with no wrapper — /newsletter/unsubscribe, the admin dashboard, error.tsx —
     read them, and the global `:focus-visible { outline: 2px solid var(--accent) }`
     spends --accent with no fallback of its own. Deleting them would drop that
     focus ring entirely. Measured on /newsletter/unsubscribe: --forest resolved
     to the :root declaration and .unsub-back painted with it. */
  assert.equal(rootValue("--forest"), DEFAULT_PRIMARY_COLOR, ":root --forest is a different default again");
  assert.equal(rootValue("--accent"), DEFAULT_ACCENT_COLOR, ":root --accent is a different default again");
});

test("the :root reader is reading :root, and reads whole property names", () => {
  /* Guards the guard, three ways. `--accent` occurs as a substring inside
     `--accent-text` two lines above it, so a reader that matched prefixes would
     compare the colour against a color-mix() — and a reader that found nothing
     at all would make every assertion above vacuous. */
  assert.ok(rootValue("--charcoal"), "the :root reader finds nothing at all — the assertions above are vacuous");
  assert.match(String(rootValue("--accent-text")), /^color-mix\(/, "--accent-text is not being read as its own property");
  assert.equal(
    rootValue("--accen"),
    null,
    "the :root reader matches a partial property name, so --accent can resolve to --accent-text's value",
  );
});

/* ── The picker submits what the client typed ──────────────────────────── */

const EDITOR = "app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx";
const TAGS = jsxTags(EDITOR);

/** The one input carrying `name={field}`, with its type. */
function namedField(field: string): { type: string; value: string } {
  const hits = TAGS.filter((t) => t.tag === "input" && t.attrs.get("name") === field);
  assert.equal(hits.length, 1, `${field}: expected exactly one named input, found ${hits.length}`);
  return { type: hits[0].attrs.get("type") ?? "", value: hits[0].attrs.get("value") ?? "" };
}

test("主色 and 強調色 submit from the text box, like every other colour row", () => {
  /* These two were the only rows whose NAMED field was the `<input type="color">`
     — the sibling text box was unnamed. `type="color"` can hold nothing but a
     hex, so a client who typed `transparent` or `rgba(…)` had it coerced to
     #000000 on submit, while the nav / footer / button rows accept both and
     their help text promises them. */
  for (const field of ["primary_color", "accent_color"]) {
    assert.equal(
      namedField(field).type,
      "text",
      `${field} is submitted from an <input type="${namedField(field).type}">, which cannot hold transparent or rgba()`,
    );
  }
  // …and the swatch beside it is a picker only.
  const swatches = TAGS.filter(
    (t) => t.tag === "input"
      && t.attrs.get("type") === "color"
      && /swatchValue\((primaryColor|accentColor)/.test(t.attrs.get("value") ?? ""),
  );
  assert.equal(swatches.length, 2, "the 主色/強調色 swatches are gone or no longer feed off the text state");
  for (const s of swatches) {
    assert.equal(s.attrs.get("name"), undefined, "the swatch carries the form field name again");
  }
});

test("every other colour row already worked this way", () => {
  // The rows this fix was made to match. If one of them ever moves its `name`
  // onto a swatch, the promise in the help text breaks there instead.
  for (const field of ["nav_bg", "nav_text", "footer_bg", "footer_text", "button_bg", "button_text", "page_bg"]) {
    assert.equal(namedField(field).type, "text", `${field} no longer submits from its text box`);
  }
});

test("an empty colour box means the default, not an empty theme_config entry", () => {
  /* The field can arrive present-but-empty now that it is free text, and the
     save payload replaces theme_config wholesale — `?? DEFAULT` would write ""
     straight through and leave the site with no primary colour at all. */
  const src = readCode("app/admin/modules/siteActions.ts");
  for (const [key, constant] of [
    ["primary_color", "DEFAULT_PRIMARY_COLOR"],
    ["accent_color", "DEFAULT_ACCENT_COLOR"],
  ]) {
    const line = `String(formData.get("${key}") || ${constant})`;
    assert.ok(
      src.includes(line),
      `siteActions no longer reads ${key} as \`${line}\` — an empty box either crashes into "" or the constant is not being used`,
    );
  }
});
