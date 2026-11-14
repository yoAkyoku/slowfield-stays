import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { readStyles, readCode, cssRules, splitSelectorList } from "./readCode";

/**
 * 聯絡我們 is edited from the page editor like every other managed page.
 *
 * Its hero used to be hard-coded in the route — an sr-only <h1> and a
 * background image read straight from site.settings — so the hero fields the
 * page editor already offered (標題／副標／背景圖／高度／對齊) did nothing on the
 * one page whose heading a client most often wants to change. Both the contact
 * route and the category index now render the same PageHero, so a field added
 * to the editor reaches both without being wired up twice.
 */

const CONTACT = "app/(site)/contact/page.tsx";
const CATEGORY = "app/modules/content/CategoryPage.tsx";
const BLOCKS = "app/modules/content/PageBlocks.tsx";
/* The 通訊處 list moved into its own module so the villa renderer could use
   the same one — the guarantees below did not change, only their address. */
const OFFICES = "app/modules/content/ContactOffices.tsx";

for (const file of [CONTACT, CATEGORY]) {
  test(`${file} renders the shared PageHero`, () => {
    const src = readFileSync(file, "utf8");
    assert.match(src, /import PageHero, \{ hasPageHero \}/, "PageHero is not imported");
    assert.ok(src.includes("<PageHero"), "PageHero is not rendered");
  });
}

test("the hero is opt-in, so it cannot duplicate the block heading", () => {
  // The 聯絡資訊 block carries a visible title of its own. Printing the hero
  // unconditionally would show the page heading twice on every site that has
  // not configured one, which is why this is gated on hasPageHero.
  const src = readFileSync(CONTACT, "utf8");
  assert.ok(src.includes("hasPageHero(contactPage, locale)"), "hero is no longer opt-in");
  assert.ok(src.includes('className="sr-only"'), "the fallback screen-reader heading is gone");
});

test("PageHero allow-lists the alignment before it reaches a style attribute", () => {
  const src = readCode("app/modules/content/PageHero.tsx");
  assert.ok(
    src.includes('["left", "center", "right"].includes'),
    "hero_align is no longer allow-listed"
  );
});

test("office contact details are on the row, not hidden behind a toggle", () => {
  const src = readFileSync(OFFICES, "utf8");
  const start = src.indexOf("contact-offices");
  assert.ok(start > -1, "the offices block is gone");
  const section = src.slice(start);
  // A visitor opening 聯絡我們 to find a phone number must see phone numbers.
  // Matched on the closing tag: the prose above the markup mentions the element
  // this replaced, and an opening-tag check reads that comment as a relapse.
  assert.ok(!section.includes("</details>"), "office details are collapsed again");
  assert.ok(section.includes("contact-office-fields"), "the labelled field list is gone");
  for (const label of ["地址", "電話", "Email"]) {
    /* As a string LITERAL, not as a bare substring. This reads source, and the
       labels are written `<dt>{locale === "zh" ? "地址" : "Address"}</dt>` — so
       the quote is what distinguishes the label from the identifier `oEmail`,
       which accounts for six of "Email"'s seven occurrences and kept this green
       with the label deleted. */
    assert.ok(
      section.includes(`"${label}`),
      `the ${label} label is missing`,
    );
  }
});

test("offices are spaced apart rather than welded into one list", () => {
  const css = readStyles("app/globals.css");
  const rule = css.slice(css.indexOf(".contact-offices {"));
  const decl = rule.slice(0, rule.indexOf("}"));
  assert.match(decl, /gap:\s*\d+px/, "the gap between 通訊處 cards is gone");
});

test("managed pages can carry the subscribe block", () => {
  // The homepage and the property renderer both had a `newsletter` case; the
  // site-page renderer did not, so 聯絡我們 could not be given a subscribe form
  // from the page editor even though the editor offered the block. Composing
  // the contact page out of blocks depends on this case existing.
  const src = readFileSync(BLOCKS, "utf8");
  assert.match(src, /case "newsletter":/, "the newsletter block is unrenderable again");
  assert.ok(src.includes("siteSlug={siteSlug}"), "subscriptions would land on the wrong site");
});

