import type { ReactElement } from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { t } from "../shared/i18n";
import {
  GITHUB_NEW_ISSUE_URL,
  GITHUB_REPOSITORY_URL,
  SUPPORT_EXTENSION_URL
} from "../shared/constants";
import "./styles.css";

function PopupApp(): ReactElement {
  return (
    <main className="popup-page">
      <header className="popup-header">
        <img src="/icons/48.png" alt="" width="40" height="40" />
        <div>
          <h1>{t("extName")}</h1>
          <p>{t("popup_active")}</p>
        </div>
      </header>

      <nav className="popup-actions" aria-label="Extension links">
        <a href={SUPPORT_EXTENSION_URL} target="_blank" rel="noreferrer">
          {t("popup_support")}
        </a>
        <a href={GITHUB_REPOSITORY_URL} target="_blank" rel="noreferrer">
          {t("popup_github")}
        </a>
        <a href={GITHUB_NEW_ISSUE_URL} target="_blank" rel="noreferrer">
          {t("popup_issue")}
        </a>
      </nav>
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>
);
