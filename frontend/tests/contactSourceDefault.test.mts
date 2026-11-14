import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode.mts";

/**
 * A contact enquiry with no configured 詢問類型 is "website", never "booking".
 *
 * This file existed before, guarding `app/(site)/contact/InquiryForm.tsx`, and
 * was deleted along with that component when the contact form became a block.
 * The guarantee did not move with it: `ContactFormBlock` fell back to
 * `typeOptions[0]`, and `typeOptions` falls back to `L.sourceOptions`, whose
 * first entry is `["住宿詢問", "booking"]`. So the ordinary path — a site that
 * has never filled in 詢問類型, which is every site by default — filed press,
 * careers and franchise enquiries as room requests, exactly as before.
 *
 * Nothing on screen says so. 諮詢類型 was removed from the form deliberately
 * (客戶: 移除「諮詢類型」欄位), so `source` is invisible to the visitor and the
 * guess arrives in the inbox as a fact; 來源分流, the panel whose whole job is
 * to say where enquiries come from, reported BOOKING as the top source whatever
 * anyone wrote.
 *
 * "website" is the value the API documents for this case (InquiryCreate
 * defaults to it) and the admin already renders an unspecified source as
 * 未指定來源.
 */

const BLOCK = readCode("app/modules/content/ContactFormBlock.tsx");

test("an unconfigured block does not file every enquiry as a booking", () => {
  /* The distinction that matters is which list is indexed. `inquiryTypes` is
     what the editor configured; `typeOptions` is that list OR the built-in one,
     and the built-in one starts with 訂房. */
  assert.match(
    BLOCK,
    /source:\s*isBooking\s*\?\s*"booking"\s*:\s*\(inquiryTypes\[0\]\?\.\[1\]\s*\|\|\s*"website"\)/,
    "the enquiry source falls back to the built-in list again, whose first entry is booking",
  );
  assert.doesNotMatch(
    BLOCK,
    /source:[^;\n]*typeOptions\[0\]/,
    "typeOptions falls through to L.sourceOptions — indexing it reintroduces the booking default",
  );
});

test("the built-in list still starts with 訂房, which is why the above matters", () => {
  /* If this ever stops being true the test above is guarding nothing, and the
     comment explaining it becomes a lie. Pinned so the two move together. */
  const zh = BLOCK.slice(BLOCK.indexOf("sourceOptions: ["));
  assert.ok(zh.length > 0, "sourceOptions is gone — re-anchor this test");
  assert.match(
    zh.slice(0, 120),
    /\["住宿詢問",\s*"booking"\]/,
    "the built-in first entry moved; re-check what an unconfigured block now defaults to",
  );
});

test("a booking form still says booking", () => {
  // The correction must not take the one case that genuinely IS a booking.
  assert.match(BLOCK, /isBooking\s*\?\s*"booking"/, "the booking form no longer files as a booking");
});

test("an emptied 人數 field does not become 0", () => {
  /* `Number(formData.get("guests") ?? 2)` looks guarded and is not: an emptied
     number input posts "" — not null — so `??` never fires and Number("") is 0.
     The field has no `required` and a min of 1, so clearing it is an ordinary
     thing for a visitor to do, and the inbox recorded a booking for nobody. */
  assert.match(
    BLOCK,
    /rawGuests && Number\.isFinite\(guests\) && guests > 0 \? guests : 2/,
    "an empty 人數 field sends guests: 0 again",
  );
  assert.doesNotMatch(
    BLOCK,
    /payload\.guests = Number\(formData\.get\("guests"\) \?\? 2\)/,
    "the `??` form is back, and it does not catch an empty string",
  );
  /* And the ceiling, because the API is ge=1/le=20 on both schemas: without a
     `max` the browser accepts 25, the request 422s, and the visitor sees only
     the generic failure message. */
  assert.match(BLOCK, /name="guests" type="number" min="1" max="20"/, "the 人數 field lost its upper bound");
});
