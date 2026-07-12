import type { BulkAction, BulkDialogState, BulkFailure, BulkScope } from "./types";
import { t, type MessageKey } from "../../../shared/i18n";

export function actionProgressLabel(action: BulkAction): string {
  if (action === "delete") {
    return t("bulk_progress_delete");
  }
  return action === "archive" ? t("bulk_progress_archive") : t("bulk_progress_export");
}

export function actionProgressTitle(action: BulkAction): string {
  if (action === "delete") {
    return t("bulk_dialog_title_deleting_chats");
  }
  return action === "archive" ? t("bulk_dialog_title_archiving_chats") : t("bulk_dialog_title_exporting_chats");
}

export function actionPastLabel(action: BulkAction): string {
  if (action === "delete") {
    return t("bulk_past_delete");
  }
  return action === "archive" ? t("bulk_past_archive") : t("bulk_past_export");
}

export function actionConfirmLabel(action: BulkAction): string {
  if (action === "delete") {
    return t("bulk_confirm_delete");
  }
  return action === "archive" ? t("bulk_confirm_archive") : t("bulk_confirm_export");
}

export function completionToastMessage(
  action: BulkAction,
  succeeded: number,
  failed: BulkFailure[],
  scope: BulkScope
): string {
  let successMessage = "";
  if (action === "delete" && scope === "all" && failed.length === 0) {
    successMessage = t("bulk_toast_deleted_all");
  } else {
    if (succeeded === 1) {
      successMessage = t(`bulk_toast_${action}_singular` as MessageKey);
    } else {
      successMessage = t(`bulk_toast_${action}_plural` as MessageKey, [String(succeeded)]);
    }
  }

  let failureMessage = "";
  if (failed.length > 0) {
    const err = failed[0]?.error ? `: ${failed[0].error}` : ".";
    if (failed.length === 1) {
      failureMessage = t("bulk_toast_failed_singular", [err]);
    } else {
      failureMessage = t("bulk_toast_failed_plural", [String(failed.length), err]);
    }
  }

  return `${successMessage}${failureMessage}`;
}

export function bulkDialogTitle(dialog: BulkDialogState | null): string {
  if (dialog?.status === "running") {
    return dialog.scope === "all" && dialog.action === "delete"
      ? t("bulk_dialog_title_deleting_all")
      : actionProgressTitle(dialog.action);
  }

  if (dialog?.status === "confirm") {
    if (dialog.scope === "all" && dialog.action === "delete") {
      return t("bulk_dialog_title_confirm_delete_all");
    }

    if (dialog.action === "delete") {
      return t("bulk_dialog_title_confirm_delete");
    }

    return dialog.action === "archive" ? t("bulk_dialog_title_confirm_archive") : t("bulk_dialog_title_confirm_export");
  }

  return t("bulk_dialog_title_confirm_batch");
}

export function bulkDialogDescription(dialog: BulkDialogState | null): string {
  if (dialog?.status === "running") {
    return dialog.scope === "all" && dialog.action === "delete"
      ? t("bulk_dialog_desc_running_all")
      : t("bulk_dialog_desc_running_remaining", [String(dialog.remaining), String(dialog.total)]);
  }

  if (dialog?.status === "confirm") {
    if (dialog.scope === "all" && dialog.action === "delete") {
      return t("bulk_dialog_desc_confirm_delete_all");
    }

    if (dialog.action === "export") {
      return dialog.items.length === 1
        ? t("bulk_dialog_desc_confirm_export_singular")
        : t("bulk_dialog_desc_confirm_export_plural", [String(dialog.items.length)]);
    }

    if (dialog.action === "delete") {
      return dialog.items.length === 1
        ? t("bulk_dialog_desc_confirm_delete_singular")
        : t("bulk_dialog_desc_confirm_delete_plural", [String(dialog.items.length)]);
    }

    // archive
    return dialog.items.length === 1
      ? t("bulk_dialog_desc_confirm_archive_singular")
      : t("bulk_dialog_desc_confirm_archive_plural", [String(dialog.items.length)]);
  }

  return "";
}