test("the built-in subscribe is suppressed once a block provides it", () => {
  /* Otherwise composing the page from blocks renders the same band twice.
     The enquiry half of this check is gone with the built-in form itself
     (客戶: 不需要讀 source 的表單了，可以移除) — there is only the 聯絡表單
     block now, so there is nothing left to duplicate it against. */
  const src = readFileSync(CONTACT, "utf8");
  assert.ok(src.includes('placedTypes.has("newsletter")'), "subscribe would be duplicated");
  assert.ok(!src.includes("<InquiryForm"), "the built-in enquiry form is back");
});

test("the contact form block's layout choice is allow-listed", () => {
  // It becomes a class name.
  const src = readCode("app/modules/content/ContactFormBlock.tsx");
  assert.ok(
    src.includes('config.layout === "split" ? "split" : "stacked"'),
    "the layout value reaches the class name unchecked"
  );
});

test("an office only gets a disclosure arrow when it has something to disclose", () => {
  const src = readFileSync(OFFICES, "utf8");
  const start = src.indexOf("function OfficeCard");
  assert.ok(start > -1, "OfficeCard is gone");
  const body = src.slice(start, src.indexOf("export default function"));
  assert.ok(body.includes("if (!note) return"), "an empty office would render an arrow onto nothing");
  assert.ok(body.includes("<details"), "an office note can no longer be expanded");
});

test("the central contact card can be turned off without losing its values", () => {
  // On a page that also lists 通訊處 it repeats the head office one line above
  // the same address. Hiding it must not require clearing the fields, because
  // the villa pages render the same block and need them.
  const src = readFileSync(BLOCKS, "utf8");
  assert.ok(src.includes("config.show_primary !== false"), "the card is unconditional again");
  assert.ok(src.includes("{showPrimary && ("), "the card is not actually gated");

  const admin = readCode("app/admin/modules/blockForms.tsx");
  assert.ok(admin.includes("show_primary"), "there is no way to turn it off from the admin");
});

test("there is one subscribe implementation, not two", () => {
  // The contact route had its own SubscribePanel alongside the newsletter
  // block. Once the band was trimmed to an email field the two were the same
  // request to the same endpoint, so every change had to be made and styled
  // twice — and the block version, the one the page editor places, was the
  // one that kept getting missed. The panel is gone; the route renders the
  // block component.
  assert.ok(
    !existsSync("app/(site)/contact/SubscribePanel.tsx"),
    "the duplicate subscribe panel is back"
  );
  const src = readFileSync(CONTACT, "utf8");
  assert.ok(src.includes("<BlockNewsletter"), "the route no longer renders the block component");
  assert.ok(!src.includes("SubscribePanel"), "the route still references the deleted panel");
});

test("the band asks for an email and nothing else", () => {
  // 客戶: 不要那麼多資訊.
  const src = readCode("app/modules/home/blocks/BlockNewsletter.tsx");
  const fields = src.match(/<input[^>]*name="[a-z_]+"/g) ?? [];
  assert.deepEqual(fields.length, 1, `expected one field, found ${fields.length}`);
  assert.ok(src.includes('name="email"'), "the email field is gone");
});

test("the section heading carries no rules beside it", () => {
  // These went in from the reference image, came out on the instruction 不要底線,
  // went back in because the reference drew them, and are out again now that the
  // real page has been seen (客戶: 不要有這個線條). The heading is plain text.
  const css = readStyles("app/globals.css");
  assert.ok(
    !css.includes(".contact-page .page-block-contact > h2::before"),
    "the ruled heading is back",
  );
});

