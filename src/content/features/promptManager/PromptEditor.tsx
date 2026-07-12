import type { ReactElement, RefObject } from "react";
import { t } from "../../../shared/i18n";
import type { PromptDraft, PromptEditorMode } from "./types";

type PromptEditorProps = {
  bodyError: string | null;
  draft: PromptDraft;
  mode: PromptEditorMode;
  onCancel: () => void;
  onChange: (draft: PromptDraft) => void;
  onSave: () => void;
  titleError: string | null;
  titleInputRef: RefObject<HTMLInputElement | null>;
};

export function PromptEditor({
  bodyError,
  draft,
  mode,
  onCancel,
  onChange,
  onSave,
  titleError,
  titleInputRef
}: PromptEditorProps): ReactElement {
  const titleId = `ecg-prompt-${mode.kind}-title`;
  const bodyId = `ecg-prompt-${mode.kind}-body`;
  const isSaveDisabled = draft.title.trim() === "" || draft.body.trim() === "";

  return (
    <div className="ecg-prompt-editor">
      <div className="ecg-prompt-field">
        <label htmlFor={titleId}>{t("prompt_editor_title_label")}</label>
        <input
          aria-invalid={Boolean(titleError)}
          className="ecg-prompt-input"
          id={titleId}
          maxLength={120}
          placeholder={t("prompt_editor_title_placeholder")}
          ref={titleInputRef}
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
        />
        {titleError ? <span className="ecg-prompt-error">{titleError}</span> : null}
      </div>
      <div className="ecg-prompt-field">
        <label htmlFor={bodyId}>{t("prompt_editor_body_label")}</label>
        <textarea
          aria-invalid={Boolean(bodyError)}
          className="ecg-prompt-textarea"
          id={bodyId}
          placeholder={t("prompt_editor_body_placeholder")}
          rows={6}
          value={draft.body}
          onChange={(event) => onChange({ ...draft, body: event.target.value })}
        />
        {bodyError ? <span className="ecg-prompt-error">{bodyError}</span> : null}
      </div>
      <div className="ecg-prompt-editor-actions">
        <button className="ecg-prompt-secondary" type="button" onClick={onCancel}>
          {t("prompt_editor_cancel")}
        </button>
        <button
          className="ecg-prompt-primary"
          data-invalid={isSaveDisabled ? "true" : undefined}
          disabled={isSaveDisabled}
          type="button"
          onClick={onSave}
        >
          {t("prompt_editor_save")}
        </button>
      </div>
    </div>
  );
}
