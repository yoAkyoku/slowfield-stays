"use client";

import { FileText } from "lucide-react";
import { Button, Callout, Card, Check, Field, FormActions, FormSection, Input, Stack } from "../../../ui";
import EmailPreview from "../EmailPreview";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { stripClipboardFragmentMarkers } from "../../../../modules/safeHtml";
import RichTextEditor from "../../../modules/RichTextEditor";

/** One tab, one site, one draft.
 *
 *  Namespaced so it cannot collide with another editor's, and keyed by site
 *  because the admin switches between the parent and each villa in the same
 *  tab: with a single key, starting a newsletter for one site and then opening
 *  the composer for another restored the first site's subject, target groups
 *  and — on a parent — its recipient scope, into a form that would send it
 *  somewhere else entirely. */
const draftKey = (siteSlug: string) => `nl-compose-draft:${siteSlug || "unknown"}`;

type Copy = Record<string, unknown> & {
  createCampaign: string;
  saveCampaign: string;
  subject: string;
  body: string;
  targetGroups: string;
  targetPlaceholder: string;
  allSubscribers: string;
};

/* The composer used to carry its own toolbar and its own contentEditable —
   six controls (bold, italic, H2, body, image, divider) against the shared
   editor's twenty. It had no link button at all, its image insert was a
   window.prompt asking the author to go and find a URL while the admin already
   has an uploader and a media library, and every control was mousedown-only,
   so none of them answered the keyboard. It is the shared RichTextEditor now
   (客戶: 新建電子報的內容要做成 WYSIWYG，內容塊同款), which is the same
   component the content blocks use. */

