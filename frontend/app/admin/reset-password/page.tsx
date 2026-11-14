import { getLocale, t } from "../../modules/i18n";
import LanguageToggle from "../../modules/LanguageToggle";
import "../ui/admin-legacy.css";
import "../ui/admin-ui.css";
import "../login/admin-auth.css";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function AdminResetPasswordPage(props: { searchParams: Promise<{ token?: string }> }) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copy = t(locale);

  return (
    <main className="admin-auth a-auth">
      <header className="a-auth__top">
        <span className="a-auth__brand"><span className="a-auth__mark" aria-hidden="true">S</span>Slowfield Stays</span>
        <LanguageToggle locale={locale} />
      </header>
      <section className="a-auth__main">
        <div className="a-auth__card">
          <div className="a-auth__head">
            <p className="a-eyebrow">{copy.admin.adminSecurity}</p>
            <h1 className="a-page-title">{copy.admin.loginResetPassword}</h1>
            <p className="a-page-desc">{copy.admin.loginResetPasswordText}</p>
          </div>
          <ResetPasswordForm labels={copy.admin} token={searchParams.token ?? ""} />
        </div>
      </section>
    </main>
  );
}
