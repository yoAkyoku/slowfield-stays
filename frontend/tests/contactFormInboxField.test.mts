import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readCode } from "./readCode";
import { evaluateExpression } from "./sourceEval";

/**
 * 「詢問送到哪個收件匣」 is offered only where it decides anything.
 *
 * `config.site` exists for exactly one purpose: it becomes the `?site=` on the
 * enquiry POST and so decides whose inbox a message lands in. ContactFormBlock's
 * 預約入口 branch returns two links and never POSTs anything, so in that mode the
 * setting has nothing to route.
 *
 * The field was shown unconditionally. That is this editor's recurring defect,
 * not a cosmetic one: the control saves perfectly into a branch nothing reads,
 * the author picks 本站, the enquiries keep arriving in the group inbox, and
 * there is no error anywhere to notice. A setting that does nothing is
 * indistinguishable from a broken one.
 */

const FORM = "app/admin/modules/blockForms.tsx";
const BLOCK = "app/modules/content/ContactFormBlock.tsx";

/** The condition guarding the JSX subtree that contains `needle`.
 *  Read off the tree, so it is the real guard on the real element and not a
 *  nearby `&&` that happens to sit a few lines up. */
function guardAround(path: string, needle: string): string {
  const text = readCode(path);
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let best: string | null = null;
  /* Only a conditional over MARKUP counts. Every label in this file is a
     `zh ? "…" : "…"`, and those sit inside the element — taking the innermost
     conditional of any kind would find one of those and test the locale switch
     instead of the guard. */
  const isMarkup = (node: ts.Node): boolean => {
    let n = node;
    while (ts.isParenthesizedExpression(n)) n = n.expression;
    return ts.isJsxElement(n) || ts.isJsxFragment(n) || ts.isJsxSelfClosingElement(n);
  };
  const visit = (node: ts.Node): void => {
    // Innermost wins: the guard nearest the element is the one that runs.
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      isMarkup(node.right) &&
      node.right.getText(file).includes(needle)
    ) {
      best = node.left.getText(file);
    }
    // `{cond ? (…) : (…)}` is the other spelling, and which arm the element is
    // in decides the polarity.
    if (ts.isConditionalExpression(node)) {
      const cond = node.condition.getText(file);
      if (isMarkup(node.whenTrue) && node.whenTrue.getText(file).includes(needle)) best = cond;
      else if (isMarkup(node.whenFalse) && node.whenFalse.getText(file).includes(needle)) best = `!(${cond})`;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (best === null) throw new Error(`${path}: nothing guards the subtree containing ${needle}`);
  return best;
}

test("the renderer's 預約入口 branch really does ignore config.site", () => {
  /* The whole point of hiding the field rests on this. If the CTA branch ever
     starts posting an enquiry, config.site matters again and the field should
     come back — so this test fails first and says so, rather than leaving the
     editor quietly hiding a control that now works. */
  const src = readCode(BLOCK);
  const cta = src.indexOf('if (display === "cta")');
  assert.ok(cta > 0, "ContactFormBlock no longer has a cta branch — revisit the editor's guard");
  const returnAt = src.indexOf("return (", cta);
  const closes = src.indexOf("</section>", returnAt);
  assert.ok(returnAt > cta && closes > returnAt, "could not read the cta branch");
  const branch = src.slice(cta, closes);
  assert.ok(
    !/config\.site|\bsite=|handleSubmit|fetch\(/.test(branch),
    "the cta branch now sends something — config.site may matter again",
  );
});

test("the inbox picker is hidden in 預約入口 mode and shown in 完整表單 mode", () => {
  const guard = guardAround(FORM, "詢問送到哪個收件匣");
  // Run the real condition rather than matching its text: `display !== "cta"`
  // and `display === "cta"` differ by one character and read almost the same.
  const decide = (display: string) => evaluateExpression(guard, ["display"])({ display }) as boolean;

  assert.equal(decide("form"), true, "完整表單 lost the inbox picker, which is the mode that uses it");
  assert.equal(decide("cta"), false, "預約入口 still offers an inbox picker that routes nothing");
  // The block's own default when config.display is absent is "form".
  assert.equal(decide(""), true);
});

test("the mode picker itself is always available, or the field could never come back", () => {
  // Hiding the inbox field behind `display` is only safe while `display` can be
  // changed from the same panel; guarding both would strand a block in cta mode.
  const src = readCode(FORM);
  const modeAt = src.indexOf("顯示模式");
  assert.ok(modeAt > 0, "the 顯示模式 field is gone");
  const before = src.slice(Math.max(0, modeAt - 400), modeAt);
  assert.ok(
    !/display\s*(!==|===)\s*"cta"\s*&&\s*\($/.test(before.trim()),
    "the 顯示模式 picker is itself conditional — a cta block could not be switched back",
  );
});

test("the CTA-only fields are still gated the other way", () => {
  // The counterpart: LINE / booking-page labels are meaningless in form mode.
  // Asserted so a future edit cannot "fix" the guard by deleting both.
  const guard = guardAround(FORM, "左按鈕文字");
  const decide = (display: string) => evaluateExpression(guard, ["display"])({ display }) as boolean;
  assert.equal(decide("cta"), true);
  assert.equal(decide("form"), false);
});
