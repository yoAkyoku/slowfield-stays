import assert from "node:assert/strict";
import test from "node:test";
import { blockStyle, roleTypeVars } from "../app/modules/blockStyle.ts";

/**
 * A block's four text roles — eyebrow, title, body, cta — each carry their own
 * alignment, face, size, weight and colour, set in the editor and stored under
 * config._type.
 *
 * Two things are being held here at once. The values land in an inline style
 * attribute on a block an editor controls, and the preview route reaches that
 * straight from a URL, so the allow-list matters as much as the layout. And
 * every rule that spends these reads `var(--r-title-size, <the existing
 * value>)`, so a property nobody set has to be *absent*: emitted empty it
 * would win over the fallback and flatten the block to the browser's defaults.
 */

const ROLES = ["eyebrow", "title", "body", "cta"] as const;

test("every role carries all five properties", () => {
  for (const role of ROLES) {
    const vars = roleTypeVars({
      _type: { [role]: { align: "center", font: "title", size: "20px", weight: "600", color: "#a56d43" } },
    });
    const expected: Record<string, string> = {
      [`--r-${role}-align`]: "center",
      [`--r-${role}-font`]: "var(--font-title)",
      [`--r-${role}-size`]: "20px",
      [`--r-${role}-weight`]: "600",
      [`--r-${role}-color`]: "#a56d43",
    };
    // The CTA needs a second alignment variable; the other three do not.
    if (role === "cta") expected["--r-cta-self"] = "center";
    assert.deepEqual(vars, expected, role);
  }
});

test("the four roles are emitted side by side, each under its own name", () => {
  // One role's settings must not overwrite another's: the variable name is the
  // only thing keeping an eyebrow's size off the heading beside it.
  const vars = roleTypeVars({
    _type: {
      eyebrow: { size: "12px" },
      title: { size: "40px" },
      body: { size: "16px" },
      cta: { size: "14px" },
    },
  });
  assert.deepEqual(vars, {
    "--r-eyebrow-size": "12px",
    "--r-title-size": "40px",
    "--r-body-size": "16px",
    "--r-cta-size": "14px",
  });
});

test("each face key resolves to the site variable, never to a stored family", () => {
  // Pointing at --font-title rather than storing "Playfair Display" is what
  // keeps a role following the site when its fonts change — and what keeps a
  // stored string out of a font-family declaration.
  for (const [key, expected] of [
    ["title", "var(--font-title)"],
    ["body", "var(--font-body)"],
    ["ui", "var(--font-ui)"],
  ] as const) {
    assert.equal(roleTypeVars({ _type: { title: { font: key } } })["--r-title-font"], expected, key);
  }
});

test("each alignment the editor offers survives", () => {
  for (const align of ["left", "center", "right"]) {
    assert.equal(roleTypeVars({ _type: { body: { align } } })["--r-body-align"], align, align);
  }
});

/* ── The CTA's second alignment ─────────────────────────────────────────── */

test("the CTA gets an align-self as well, because text-align cannot move it", () => {
  // It is `display: inline-flex; width: fit-content` in a flex column, so it is
  // placed by the cross-axis rules and the parent's text-align does nothing —
  // --r-cta-align alone moved the button not at all.
  for (const [align, self] of [
    ["left", "flex-start"],
    ["center", "center"],
    ["right", "flex-end"],
  ] as const) {
    assert.deepEqual(
      roleTypeVars({ _type: { cta: { align } } }),
      { "--r-cta-align": align, "--r-cta-self": self },
      align,
    );
  }
});

test("the align-self is mapped from the table, never echoed from the input", () => {
  // Echoing the stored string would mean an editor could put any value at all
  // into an align-self. Only a key in the table resolves, so a flex keyword
  // typed straight into the field is rejected like anything else.
  assert.deepEqual(roleTypeVars({ _type: { cta: { align: "flex-end" } } }), {});
  assert.deepEqual(roleTypeVars({ _type: { cta: { align: "center;align-self:x" } } }), {});
});

test("only the CTA gets an align-self", () => {
  for (const role of ["eyebrow", "title", "body"]) {
    assert.deepEqual(
      roleTypeVars({ _type: { [role]: { align: "center" } } }),
      { [`--r-${role}-align`]: "center" },
      role,
    );
  }
});

test("a CTA alignment that was rejected emits neither variable", () => {
  // Both come from the one value, so both have to go — a --r-cta-self left
  // standing on its own would move the button somewhere nobody asked for.
  // "justify" is the sharp one: the block-wide _textAlign accepts it, and it
  // has no align-self to map to.
  for (const bad of ["center;color:red", "middle", "justify", "constructor", "start", "", null, 0, ["center", "left"]]) {
    assert.deepEqual(roleTypeVars({ _type: { cta: { align: bad } } }), {}, String(bad));
  }
});

