import type { BulkAction, BulkDialogState, BulkFailure, BulkScope } from "./types";

export function actionProgressLabel(action: BulkAction): string {
  if (action === "delete") {
    return "Deleting";
  }
  return action === "archive" ? "Archiving" : "Exporting";
}

export function actionProgressTitle(action: BulkAction): string {
  return `${actionProgressLabel(action)} chats...`;
}

export function actionPastLabel(action: BulkAction): string {
  if (action === "delete") {
    return "Deleted";
  }
  return action === "archive" ? "Archived" : "Exported";
}

export function actionConfirmLabel(action: BulkAction): string {
  if (action === "delete") {
    return "Confirm deletion";
  }
  return action === "archive" ? "Confirm archive" : "Export";
}

export function pluralizeConversation(count: number): string {
  return `${count} conversation${count === 1 ? "" : "s"}`;
}

export function completionToastMessage(
  action: BulkAction,
  succeeded: number,
  failed: BulkFailure[],
  scope: BulkScope
): string {
  const successMessage =
    action === "delete" && scope === "all" && failed.length === 0
      ? "Deleted all chats."
      : `${actionPastLabel(action)} ${pluralizeConversation(succeeded)}.`;
  const failureMessage =
    failed.length > 0
      ? ` ${failed.length} failed${failed[0]?.error ? `: ${failed[0].error}` : "."}`
      : "";

  return `${successMessage}${failureMessage}`;
}

export function bulkDialogTitle(dialog: BulkDialogState | null): string {
  if (dialog?.status === "running") {
    return dialog.scope === "all" && dialog.action === "delete"
      ? "Deleting all chats..."
      : actionProgressTitle(dialog.action);
  }

  if (dialog?.status === "confirm") {
    if (dialog.scope === "all" && dialog.action === "delete") {
      return "Clear your chat history - are you sure?";
    }

    if (dialog.action === "delete") {
      return "Delete chats?";
    }

    return dialog.action === "archive" ? "Archive chats" : "Export chats";
  }

  return "Confirm batch action";
}

export function bulkDialogDescription(dialog: BulkDialogState | null): string {
  if (dialog?.status === "running") {
    return dialog.scope === "all" && dialog.action === "delete"
      ? "Do not close this page until the operation finishes."
      : `${dialog.remaining} of ${dialog.total} remaining. Do not close this page until the operation finishes.`;
  }

  if (dialog?.status === "confirm") {
    return dialog.scope === "all" && dialog.action === "delete"
      ? "This will delete all chats, including those in Projects and archived conversations."
      : dialog.action === "export"
        ? `This will export ${pluralizeConversation(dialog.items.length)} as Markdown. Conversations with assets will download as zip files.`
        : `This will ${dialog.action} ${pluralizeConversation(dialog.items.length)}.`;
  }

  return "";
}