export default function ComposePanel({
  copy,
  createCampaignAction,
  zh,
  isParentSite = false,
  siteSlug = "",
}: {
  copy: Copy;
  createCampaignAction: (fd: FormData) => Promise<void>;
  zh: boolean;
  isParentSite?: boolean;
  /** Which site this newsletter is for — see draftKey. */
  siteSlug?: string;
}) {
  /** This site's draft slot. Stable for the life of the page. */
  const storageKey = draftKey(siteSlug);
  const [subject, setSubject] = useState("");
  const [groups, setGroups] = useState("");
  const [scope, setScope] = useState<"self" | "self+children">("self");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  /* The body, held here rather than read out of the DOM. The preview used to
     read the editor node's innerHTML during render while typing only wrote to
     a hidden input — no state changed, so a keystroke re-rendered nothing and
     the preview caught up only when something else happened to cause a render
     (客戶: 預覽好像沒有很同步…點一下其他地方就有了). One value now feeds the
     editor, the hidden input and the preview, so 「即時預覽」 is literal and
     what gets submitted is what is on screen. */
  const [bodyHtml, setBodyHtml] = useState("");
  /** Shown once when a draft came back, so whoever opens the editor knows why
   *  there is text in it they did not just type. */
  const [restored, setRestored] = useState(false);

  /* 客戶: 待測試 — 自動儲存是否正常.
     It was not, because there was none: this panel had no effect, no timer and
     no storage, and its only write was the submit button. A newsletter written
     and not submitted was gone when the tab closed, with no warning. What the
     client read as "it saves once you click elsewhere" was the preview catching
     up, not a save.

     A local draft rather than a server-side one: a campaign row per keystroke
     would fill the campaign list with empties, and this panel's real save is
     one click away. sessionStorage keeps the draft to the tab that typed it —
     the same rule useFormDraft follows — so a stale draft cannot ambush
     whoever opens the editor next. */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const d = JSON.parse(raw) as { subject?: string; groups?: string; scope?: string; body?: string };
      if (d.subject) setSubject(d.subject);
      if (d.groups) setGroups(d.groups);
      if (d.scope === "self" || d.scope === "self+children") setScope(d.scope);
      // The editor, the hidden input and the preview all read this one value,
      // so restoring a draft is a setState and nothing else.
      if (d.body) setBodyHtml(stripClipboardFragmentMarkers(d.body));
      setRestored(Boolean(d.subject || d.body));
    } catch {
      // Private mode, or nonsense under the key. A bad draft must never stop
      // the editor from opening.
    }
    // restoredRef makes this run once whatever the deps say; storageKey is
    // named so the rule can see the value this reads.
  }, [storageKey]);

  /* Written on a timer rather than per keystroke: stringifying a long
     newsletter on every character is work nobody asked for. */
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        if (!subject && !groups && !bodyHtml) {
          sessionStorage.removeItem(storageKey);
          return;
        }
        sessionStorage.setItem(storageKey, JSON.stringify({ subject, groups, scope, body: bodyHtml }));
      } catch { /* storage unavailable; the editor still works without it */ }
    }, 600);
    return () => window.clearTimeout(id);
  }, [subject, groups, scope, bodyHtml, storageKey]);

  const handleSubmit = useCallback(
    (fd: FormData) => {
      /* The hidden input already carries this, but it is set explicitly so the
         body cannot be one render behind what the author sees. It is the
         sanitised html — the editor emits through sanitizeRichHtml — which is
         also what the preview renders, so the two can no longer disagree. */
      fd.set("body", stripClipboardFragmentMarkers(bodyHtml));
      /* The draft is NOT cleared here.
         It used to be, on the reasoning that the campaign now exists — but
         createCampaignAction redirects on failure as well as on success
         (adminUtils.actionRedirect), so the one path where the draft is the
         only copy of the work was also the path that deleted it. A safety net
         that lets go exactly when it is needed is worse than none.
         An empty compose form clears the key on its own (see the timer above),
         so the cost of keeping it is that reopening 新建電子報 after a
         successful create may restore what was just created — visible, labelled
         by the notice, and undoable by clearing the form. Losing an unsent
         newsletter is not. */
      startTransition(async () => {
        await createCampaignAction(fd);
      });
    },
    [createCampaignAction, bodyHtml],
  );

  return (
    <div className="nlx-compose">
      {/* Left: Editor */}
      <form ref={formRef} action={handleSubmit}>
        <Card>
          <Stack>
            {/* The draft is silent while it works; it only speaks when it has put
                text back, because unexplained content in a form reads as a bug. */}
            {restored && (
              <Callout tone="info">
                <span role="status">
                  {zh
                    ? "已回復上次未送出的草稿。內容只留在這個瀏覽器分頁，按下「建立電子報」才會真正儲存。"
                    : "Restored your unsent draft. It lives only in this browser tab — press Create campaign to save it properly."}
                </span>
              </Callout>
            )}

            <Field label={copy.subject} required>
              <Input
                name="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={zh ? "輸入電子報主旨..." : "Enter newsletter subject..."}
                required
              />
            </Field>

            <Field label={copy.targetGroups}>
              <Input
                name="target_groups"
                value={groups}
                onChange={(e) => setGroups(e.target.value)}
                placeholder={copy.targetPlaceholder}
              />
            </Field>

            {isParentSite && (
              <FormSection title={zh ? "收件範圍" : "Recipient scope"}>
                <Stack gap="sm">
                  <Check
                    checked={scope === "self"}
                    label={zh ? "只寄母站訂閱者" : "Parent site subscribers only"}
                    name="recipient_scope"
                    onChange={() => setScope("self")}
                    type="radio"
                    value="self"
                  />
                  <Check
                    checked={scope === "self+children"}
                    label={zh ? "寄母站 + 所有子站訂閱者" : "Parent + all child sites"}
                    name="recipient_scope"
                    onChange={() => setScope("self+children")}
                    type="radio"
                    value="self+children"
                  />
                </Stack>
              </FormSection>
            )}

            <div className="a-field">
              <span className="a-field__label">{copy.body}</span>
              {/* 圖片、影片與連結都在這個工具列上：圖片走媒體庫，影片插入封面圖＋
                  連結（信件不能播放影片），連結有 https 檢查。 */}
              <RichTextEditor
                value={bodyHtml}
                onChange={setBodyHtml}
                variant="full"
                showDivider
                showVideo
                videoLabel={zh ? "▶ 觀看影片" : "▶ Watch the video"}
                minRows={14}
                placeholder={zh ? "在這裡撰寫電子報內容..." : "Write your newsletter content here..."}
              />
              <input type="hidden" name="body" value={bodyHtml} readOnly />
            </div>

            <FormActions sticky>
              <Button
                disabled={isPending}
                icon={isPending ? <span className="admin-spinner" /> : <FileText />}
                type="submit"
                variant="primary"
              >
                {copy.saveCampaign}
              </Button>
            </FormActions>
          </Stack>
        </Card>
      </form>

      {/* Right: Live Preview */}
      <EmailPreview bodyHtml={bodyHtml} footer={groups || copy.allSubscribers} subject={subject} zh={zh} />
    </div>
  );
}