test("every panel on the contact page sits on the same measure", () => {
  // The offices were a bare `max-width: 1040px` inside a section that had
  // already applied its own padding, so the cards ran ~64px wider on each side
  // than the band and the enquiry sheet and the page had three left edges.
  /* Was `css.split("calc(1040px - 2 * var(--gutter))").length - 1 >= 2`, and the
     stylesheet contains that string exactly once in code — the second "use" it
     counted was the comment that explains why the offices deliberately do NOT
     use it. Two panels reaching the same width by two different formulas is the
     actual design (--gutter resolves to 0 in the block panels' subtree and to
     the contact block's 32px in the offices'), so both halves are named. */
  /* The width is a page-level variable now, not the literal 1040 repeated in
     four rules written three different ways (a bare px, a calc adding the
     pair's padding back, a calc subtracting the gutter). Asserting the LITERAL
     made this fail for a change that preserves everything it protects, and it
     could never catch what actually goes wrong here: one panel widened and the
     others left behind. Asserting the SHARED SOURCE catches that, and catches a
     second literal creeping back in. */
  const css = readStyles("app/globals.css");
  /* It reads the site-wide block frame now rather than repeating a literal, so
     the contact page cannot drift away from every other page the way it drifted
     away from its own panels. Either form satisfies the thing being protected —
     one shared source — so both are accepted, and a bare literal that is NOT
     the shared variable is what would fail. */
  assert.match(css, /\.contact-page \{[^}]*--contact-measure:\s*(\d+px|var\(--block-measure)/,
    "the contact page no longer defines --contact-measure; the panels have nothing to share");
  for (const selectors of [
    [".contact-page .contact-offices", ".contact-page .page-block-contact > h2"],
    [".contact-page .block-newsletter", ".contact-page .page-block-contact-form"],
  ]) {
    const at = css.indexOf(`${selectors.join("," + String.fromCharCode(10))} {`);
    assert.ok(at > -1, `the rule for ${selectors[0]} is gone`);
    const rule = css.slice(at, css.indexOf("}", at));
    assert.match(rule, /max-width:[^;]*var\(--contact-measure\)/,
      `${selectors[0]} sizes itself independently of the shared measure`);
    assert.ok(rule.includes("margin-inline: auto"), `${selectors[0]} is no longer centred`);
  }
  /* The two consumers with their own algebra around the variable, which are the
     easiest to leave behind when the measure changes. */
  for (const sel of [".contact-page .property-contact-directions", ".contact-page .property-block-pair"]) {
    const at = css.indexOf(`${sel} {`);
    assert.ok(at > -1, `the rule for ${sel} is gone`);
    assert.match(css.slice(at, css.indexOf("}", at)), /max-width:[^;]*var\(--contact-measure\)/,
      `${sel} is still on a hardcoded width while the rest follow the page measure`);
  }
});

test("the block panels are finished like the built-in ones", () => {
  // Moving the page onto blocks is the point of the blocks existing; it must
  // not visibly downgrade the page.
  const css = readStyles("app/globals.css");
  for (const rule of [
    /* Styled for the block, not for one page: the 顯示信封圖示 toggle exists on
       every newsletter block, and scoping its disc to .contact-page left it
       unstyled — and breaking the layout — everywhere else. */
    /* With the newline, so the page-scoped `.contact-page .block-newsletter-icon`
       does not satisfy a check whose whole subject is that the rule was
       DE-scoped. siteSettingsReach.test.mts:345 anchors the same way. */
    "\n.block-newsletter-icon",
    ".contact-page .block-newsletter-form button",
    ".contact-page .page-block-contact-form.is-split",
  ]) {
    assert.ok(css.includes(rule), `${rule} is unstyled, so the block version looks different`);
  }
});

test("the block form reads like the reference", () => {
  const src = readCode("app/modules/content/ContactFormBlock.tsx");
  for (const [key, text] of [
    ["message", "詢問內容"],
    ["send", "送出訊息"],
    ["subject", "主旨"],
  ] as const) {
    assert.ok(src.includes(`${key}: "${text}"`), `${key} does not read "${text}"`);
  }
  assert.ok(src.includes('<input name="subject"'), "the free-text subject line is gone");
  assert.ok(src.includes('formData.get("subject")'), "the subject is collected but never sent");

  // 諮詢類型 was removed from the form (客戶: 移除「諮詢類型」欄位), but the API
  // still models the routing code and the inbox files by it — so it must still
  // be sent, from the block's configured first type, never left empty.
  assert.ok(!src.includes("<select name=\"source\""), "the 諮詢類型 picker is back on the form");
  /* `inquiryTypes`, not `typeOptions`, and "website", not "other". This pinned
     the exact expression that `contactSourceDefault.test.mts` was written to
     forbid: typeOptions falls back to the built-in list, whose first entry is
     ["住宿詢問", "booking"], so on a site that never configured 詢問類型 every
     press or careers enquiry was filed as a room request. This line was holding
     that in place. What it should protect — a routing code is always sent — is
     unchanged. */
  assert.ok(
    src.includes('inquiryTypes[0]?.[1] || "website"'),
    "enquiries would be filed with no routing code",
  );
  assert.ok(
    !src.includes("typeOptions[0]"),
    "indexing typeOptions is how the booking default comes back",
  );
});

test("an office row's links are not nested inside the disclosure toggle", () => {
  // The row carries tel:, mailto: and Maps links. When it was the <summary>,
  // tapping a phone number toggled the panel instead of dialling, a screen
  // reader announced the whole row as the toggle's label, and the markup was
  // invalid — <summary> takes phrasing content, not nested interactives.
  const src = readFileSync(OFFICES, "utf8");
  const start = src.indexOf("function OfficeCard");
  assert.ok(start > -1, "OfficeCard is gone");
  const body = src.slice(start, src.indexOf("export default function"));

  const summaryOpen = body.indexOf("<summary className=");
  const summaryClose = body.indexOf("</summary>");
  assert.ok(summaryOpen > -1 && summaryClose > summaryOpen, "the disclosure has no summary");
  const summary = body.slice(summaryOpen, summaryClose);
  assert.ok(!summary.includes("{children}"), "the whole row is inside <summary> again");

  // The row must still render, outside the toggle.
  assert.ok(body.includes('<div className="contact-office-summary">{children}</div>'),
    "the office row is no longer rendered");
  // And the toggle still needs an accessible name.
  assert.ok(summary.includes("sr-only"), "the disclosure arrow has no accessible name");
});

test("every renderer names the site when it mounts a subscribe block", () => {
  // Without ?site= the API falls back to resolving by Host, which files the
  // subscriber under whichever site owns the domain rather than the one whose
  // page they were reading.
  for (const file of [CONTACT, CATEGORY]) {
    const src = readFileSync(file, "utf8");
    if (!src.includes("<PageBlocks")) continue;
    assert.match(src, /<PageBlocks[^>]*siteSlug=/s, `${file} mounts blocks without a site`);
  }
});

test("every block on the contact page shares one measure", () => {
  /* The pair used to cap at `calc(var(--contact-measure) + 2 * clamp(16px, 4vw,
     48px))`, on the theory that the two columns' own padding sits outside the
     page axis. The columns pad by DIFFERENT amounts — the offices card 26px,
     the form 40px — so the compensation lined nothing up and simply made the
     pair 96px wider than everything above it. Measured at 1920: cards and
     交通指引 at 355..1555, the pair at 307..1603; the overhang is what read as
     「內容塊寬度不一致」. */
  const css = readStyles("app/globals.css");
  const capped: string[] = [];
  for (const sel of [
    ".contact-page .contact-offices",
    ".contact-page .property-contact-directions",
    ".contact-page .property-block-pair",
  ]) {
    const rules = cssRules(css).filter((r) => splitSelectorList(r.selector).includes(sel));
    assert.ok(rules.length > 0, `${sel} is gone — re-anchor this test`);
    const mw = rules.map((r) => /max-width:\s*([^;]+)/.exec(r.body)?.[1]?.trim()).filter(Boolean) as string[];
    assert.ok(mw.length > 0, `${sel} sets no max-width`);
    capped.push(...mw);
  }
  for (const v of capped) {
    assert.equal(
      v,
      "var(--contact-measure)",
      `a contact block caps at \`${v}\` instead of the shared measure — the edges stop lining up`,
    );
  }
});
