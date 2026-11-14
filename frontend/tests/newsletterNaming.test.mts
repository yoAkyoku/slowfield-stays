import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * The subscribe band calls itself 電子報 and nothing else.
 *
 * 客戶: 原本頁面中某個功能名稱較不直觀，直接明確改成「電子報」，而不是使用消費者
 * 不容易理解的名稱。
 *
 * The band used to introduce itself three different ways at once — an eyebrow
 * reading 慢域優惠 / SELECT OFFERS, a heading, and a button reading 訂閱優惠訊息
 * — so a reader met a form under a promotions label and had to work out that it
 * was a mailing list. The contact route's built-in copy had the same problem in
 * its own words (訂閱慢域旅宿資訊 / "Subscribe to Slowfield Stays": the brand
 * named, the thing being subscribed to not).
 *
 * These are the DEFAULTS. An editor can still type anything into the block, and
 * the point of the test is that what ships when nobody types anything is the
 * word the client asked for.
 *
 * Scoped to the three label strings on purpose: the body copy legitimately
 * mentions 優惠 ("最新優惠、季節住宿…") because it is describing what arrives,
 * not naming the feature.
 */

const BLOCK = "app/modules/home/blocks/BlockNewsletter.tsx";
const CONTACT = "app/(site)/contact/page.tsx";

/** en labels either say newsletter, or are the bare verb on the button. */
function assertEnglishNames(where: string, en: string) {
  assert.ok(
    /newsletter/i.test(en) || en === "Subscribe",
    `${where}: English default is "${en}" — it must name the newsletter (or be the bare "Subscribe" on the button)`,
  );
}

test("the band's own labels name 電子報", () => {
  const src = readFileSync(BLOCK, "utf8");
  // Anchored on the assignment, not on the string: a bare search for 電子報 in
  // this file passes on the heading alone and would never notice the eyebrow
  // and the button drifting back to 慢域優惠 / 訂閱優惠訊息.
  const LABELS: Array<[string, RegExp]> = [
    ["eyebrow", /const eyebrow = eyebrowT\([^;]*?zh \? "([^"]*)" : "([^"]*)"\)/],
    ["title", /const title = cfgT\([^;]*?zh \? "([^"]*)" : "([^"]*)"\)/],
    ["submit label", /const submitLabel = cfgT\([^;]*?zh \? "([^"]*)" : "([^"]*)"\)/],
  ];
  for (const [name, re] of LABELS) {
    const hit = src.match(re);
    assert.ok(hit, `${BLOCK}: could not read the ${name} default — was it renamed?`);
    const [, zh, en] = hit!;
    assert.ok(
      zh.includes("電子報"),
      `${name}: the Chinese default is "${zh}" — it must say 電子報`,
    );
    assertEnglishNames(name, en);
  }
});

test("the contact page's built-in copy names 電子報 too", () => {
  // The route mounts the same component with its own defaults, so the naming
  // has to be fixed in both places or the page that carries no newsletter block
  // keeps the old wording.
  const src = readFileSync(CONTACT, "utf8");
  const start = src.indexOf("<BlockNewsletter");
  assert.ok(start > -1, `${CONTACT}: the route no longer mounts the band`);
  const config = src.slice(start, src.indexOf("/>", start));

  const title = config.match(/title: zh\s*\n?\s*\? "([^"]*)"\s*\n?\s*: `([^`]*)`/);
  assert.ok(title, `${CONTACT}: could not read the built-in title`);
  assert.ok(
    title![1].includes("電子報"),
    `built-in title: the Chinese copy is "${title![1]}" — it must say 電子報`,
  );
  assert.ok(
    /newsletter/i.test(title![2]),
    `built-in title: the English copy is "${title![2]}" — it must name the newsletter, not just the site`,
  );

  const submit = config.match(/submit_label: zh \? "([^"]*)" : "([^"]*)"/);
  assert.ok(submit, `${CONTACT}: could not read the built-in button label`);
  assert.ok(
    submit![1].includes("電子報"),
    `built-in button: the Chinese label is "${submit![1]}" — it must say 電子報`,
  );
  assertEnglishNames("built-in button", submit![2]);
});
