import Link from "next/link";
import { getLocale, publicUiText } from "../modules/i18n";

/**
 * The page a visitor lands on after a typo, a stale bookmark, or a link that
 * outlived the page it pointed at.
 *
 * There was no `not-found` file at all, so every 404 fell through to Next's
 * built-in one: the word "Slowfield Stays" on an otherwise blank page, in the
 * root layout only — no header, no navigation, no message, and no link back
 * into the site, in either language. Someone who mistyped a URL had nowhere to
 * go but the back button.
 *
 * Living inside the `(site)` group means this renders with the real header and
 * footer, so the way onward is the site's own navigation rather than anything
 * invented here. The two links below are for the case where a visitor's eye
 * goes to the middle of the page and not the nav.
 */
export default async function SiteNotFound() {
  const locale = await getLocale();
  const zh = locale === "zh";
  const copy = publicUiText(locale);

  return (
    <main className="notfound-page section">
      <p className="notfound-code" aria-hidden="true">404</p>
      <h1>{copy.notFound}</h1>
      <p className="notfound-lead">
        {zh
          ? "這個網址可能已經更改或不再存在。你可以回到首頁，或直接看看目前的房源。"
          : "This address may have changed, or it may never have existed. Head back to the homepage, or take a look at the stays we have now."}
      </p>
      <div className="notfound-actions">
        <Link className="notfound-btn" href="/">
          {zh ? "回到首頁" : "Back to homepage"}
        </Link>
        <Link className="notfound-btn notfound-btn--ghost" href="/stays">
          {zh ? "瀏覽住宿" : "Browse stays"}
        </Link>
      </div>
    </main>
  );
}
