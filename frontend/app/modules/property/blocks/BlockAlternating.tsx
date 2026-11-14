import type { Locale } from "../../i18n";
import { cfgT, eyebrowT } from "../../tr";

/**
 * 圖文交錯 (客戶, 八、內容頁版型).
 *
 * Several picture-and-copy rows where the picture changes side each row. This
 * was already achievable by placing N 圖文段落 blocks and setting 圖片方向 on
 * every one of them by hand — which is both tedious and fragile: inserting or
 * reordering a row silently breaks the alternation, because each block stores
 * an absolute side rather than a position in a sequence.
 *
 * Here the side is derived from the index, so it stays correct through any
 * reorder. `flip` starts the run on the other side for an author who wants the
 * first picture on the left.
 */
export type AlternatingConfig = {
  eyebrow?: string | Record<string, string>;
  heading?: string | Record<string, string>;
  flip?: boolean;
  /** 框內 (the default) or 出血, where each picture runs off its own side of
   *  the page and the rows carry 01 / 02 / 03. */
  layout?: "framed" | "bleed";
  items?: Array<{
    image?: string;
    eyebrow?: string | Record<string, string>;
    title?: string | Record<string, string>;
    body?: string | Record<string, string>;
  }>;
};

export default function BlockAlternating({
  locale,
  config,
}: {
  locale: Locale;
  config?: AlternatingConfig;
}) {
  const c = (config ?? {}) as Record<string, unknown>;
  const eyebrow = eyebrowT(c, locale);
  const heading = cfgT(c, "heading", locale);
  const flip = c.flip === true;
  /* Allow-listed rather than passed through: it spells a class name, and the
     config it comes from is editor-writable. */
  const layout = c.layout === "bleed" ? "bleed" : "framed";
  /* The row titles sit under this block's own heading when it has one, and
     under the PAGE heading when it does not — in which case an h3 is a level
     skipped, and a reader tabbing the outline is told so. Same reasoning the
     article card already carries for choosing h2 over h3. */
  const RowTitle = heading ? "h3" : "h2";

  const items = (Array.isArray(c.items) ? c.items : [])
    .map((raw) => {
      const item = raw as Record<string, unknown>;
      return {
        image: typeof item.image === "string" ? item.image : "",
        /* Per ROW, beside the block's own. The design sets a Latin label over
           each row's title (DESIGN / PRIVACY / SERVICE) — one eyebrow for the
           whole block cannot say three different things. */
        eyebrow: cfgT(item, "eyebrow", locale),
        title: cfgT(item, "title", locale),
        body: cfgT(item, "body", locale),
      };
    })
    // A row with neither a picture nor any words is an empty grid cell.
    .filter((item) => item.image || item.title || item.body || item.eyebrow);

  if (!items.length) return null;

  return (
    <section className={`section alternating-section${layout === "bleed" ? " is-bleed" : ""}`}>
      {(eyebrow || heading) && (
        <div className="section-header">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {heading && <h2>{heading}</h2>}
          </div>
        </div>
      )}
      {items.map((item, i) => {
        /* The side comes from the position, never from stored state — that is
           the whole point of this block over a hand-set run of 圖文段落. */
        const imgLeft = flip ? i % 2 === 0 : i % 2 === 1;
        return (
          <div
            key={i}
            className={`property-rich-text property-rich-text--split alternating-row property-rich-text--img-${imgLeft ? "left" : "right"}`}
          >
            <div className="property-rich-split">
              <div className="property-rich-split-text">
                {/* Counted from the position, like 編號條列 — a stored number
                    goes stale the moment a row is inserted or reordered, which
                    is the whole reason this block derives the picture's side
                    from the index too. */}
                {layout === "bleed" && (
                  <span className="alternating-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                )}
                {item.eyebrow && <div className="eyebrow alternating-row-eyebrow">{item.eyebrow}</div>}
                {item.title && <RowTitle>{item.title}</RowTitle>}
                {item.body && (
                  <div className="property-rich-text-body">
                    <p>{item.body}</p>
                  </div>
                )}
              </div>
              {item.image && (
                <div className="property-rich-split-media">
                  {/* Decorative when the row already shows its title: alt={title}
                      made a screen reader read the same words twice, once for the
                      heading and once for the picture beside it. With no title
                      there is nothing to duplicate, so the row's own words are
                      the best description available. */}
                  <img src={item.image} alt={item.title ? "" : item.body} loading="lazy" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
