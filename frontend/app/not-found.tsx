import Link from "next/link";
import { getLocale, publicUiText } from "./modules/i18n";

/**
 * The root 404, for a URL that matches no route group at all.
 *
 * Deliberately standalone: this renders in the root layout, which has no header
 * or footer, and it must not fetch the site to build them — the most likely
 * reason to be here with nothing matched is that something upstream is already
 * unwell, and a 404 page that needs the API to render is a 404 page that fails.
 * `(site)/not-found.tsx` is the one visitors normally see, with full chrome.
 */
export default async function RootNotFound() {
  const locale = await getLocale();
  const zh = locale === "zh";
  const copy = publicUiText(locale);

  return (
    <main className="notfound-page notfound-page--bare section">
      <p className="notfound-code" aria-hidden="true">404</p>
      <h1>{copy.notFound}</h1>
      <p className="notfound-lead">
        {zh
          ? "這個網址可能已經更改或不再存在。"
          : "This address may have changed, or it may never have existed."}
      </p>
      <div className="notfound-actions">
        <Link className="notfound-btn" href="/">
          {zh ? "回到首頁" : "Back to homepage"}
        </Link>
      </div>
    </main>
  );
}
