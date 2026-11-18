import { siteContentTypesFromConfig } from "../app/admin/modules/siteContentTypes.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { stayIdFromSearch } from "../app/modules/contactContext.ts";
import { readCode } from "./readCode.mts";
test("detail enquiry preserves a valid stay id and rejects malformed ids", () => {
  assert.equal(stayIdFromSearch("?stay=2"), 2);
  for (const search of ["", "?stay=", "?stay=0", "?stay=-1", "?stay=2.5", "?stay=Infinity", "?stay=abc", "?stay=9007199254740992"]) assert.equal(stayIdFromSearch(search), undefined);
  assert.match(readCode("app/modules/content/ContactFormBlock.tsx"), /payload\.stay_id = stayId/);
});
test("newsletter batch actions return results rather than redirects", () => {
  const actions = readCode("app/admin/modules/newsletterActions.ts");
  for (const name of ["processCampaignAction", "scheduleCampaignAction"]) {
    const section = actions.split(`export async function ${name}`)[1].split("export async function")[0];
    assert.match(section, /return result/);
    assert.doesNotMatch(section, /actionRedirect|newsletterPost/);
  }
});
test("existing newsletter edits use the same rich editor as new campaigns", () => {
  const detail=readCode("app/admin/(dashboard)/newsletter/[id]/CampaignDetail.tsx");
  assert.match(detail, /<RichTextEditor/);
  assert.match(detail, /type="hidden" name="body" value=\{bodyText\}/);
  assert.doesNotMatch(detail, /<textarea/);
});

test("legacy block pages do not become article categories after saving", () => {
  const site={parent_site_id:null,settings:{pages:{
    contact:{blocks:[{type:"contact_form",config:{}}]},
    news:{label:{zh:"最新消息",en:"News"}},
    experience:{page_type:"cms_list",content_type:"experience",blocks:[]},
  }}};
  assert.deepEqual(siteContentTypesFromConfig(site as never).map(item=>item.key).sort(),["experience","news"]);
});

