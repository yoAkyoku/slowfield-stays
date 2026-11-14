import { getLocale, t } from "../../modules/i18n";
import LanguageToggle from "../../modules/LanguageToggle";
import "../ui/admin-legacy.css";
import "../ui/admin-ui.css";
import "./admin-auth.css";
import LoginForm from "./LoginForm";

export default async function AdminLoginPage(props: { searchParams?: Promise<{ expired?: string }> }) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copy = t(locale);
  const expiredNotice = searchParams?.expired ? (locale === "zh" ? "登入狀態已過期，請重新登入。" : "Your session has expired. Please sign in again.") : "";

  return (
    <main className="admin-auth a-auth">
      <header className="a-auth__top">
        <span className="a-auth__brand"><span className="a-auth__mark" aria-hidden="true">S</span>Slowfield Stays</span>
        <LanguageToggle locale={locale} />
      </header>
      <section className="a-auth__main">
        <div className="a-auth__card">
          <div className="a-auth__head">
            <p className="a-eyebrow">{copy.admin.topKicker}</p>
            <h1 className="a-page-title">Slowfield CMS</h1>
            <p className="a-page-desc">{copy.admin.topTitle}</p>
          </div>
          <LoginForm initialNotice={expiredNotice} labels={copy.admin} />
        </div>
      </section>
    </main>
  );
}
