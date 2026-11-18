import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * A reader is not offered controls that can only fail.
 *
 * The CMS list renders its table twice: once wrapped in the bulk-select form
 * for someone with cms:write, and once plain for everyone else. Both branches
 * passed the full action set — archive, publish, 刪除, 還原 and, once permanent
 * deletion was added, 永久刪除. The API refuses all of them with 403, so the
 * read-only branch showed a row of buttons that could do nothing, the most
 * alarming of which was irreversible if it had worked.
 *
 * Not a privilege escalation — require_permission("cms:write") guards every one
 * of those routes server-side, and that is what actually protects the data.
 * This is about not putting a live-looking 永久刪除 in front of someone who
 * cannot use it.
 */

/** Lines, with any trailing carriage return removed. The sources are CRLF. */
function linesOf(file: string): string[] {
  return readFileSync(file, "utf8").split("\n").map((l) => l.replace(/\r$/, ""));
}

const STATUS_ACTIONS = linesOf("app/admin/modules/StatusActions.tsx");
const CMS_PAGE = linesOf("app/admin/(dashboard)/cms/page.tsx");

test("StatusActions gates every write control behind canWrite", () => {
  for (const control of ["actions.deleteItem", "actions.purgeItem", "actions.restoreItem"]) {
    const at = STATUS_ACTIONS.findIndex((l) => l.includes("action={" + control + "}"));
    assert.ok(at !== -1, control + " not found — renamed?");

    // Each control sits inside a `{<condition> ? (` block. Take the guard line
    // that opens that block — the nearest preceding line that opens a JSX
    // conditional — not the nearest brace, which is the control's own attribute.
    let guard = "";
    for (let i = at; i >= 0; i -= 1) {
      const line = STATUS_ACTIONS[i].trim();
      if (line.startsWith("{") && line.endsWith("? (")) { guard = line; break; }
    }
    assert.ok(
      guard.startsWith("{canWrite &&"),
      control + ' renders under "' + guard + '", which does not check canWrite',
    );
  }
});

test("canWrite defaults to true so an already-gated caller is unaffected", () => {
  assert.ok(STATUS_ACTIONS.some((l) => l.includes("canWrite = true,")));
});

test("the status transitions are gated too, not just the deletes", () => {
  // archive / publish / draft / review are writes as much as delete is.
  const gated = STATUS_ACTIONS.filter((l) =>
    l.includes("{canWrite && !deletedAt && status === "),
  ).length;
  assert.equal(gated, 4, "expected all four status transitions to be gated, got " + gated);
});

test("the CMS read-only branch declares itself read-only", () => {
  /* Each table is written once, as a function of `writable`, and drawn in
     both branches. An instance that omitted canWrite would default to true and
     reopen this, so the one instance must pass the flag through, and the
     reader's branch must ask for the read-only table. */
  const src = CMS_PAGE.join("\n");
  for (const [table, fn] of [["CmsPagesTable", "pagesTable"], ["CmsBannersTable", "bannersTable"]]) {
    assert.equal((src.match(new RegExp(`<${table}\\b`, "g")) ?? []).length, 1, `${table} is written out more than once again`);
    assert.match(src, new RegExp(`const ${fn} = \\(writable: boolean\\) => \\(\\n\\s*<${table}\\n\\s*canWrite=\\{writable\\}`), `${table} no longer passes canWrite through`);
    assert.match(src, new RegExp(`\\{canWrite \\? \\([\\s\\S]*?\\{${fn}\\(true\\)\\}[\\s\\S]*?\\) : \\(\\s*${fn}\\(false\\)\\s*\\)\\}`), `the reader's branch no longer draws the read-only ${table}`);
  }
});
