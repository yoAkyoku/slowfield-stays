import type { Locale } from "../../i18n";
import { t } from "../../i18n";
import { cfgT , eyebrowT} from "../../tr";

export type FlowStep = {
  title?: string | Record<string, string>;
  text?: string | Record<string, string>;
};

export type BlockFlowConfig = {
  eyebrow?: string | Record<string, string>;
  title?: string | Record<string, string>;
  intro?: string | Record<string, string>;
  steps?: FlowStep[];
};

export default function BlockFlow({ locale, config }: { locale: Locale; config?: BlockFlowConfig }) {
  const { home: h } = t(locale);
  const c = (config ?? {}) as Record<string, unknown>;

  // Custom steps when provided, otherwise i18n defaults
  const rawSteps = Array.isArray(c.steps) ? (c.steps as FlowStep[]) : [];
  const steps = rawSteps.length > 0
    ? rawSteps.map((s, i) => {
        const it = s as Record<string, unknown>;
        return {
          step: String(i + 1).padStart(2, "0"),
          title: cfgT(it, "title", locale),
          text: cfgT(it, "text", locale),
        };
      })
    : h.bookingFlow.map(([step, title, text]) => ({ step, title, text }));

  return (
    <section className="section home-booking-flow">
      <div className="home-booking-flow-copy">
        {eyebrowT(c, locale, h.bookingFlowEyebrow) && <div className="eyebrow">{eyebrowT(c, locale, h.bookingFlowEyebrow)}</div>}
        <h2>{cfgT(c, "title", locale, h.bookingFlowTitle)}</h2>
        <p>{cfgT(c, "intro", locale, h.bookingFlowIntro)}</p>
      </div>
      <div className="home-booking-flow-steps">
        {steps.map((s) => (
          <div key={s.step}>
            <span>{s.step}</span>
            <strong>{s.title}</strong>
            <p>{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