test("what is emitted is the table's own string, not the value that matched it", () => {
  // A one-element array stringifies to its element, so ["center"] does match —
  // and that is harmless precisely because matching is a lookup: what reaches
  // the style attribute is the key and its mapped value, never the object the
  // caller passed. An implementation that echoed `r.align` would put an array
  // there instead.
  const vars = roleTypeVars({ _type: { cta: { align: ["center"] } } });
  assert.deepEqual(vars, { "--r-cta-align": "center", "--r-cta-self": "center" });
  assert.equal(typeof vars["--r-cta-align"], "string");
});

test("a responsive size is accepted, not just a bare length", () => {
  // This is the pair to the clamp() injection test below. Without it, "a clamp
  // carrying url() is rejected" would pass just as well against an
  // implementation that rejects every clamp — and the responsive steps the
  // type scale is written in would silently stop working.
  assert.equal(
    roleTypeVars({ _type: { title: { size: "clamp(16px, 2vw, 24px)" } } })["--r-title-size"],
    "clamp(16px, 2vw, 24px)",
  );
  for (const size of ["18px", "1.25rem", "2em"]) {
    assert.equal(roleTypeVars({ _type: { title: { size } } })["--r-title-size"], size, size);
  }
});

/* ── Absence, which the CSS fallbacks depend on ─────────────────────────── */

test("a property nobody set emits no variable at all", () => {
  // Not "" and not "initial": either would beat the fallback in var().
  const vars = roleTypeVars({ _type: { title: { size: "20px" } } });
  assert.deepEqual(Object.keys(vars), ["--r-title-size"]);
  for (const prop of ["align", "font", "weight", "color"]) {
    assert.ok(!(`--r-title-${prop}` in vars), `--r-title-${prop} was emitted unset`);
  }
});

test("a role nobody configured emits nothing", () => {
  const vars = roleTypeVars({ _type: { title: { size: "20px" } } });
  for (const role of ["eyebrow", "body", "cta"]) {
    assert.ok(!Object.keys(vars).some((k) => k.startsWith(`--r-${role}-`)), role);
  }
  assert.deepEqual(roleTypeVars({ _type: { title: {} } }), {});
});

test("an empty string is not a setting", () => {
  assert.deepEqual(
    roleTypeVars({ _type: { title: { align: "", font: "", size: "", weight: "", color: "" } } }),
    {},
  );
});

test("a role name the editor does not offer is ignored", () => {
  assert.deepEqual(roleTypeVars({ _type: { caption: { size: "20px" } } }), {});
  // Including the ones that resolve on Object.prototype.
  assert.deepEqual(roleTypeVars({ _type: { constructor: { size: "20px" } } }), {});
});

/* ── Malformed payloads, which must not throw on the way to a page ──────── */

test("a _type that is not an object is no styling rather than a crash", () => {
  for (const bad of [null, undefined, "title", 42, true, ["title"], [], NaN]) {
    assert.deepEqual(roleTypeVars({ _type: bad }), {}, String(bad));
  }
  assert.deepEqual(roleTypeVars({}), {});
});

test("only a plain object of roles is read, not merely something carrying the keys", () => {
  // A truthiness check alone would pass all of these: a function and an array
  // both hold properties. blockStyle runs against the admin editor's live
  // state as well as against parsed JSON, so "it is not null" is not the same
  // question as "it is a map of roles".
  const asFunction = Object.assign(() => {}, { title: { size: "20px" } });
  assert.deepEqual(roleTypeVars({ _type: asFunction }), {}, "function");
  const asArray: unknown[] & { title?: unknown } = [];
  asArray.title = { size: "20px" };
  assert.deepEqual(roleTypeVars({ _type: asArray }), {}, "array");
});

test("a role whose value is not an object is skipped, and its siblings still render", () => {
  for (const bad of [null, "20px", 42, true, ["20px"]]) {
    const vars = roleTypeVars({ _type: { title: bad, body: { size: "16px" } } });
    assert.deepEqual(vars, { "--r-body-size": "16px" }, String(bad));
  }
});

test("a role's own settings must be a plain object too", () => {
  const asFunction = Object.assign(() => {}, { size: "20px" });
  assert.deepEqual(roleTypeVars({ _type: { title: asFunction } }), {}, "function");
  const asArray: unknown[] & { size?: unknown } = [];
  asArray.size = "20px";
  assert.deepEqual(roleTypeVars({ _type: { title: asArray } }), {}, "array");
});

/* ── The allow-lists ────────────────────────────────────────────────────── */

