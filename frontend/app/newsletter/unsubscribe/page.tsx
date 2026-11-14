import Link from "next/link";
import { getCurrentSite } from "../../modules/api";
import { getLocale, publicUiText } from "../../modules/i18n";
import { buildMetadata } from "../../modules/seo";
import UnsubscribeForm from "./UnsubscribeForm";

/**
 * This route had no metadata at all, so it inherited the root layout's title and
 * shipped as a second page called "Slowfield Stays". noIndex because the URL
 * only means anything with a subscriber's token on it: nothing here should rank,
 * and a crawler following an indexed copy would be requesting an unsubscribe.
 */
export async function generateMetadata() {
  const locale = await getLocale();
  const copy = publicUiText(locale).unsubscribe;
  const site = await getCurrentSite();
  return buildMetadata({
    title: copy.title,
    description: copy.body,
    noIndex: true,
    path: "/newsletter/unsubscribe",
    site
  });
}

export default async function UnsubscribePage(props: { searchParams: Promise<{ token?: string }> }) {
  const searchParams = await props.searchParams;
  const token = searchParams.token ?? "";
  const copy = publicUiText(await getLocale()).unsubscribe;
  return (
    <main className="unsub">
      <div className="unsub-card">
        <span className="unsub-eyebrow">{copy.eyebrow}</span>
        <h1 className="unsub-title">{copy.title}</h1>
        <p className="unsub-body">{copy.body}</p>

        <ul className="unsub-scope">
          {copy.scopeItems.map((item) => (
            <li key={item}>
              <span className="unsub-scope-dot" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>

        {token ? (
          <UnsubscribeForm copy={copy} token={token} />
        ) : (
          <p className="unsub-note">{copy.missingToken}</p>
        )}

        <Link className="unsub-back" href="/">
          {copy.back}
        </Link>
      </div>
    </main>
  );
}
