import { Mail } from "lucide-react";
import { sanitizeRichHtml } from "../../../modules/safeHtml";

/** The live mail mock beside the composer and the campaign detail view. */
export default function EmailPreview({
  subject,
  bodyHtml,
  footer,
  zh
}: {
  subject: string;
  bodyHtml: string;
  footer: string;
  zh: boolean;
}) {
  return (
    <aside className="nl-compose-preview">
      <div className="nl-preview-chrome">
        <div className="nl-preview-dots">
          <span />
          <span />
          <span />
        </div>
        <span>{zh ? "即時預覽" : "Live Preview"}</span>
      </div>
      <div className="nl-preview-body">
        <div className="nl-preview-header">
          <div className="nl-preview-logo">S</div>
          <span>Slowfield Stays</span>
        </div>
        <div className="nl-preview-content">
          <h2>{subject || (zh ? "電子報主旨" : "Newsletter Subject")}</h2>
          <div className="nl-preview-divider" />
          {bodyHtml ? (
            <div className="nl-preview-text nl-preview-rich" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(bodyHtml) }} />
          ) : (
            <div className="nl-preview-placeholder">
              <Mail size={32} />
              <p>{zh ? "開始輸入內容以預覽…" : "Start typing to see a preview…"}</p>
            </div>
          )}
        </div>
        <div className="nl-preview-footer">
          <small>{footer}</small>
          <small>&copy; Slowfield Stays</small>
        </div>
      </div>
    </aside>
  );
}