test("nothing an editor can type escapes into a second declaration", () => {
  const injections: Array<[string, unknown]> = [
    ["align", "center;color:red"],
    ["align", "center; }"],
    ["font", 'title"/**/'],
    ["font", "constructor"],
    ["font", "toString"],
    ["size", "url(x)"],
    // A CSS url() inside a length still fetches, so the parens rule has to look
    // inside the clamp rather than trusting the shape of it.
    ["size", "clamp(1px,url(x),2px)"],
    ["size", "16px;background:url(x)"],
    ["size", "expression(alert(1))"],
    ["color", "red;background:url(x)"],
    ["color", "url(https://evil.example/p.gif)"],
    ["color", "image-set(url(x))"],
    ["weight", "900;x"],
    ["weight", "bold"],
    ["weight", "950"],
  ];
  for (const [prop, value] of injections) {
    const vars = roleTypeVars({ _type: { title: { [prop]: value } } });
    assert.deepEqual(vars, {}, `${prop}: ${String(value)}`);
  }
});

test("a rejected value costs the role only that one property", () => {
  // A single all-or-nothing check would let one bad figure take the whole role
  // with it, which is how a typo in the size box turns into a block that lost
  // its colour too.
  const vars = roleTypeVars({
    _type: {
      title: { align: "center;color:red", font: "title", size: "url(x)", weight: "600", color: "#a56d43" },
    },
  });
  assert.deepEqual(vars, {
    "--r-title-font": "var(--font-title)",
    "--r-title-weight": "600",
    "--r-title-color": "#a56d43",
  });
});

test("a rejected value in one role does not touch another role", () => {
  const vars = roleTypeVars({
    _type: {
      eyebrow: { color: "red;background:url(x)" },
      title: { color: "#283d34" },
    },
  });
  assert.deepEqual(vars, { "--r-title-color": "#283d34" });
});

test("no emitted value carries a declaration separator", () => {
  const vars = roleTypeVars({
    _type: Object.fromEntries(ROLES.map((role) => [role, {
      align: "center", font: "body", size: "clamp(16px, 2vw, 24px)", weight: "700", color: "rgb(40, 61, 52)",
    }])),
  });
  // Five per role, plus the CTA's align-self.
  assert.equal(Object.keys(vars).length, 21);
  for (const [key, value] of Object.entries(vars)) {
    assert.ok(!/[;{}<>\\"']/.test(value), `${key} carries "${value}"`);
  }
});

/* ── Reaching the page through blockStyle ───────────────────────────────── */

test("role settings alone are enough to produce a style object", () => {
  // The early return used to list only the block-wide settings, so a block
  // whose author touched nothing but the typography panel got undefined back
  // and the whole panel did nothing.
  const style = blockStyle({ _type: { title: { size: "40px" } } }) as Record<string, unknown>;
  assert.ok(style, "a role-only block must still get a style attribute");
  assert.equal(style["--r-title-size"], "40px");
});

test("a _type carrying nothing usable still means no style object", () => {
  assert.equal(blockStyle({ _type: { title: { size: "url(x)" } } }), undefined);
  assert.equal(blockStyle({ _type: "nonsense" }), undefined);
  assert.equal(blockStyle({ _type: { caption: { size: "20px" } } }), undefined);
});

test("role variables ride alongside the block's own settings", () => {
  const style = blockStyle({
    _bgColor: "#283d34",
    _padX: 88,
    _textVAlign: "center",
    _type: { title: { size: "40px", color: "#ffffff" }, body: { align: "left" } },
  }) as Record<string, unknown>;
  assert.equal(style.backgroundColor, "rgba(40, 61, 52, 1)");
  assert.equal(style.width, "100vw");
  assert.equal(style["--block-text-valign"], "center");
  assert.equal(style["--r-title-size"], "40px");
  assert.equal(style["--r-title-color"], "#ffffff");
  assert.equal(style["--r-body-align"], "left");
});

test("the CTA's align-self reaches the style attribute too", () => {
  const style = blockStyle({ _type: { cta: { align: "right" } } }) as Record<string, unknown>;
  assert.equal(style["--r-cta-align"], "right");
  assert.equal(style["--r-cta-self"], "flex-end");
});

test("a rejected role value does not cost the block its background", () => {
  // The colour band's full-bleed geometry hangs off backgroundColor, so a bad
  // figure in the typography panel taking it down would break the layout, not
  // just the type.
  const style = blockStyle({
    _bgColor: "#283d34",
    _type: { title: { size: "clamp(1px,url(x),2px)", weight: "900;x" } },
  }) as Record<string, unknown>;
  assert.equal(style.backgroundColor, "rgba(40, 61, 52, 1)");
  assert.equal(style.paddingLeft, "calc(50vw - 50%)");
  assert.equal(style["--r-title-size"], undefined);
  assert.equal(style["--r-title-weight"], undefined);
});

test("a block with no typography panel is unchanged", () => {
  // Every existing block goes through this function; none of them may pick up
  // a variable they never asked for.
  const style = blockStyle({ _fontSize: "18px" }) as Record<string, unknown>;
  assert.ok(!Object.keys(style).some((k) => k.startsWith("--r-")));
  assert.equal(blockStyle({}), undefined);
});