test("subscriber recovery is reachable and write controls respect permissions", () => {
  const panel=readCode("app/admin/(dashboard)/newsletter/panels/SubscriberPanel.tsx");
  const page=readCode("app/admin/(dashboard)/newsletter/page.tsx");
  assert.match(panel, /aria-label=\{zh \? "\u986f\u793a\u7bc4\u570d"/);
  assert.match(panel, /router.push\(e.target.value === "deleted"/);
  assert.match(panel, /canWrite && !inBin && showAddForm/);
  // Row buttons sit in the kit's always-visible <RowActions>, still gated by canWrite.
  assert.match(panel, /canWrite && <(RowActions\b|div className="nl-row-actions")/);
  assert.match(page, /<SubscriberPanel[\s\S]*?canWrite=\{hasPermission\(profile.permissions, "newsletter:write"\)\}/);
  assert.match(page, /<SubscriberPanel[\s\S]*?inBin=\{inBin\}/);
});


test("subscriber mobile tables retain readable columns and a scroll region", () => {
  const css=readCode("app/globals.css");
  const panel=readCode("app/admin/(dashboard)/newsletter/panels/SubscriberPanel.tsx");
  // The kit table keeps a 640px floor on narrow screens and scrolls inside its
  // frame; status pills are kit badges, which never wrap.
  assert.match(css, /\.a-table-scroll > \.a-table \{ min-width: 640px; \}/);
  assert.match(css, /\.a-badge \{[^}]*white-space: nowrap/);
  assert.match(panel, /role="region" aria-label=/);
  assert.match(panel, /tabIndex=\{0\}/);
});

test("homepage news cards render every selected card label", () => {
  /* The grid hands every label to the shared NewsCard, which prints them all. */
  const news = readCode("app/modules/home/blocks/NewsCategoryFilter.tsx");
  assert.match(news, /tags=\{card\.tags\}/);
  assert.doesNotMatch(news, /card\.tags\[0\]/);
  const card = readCode("app/modules/content/cards.tsx");
  assert.match(card.slice(card.indexOf("export function NewsCard")), /tags\.map\(/);
});
import { localizeAmenity } from "../app/modules/tr.ts";

test("bilingual amenities print one language even when both halves are Latin", () => {
  for (const sep of [" · ", " | ", "｜"]) {
    assert.equal(localizeAmenity(`WiFi${sep}WiFi`, "zh"), "WiFi");
    assert.equal(localizeAmenity(`游泳池${sep}Pool`, "en"), "Pool");
    assert.equal(localizeAmenity(`游泳池${sep}Pool`, "zh"), "游泳池");
  }
});

test("duplicate subscriber errors stay in the subscriber workflow", () => {
  const action = readCode("app/admin/modules/newsletterActions.ts").split("export async function createSubscriberAction")[1].split("export async function")[0];
  assert.match(action, /adminJsonRequest/);
  assert.doesNotMatch(action, /newsletterPost/);
  assert.match(action, /return result/);
  assert.doesNotMatch(action, /actionRedirect/);
  const panel = readCode("app/admin/(dashboard)/newsletter/panels/SubscriberPanel.tsx");
  assert.match(panel, /if \(!result.ok\) \{ setAddError/);
  assert.match(panel, /if \(!result.ok\) \{ setEditError/);
  assert.match(panel, /event.preventDefault\(\); handleAdd\(new FormData/);
  assert.match(panel, /event.preventDefault\(\); handleEdit\(new FormData/);
  // The edit dialog is the kit <Dialog> (Escape + focus trap via useOverlay inside it),
  // closed through closeEdit and not dismissable by a stray backdrop click.
  assert.match(panel, /<Dialog[\s\S]*?dismissible=\{false\}[\s\S]*?onClose=\{closeEdit\}[\s\S]*?open=\{Boolean\(editSub\)\}/);
});

test("unsubscribe results are announced and missing links use plain language", () => {
  const form = readCode("app/newsletter/unsubscribe/UnsubscribeForm.tsx");
  assert.match(form, /unsub-result--done" role="status"/);
  assert.match(form, /unsub-note--error" role="alert"/);
  const copy = readCode("app/modules/i18n.ts");
  assert.doesNotMatch(copy, /missingToken: "[^"\n]*token/);
});

test("newsletter scheduling validates future time before and during submission", () => {
  const panel = readCode("app/admin/(dashboard)/newsletter/panels/SendPanel.tsx");
  assert.match(panel, /Number.isFinite\(scheduleTimestamp\) && scheduleTimestamp > Date.now\(\)/);
  assert.match(panel, /!Number.isFinite\(timestamp\) \|\| timestamp <= Date.now\(\)/);
  assert.match(panel, /scheduleDate && !validScheduleTime && <p[^>]*role="alert"/);
  const editor = readCode("app/admin/modules/RichTextEditor.tsx");
  assert.match(editor, /role="textbox"/);
  assert.match(editor, /aria-multiline=\{!singleLine\}/);
});

test("retry failures returns to send center for both outcomes", () => {
  const action = readCode("app/admin/modules/newsletterActions.ts").split("export async function retryFailedNewsletterAction")[1].split("export async function")[0];
  assert.match(action, /adminJsonRequest/);
  assert.doesNotMatch(action, /newsletterPost/);
  assert.match(action, /tab=send/);
});

test("zero-recipient campaigns cannot be sent or scheduled", () => {
  const panel = readCode("app/admin/(dashboard)/newsletter/panels/SendPanel.tsx");
  assert.match(panel, /const canSendNow = selected\.length > 0 && totalRecipients > 0 && !sending;/);
  assert.match(panel, /const canSchedule = selected\.length > 0 && totalRecipients > 0 && validScheduleTime && !sending;/);
  assert.match(panel, /if \(selected\.length === 0 \|\| totalRecipients === 0\) return;/);
});

test("send feedback reports delivery failures instead of HTTP-only success", () => {
  const actions=readCode("app/admin/modules/newsletterActions.ts");
  const panel=readCode("app/admin/(dashboard)/newsletter/panels/SendPanel.tsx");
  assert.match(actions, /adminJsonDataRequest<\{ sent: number; failed: number; skipped: number \}>/);
  assert.match(panel, /counts.failed > 0/);
  assert.doesNotMatch(panel, /sent successfully/);
});

test("email test results stay inline and preserve the recipient for retry", () => {
  const panel = readCode("app/admin/(dashboard)/email-settings/EmailTestPanel.tsx");
  assert.match(panel, /testEmailSettingsResult\(data\)/);
  assert.match(panel, /if \(pending\) return/);
  // <Callout live=…> renders the role (see app/admin/ui/Display.tsx).
  assert.match(panel, /(role|live)=\{result.ok \? "status" : "alert"\}/);
  assert.doesNotMatch(panel, /setTimeout|\.reset\(/);
  const action = readCode("app/admin/modules/emailActions.ts").split("export async function testEmailSettingsResult")[1];
  assert.match(action, /return adminJsonRequest/);
  assert.doesNotMatch(action, /actionRedirect/);
});
