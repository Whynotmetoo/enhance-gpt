import type { ReactElement } from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { t } from "../shared/i18n";
import {
  FEEDBACK_EMAIL,
  GITHUB_REPOSITORY_URL,
  SUPPORT_EXTENSION_URL
} from "../shared/constants";
import "./styles.css";

function OptionsApp(): ReactElement {
  return (
    <main className="options-page">
      <section className="options-panel" aria-labelledby="options-title">
        <img className="extension-icon" src="/icons/128.png" alt="" width="88" height="88" />
        <div className="options-copy">
          <h1 id="options-title">{t("extName")}</h1>
          <p className="description">{t("options_desc")}</p>
        </div>

        <nav className="support-links" aria-label="Support links">
          <a href={GITHUB_REPOSITORY_URL} target="_blank" rel="noreferrer">
            <span>{t("options_github")}</span>
            <strong>{t("options_view_source")}</strong>
          </a>
          <a href={SUPPORT_EXTENSION_URL} target="_blank" rel="noreferrer">
            <span>{t("options_support")}</span>
            <strong>{t("options_donate")}</strong>
          </a>
          <a href={`mailto:${FEEDBACK_EMAIL}`}>
            <span>{t("options_feedback")}</span>
            <strong>{FEEDBACK_EMAIL}</strong>
          </a>
        </nav>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>
);
