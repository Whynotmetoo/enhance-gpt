import { fetchAssetInPageContext, fetchConversationByIdInPageContext } from "../../lib/chatGptApiBridge";
import type { ConversationItem } from "./types";

type ApiMessage = {
  author?: {
    role?: unknown;
  };
  content?: unknown;
  create_time?: unknown;
  id?: unknown;
  metadata?: unknown;
};

type ApiMappingNode = {
  children?: unknown;
  message?: unknown;
  parent?: unknown;
};

type ApiConversation = {
  current_node?: unknown;
  mapping?: unknown;
  title?: unknown;
};

type ExportAsset = {
  fileName: string;
  isImage: boolean;
  label: string;
  localPath: string;
  sourceUrl: string;
};

type AssetSourceMap = Map<string, ExportAsset>;

type RenderedMessage = {
  assets: ExportAsset[];
  role: "assistant" | "user";
  text: string;
};

type ZipEntry = {
  data: Uint8Array;
  name: string;
};

export type ConversationExportResult = {
  blob: Blob;
  fileName: string;
};

const textEncoder = new TextEncoder();
let crcTable: Uint32Array | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function sanitizeFileName(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return cleaned || fallback;
}

function uniqueName(name: string, usedNames: Set<string>): string {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }

  const extensionMatch = name.match(/(\.[^.]+)$/);
  const extension = extensionMatch?.[1] ?? "";
  const base = extension ? name.slice(0, -extension.length) : name;
  let counter = 2;
  let next = `${base}-${counter}${extension}`;

  while (usedNames.has(next)) {
    counter += 1;
    next = `${base}-${counter}${extension}`;
  }

  usedNames.add(next);
  return next;
}

function fileNameFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url, window.location.origin);
    const id = parsedUrl.searchParams.get("id");
    if (id) {
      return id;
    }

    const segments = parsedUrl.pathname.split("/").filter(Boolean);
    const segment = segments[segments.length - 1];
    if (
      segment === "download" &&
      segments[segments.length - 4] === "backend-api" &&
      segments[segments.length - 3] === "files"
    ) {
      return decodeURIComponent(segments[segments.length - 2] ?? "");
    }

    return segment ? decodeURIComponent(segment) : null;
  } catch {
    return null;
  }
}

function urlFromAssetPointer(value: string | null): string | null {
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value) || value.startsWith("/")) {
    return value;
  }

  const fileServiceMatch = value.match(/^file-service:\/\/(.+)$/);
  if (fileServiceMatch) {
    return `/backend-api/files/${encodeURIComponent(fileServiceMatch[1])}/download`;
  }

  const sedimentMatch = value.match(/^sediment:\/\/(.+)$/);
  if (sedimentMatch) {
    return `/backend-api/files/${encodeURIComponent(sedimentMatch[1])}/download`;
  }

  if (/^file[-_][a-z0-9_-]+$/i.test(value)) {
    return `/backend-api/files/${encodeURIComponent(value)}/download`;
  }

  return null;
}

function appendAsset(
  assets: ExportAsset[],
  sourceUrl: string | null,
  label: string,
  isImage: boolean,
  usedAssetNames: Set<string>,
  usedAssetSources: AssetSourceMap
): ExportAsset | null {
  const normalizedSourceUrl = urlFromAssetPointer(sourceUrl);
  if (!normalizedSourceUrl) {
    return null;
  }

  const existingAsset = usedAssetSources.get(normalizedSourceUrl);
  if (existingAsset) {
    return existingAsset;
  }

  const baseName = sanitizeFileName(fileNameFromUrl(normalizedSourceUrl) ?? label, isImage ? "image" : "asset");
  const fileName = uniqueName(baseName.includes(".") ? baseName : `${baseName}${isImage ? ".png" : ""}`, usedAssetNames);
  const asset = {
    fileName,
    isImage,
    label,
    localPath: `assets/${fileName}`,
    sourceUrl: normalizedSourceUrl
  };
  assets.push(asset);
  usedAssetSources.set(normalizedSourceUrl, asset);
  return asset;
}

function isLikelyDownloadUrl(url: string): boolean {
  if (url.startsWith("/backend-api/files/") || url.startsWith("/mnt/data/")) {
    return true;
  }

  try {
    const parsedUrl = new URL(url, window.location.origin);
    if (parsedUrl.origin !== window.location.origin) {
      return false;
    }

    return (
      parsedUrl.pathname.startsWith("/backend-api/files/") ||
      parsedUrl.pathname.startsWith("/mnt/data/") ||
      parsedUrl.pathname.includes("/download")
    );
  } catch {
    return false;
  }
}

function rewriteDownloadLinks(
  text: string,
  assets: ExportAsset[],
  usedAssetNames: Set<string>,
  usedAssetSources: AssetSourceMap
): string {
  return text.replace(/(!?)\[([^\]]*)]\(([^)\s]+)(\s+"[^"]*")?\)/g, (match, imagePrefix, label, url, title) => {
    if (typeof url !== "string" || !isLikelyDownloadUrl(url)) {
      return match;
    }

    const asset = appendAsset(
      assets,
      urlFromAssetPointer(url),
      typeof label === "string" && label.trim() ? label.trim() : "download",
      imagePrefix === "!",
      usedAssetNames,
      usedAssetSources
    );

    return asset ? `${imagePrefix}[${label}](${asset.localPath}${title ?? ""})` : match;
  });
}

function escapeMarkdownLinkLabel(value: string): string {
  return value.replace(/([\\[\]])/g, "\\$1");
}

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url, window.location.origin).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function firstRecordFromList(value: unknown): Record<string, unknown> | null {
  return Array.isArray(value) ? value.find((item): item is Record<string, unknown> => isRecord(item)) ?? null : null;
}

function referenceUrl(record: Record<string, unknown>): string | null {
  return stringValue(record.url) ?? stringValue(record.uri) ?? stringValue(record.href);
}

function markdownFromReferenceItem(item: Record<string, unknown>): string | null {
  const url = referenceUrl(item);
  if (!url) {
    return null;
  }

  const label =
    stringValue(item.attribution) ??
    stringValue(item.title) ??
    hostnameFromUrl(url) ??
    "source";
  return `([${escapeMarkdownLinkLabel(label)}](${url}))`;
}

function markdownFromContentReference(reference: Record<string, unknown>): string | null {
  const alt = stringValue(reference.alt);
  if (alt) {
    return alt;
  }

  const item =
    firstRecordFromList(reference.items) ??
    firstRecordFromList(reference.fallback_items) ??
    firstRecordFromList(reference.sources);
  return item ? markdownFromReferenceItem(item) : null;
}

function isCitationToken(value: string): boolean {
  return /^cite[^]+$/.test(value);
}

function applyContentReferences(text: string, metadata: unknown): string {
  if (!isRecord(metadata) || !Array.isArray(metadata.content_references)) {
    return text;
  }

  const replacements = metadata.content_references
    .map((reference) => {
      if (!isRecord(reference)) {
        return null;
      }

      const matchedText = stringValue(reference.matched_text);
      const referenceType = stringValue(reference.type);
      const replacement = markdownFromContentReference(reference);
      if (!matchedText || !replacement || matchedText.trim().length === 0 || referenceType === "sources_footnote") {
        return null;
      }

      return {
        end: typeof reference.end_idx === "number" ? reference.end_idx : null,
        matchedText,
        replacement,
        start: typeof reference.start_idx === "number" ? reference.start_idx : null
      };
    })
    .filter((replacement): replacement is {
      end: number | null;
      matchedText: string;
      replacement: string;
      start: number | null;
    } => Boolean(replacement));

  if (replacements.length === 0) {
    return text;
  }

  const indexedReplacements = replacements
    .filter((replacement): replacement is {
      end: number;
      matchedText: string;
      replacement: string;
      start: number;
    } => (
      replacement.start !== null &&
      replacement.end !== null &&
      replacement.start >= 0 &&
      replacement.end > replacement.start &&
      text.slice(replacement.start, replacement.end) === replacement.matchedText
    ))
    .sort((a, b) => b.start - a.start);

  const indexedReplacementKeys = new Set(
    indexedReplacements.map((replacement) => `${replacement.start}:${replacement.end}:${replacement.matchedText}`)
  );
  const textWithIndexedReplacements = indexedReplacements.reduce(
    (current, replacement) =>
      `${current.slice(0, replacement.start)}${replacement.replacement}${current.slice(replacement.end)}`,
    text
  );

  return replacements.reduce(
    (current, replacement) => {
      const key = `${replacement.start}:${replacement.end}:${replacement.matchedText}`;
      if (indexedReplacementKeys.has(key) || !isCitationToken(replacement.matchedText)) {
        return current;
      }

      return current.split(replacement.matchedText).join(replacement.replacement);
    },
    textWithIndexedReplacements
  );
}

function textFromPart(
  part: unknown,
  assets: ExportAsset[],
  usedAssetNames: Set<string>,
  usedAssetSources: AssetSourceMap
): string {
  if (typeof part === "string") {
    return part;
  }

  if (!isRecord(part)) {
    return "";
  }

  const contentType = stringValue(part.content_type);
  if ((contentType === "text" || contentType === null) && typeof part.text === "string") {
    return part.text;
  }

  if (contentType === "audio_transcription" && typeof part.text === "string") {
    return part.text;
  }

  const assetPointer = stringValue(part.asset_pointer) ?? stringValue(part.url) ?? stringValue(part.download_url);
  if (contentType === "image_asset_pointer" || contentType === "image_url") {
    appendAsset(assets, assetPointer, "image", true, usedAssetNames, usedAssetSources);
    return "";
  }

  if (assetPointer) {
    appendAsset(assets, assetPointer, "attachment", false, usedAssetNames, usedAssetSources);
  }

  return "";
}

function hasImageExtension(value: string | null): boolean {
  return Boolean(value?.match(/\.(?:avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i));
}

function valueIncludesAssetHint(value: string | null): boolean {
  return Boolean(value?.match(/(?:asset|attach|download|file|image|photo|picture)/i));
}

function collectRecordAsset(
  record: Record<string, unknown>,
  assets: ExportAsset[],
  usedAssetNames: Set<string>,
  usedAssetSources: AssetSourceMap,
  hintIsAsset: boolean,
  hintIsImage: boolean
): void {
  const contentType = stringValue(record.content_type) ?? stringValue(record.type);
  const mimeType = stringValue(record.mime_type) ?? stringValue(record.mimeType) ?? stringValue(record.media_type);
  const fileName = stringValue(record.file_name) ?? stringValue(record.filename) ?? stringValue(record.name);
  const id = stringValue(record.file_id) ?? stringValue(record.fileId) ?? stringValue(record.id);
  const explicitSource =
    stringValue(record.asset_pointer) ??
    stringValue(record.assetPointer) ??
    stringValue(record.download_url) ??
    stringValue(record.downloadUrl) ??
    stringValue(record.url);

  const isImage =
    hintIsImage ||
    Boolean(contentType?.includes("image")) ||
    Boolean(mimeType?.startsWith("image/")) ||
    hasImageExtension(fileName) ||
    hasImageExtension(explicitSource);
  const isAsset =
    hintIsAsset ||
    isImage ||
    Boolean(record.asset_pointer) ||
    Boolean(record.assetPointer) ||
    Boolean(record.download_url) ||
    Boolean(record.downloadUrl) ||
    valueIncludesAssetHint(contentType) ||
    valueIncludesAssetHint(mimeType);
  const sourceUrl =
    explicitSource && (isAsset || isLikelyDownloadUrl(explicitSource))
      ? explicitSource
      : id && isAsset
        ? id
        : null;

  appendAsset(assets, sourceUrl, fileName ?? id ?? (isImage ? "image" : "attachment"), isImage, usedAssetNames, usedAssetSources);
}

function collectNestedAssets(
  value: unknown,
  assets: ExportAsset[],
  usedAssetNames: Set<string>,
  usedAssetSources: AssetSourceMap,
  depth = 0,
  pathHint = ""
): void {
  if (depth > 7 || !value) {
    return;
  }

  const keyHintIsAsset = valueIncludesAssetHint(pathHint);
  const keyHintIsImage = Boolean(pathHint.match(/(?:image|photo|picture)/i));
  if (typeof value === "string") {
    appendAsset(
      assets,
      keyHintIsAsset || keyHintIsImage ? value : null,
      keyHintIsImage ? "image" : "attachment",
      keyHintIsImage,
      usedAssetNames,
      usedAssetSources
    );
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectNestedAssets(item, assets, usedAssetNames, usedAssetSources, depth + 1, pathHint));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  collectRecordAsset(value, assets, usedAssetNames, usedAssetSources, keyHintIsAsset, keyHintIsImage);

  Object.entries(value).forEach(([key, nestedValue]) => {
    collectNestedAssets(nestedValue, assets, usedAssetNames, usedAssetSources, depth + 1, `${pathHint}.${key}`);
  });
}

function appendMetadataAssets(
  message: ApiMessage,
  assets: ExportAsset[],
  usedAssetNames: Set<string>,
  usedAssetSources: AssetSourceMap
): void {
  const metadata = message.metadata;
  if (!isRecord(metadata)) {
    return;
  }

  const attachments = Array.isArray(metadata.attachments) ? metadata.attachments : [];
  attachments.forEach((attachment) => {
    if (!isRecord(attachment)) {
      return;
    }

    const id = stringValue(attachment.id) ?? stringValue(attachment.file_id);
    const name = stringValue(attachment.name) ?? stringValue(attachment.file_name) ?? id ?? "attachment";
    const rawUrl = stringValue(attachment.download_url) ?? stringValue(attachment.url);
    const sourceUrl = rawUrl ?? (id ? `/backend-api/files/${encodeURIComponent(id)}/download` : null);
    const mimeType = stringValue(attachment.mime_type) ?? stringValue(attachment.content_type);
    appendAsset(assets, sourceUrl, name, Boolean(mimeType?.startsWith("image/")), usedAssetNames, usedAssetSources);
  });
}

function contentFromMessage(
  message: ApiMessage,
  usedAssetNames: Set<string>,
  usedAssetSources: AssetSourceMap
): RenderedMessage | null {
  const metadata = message.metadata;
  if (
    isRecord(metadata) &&
    (metadata.is_visually_hidden_from_conversation === true || metadata.is_hidden === true || metadata.hidden === true)
  ) {
    return null;
  }

  const role = message.author?.role;
  const content = message.content;
  const assets: ExportAsset[] = [];
  const parts = isRecord(content) && Array.isArray(content.parts) ? content.parts : [];
  const rawText = parts
      .map((part) => textFromPart(part, assets, usedAssetNames, usedAssetSources))
      .filter(Boolean)
      .join("\n\n")
      .trim();
  const text = rewriteDownloadLinks(
    applyContentReferences(rawText, metadata),
    assets,
    usedAssetNames,
    usedAssetSources
  );

  collectNestedAssets(content, assets, usedAssetNames, usedAssetSources);
  collectNestedAssets(message.metadata, assets, usedAssetNames, usedAssetSources);
  appendMetadataAssets(message, assets, usedAssetNames, usedAssetSources);

  if (!text && assets.length === 0) {
    return null;
  }

  return {
    assets,
    role: role === "user" ? "user" : "assistant",
    text
  };
}

function apiMapping(conversation: ApiConversation): Map<string, ApiMappingNode> {
  const mapping = new Map<string, ApiMappingNode>();
  if (!isRecord(conversation.mapping)) {
    return mapping;
  }

  Object.entries(conversation.mapping).forEach(([id, node]) => {
    if (isRecord(node)) {
      mapping.set(id, node as ApiMappingNode);
    }
  });

  return mapping;
}

function orderedMessages(conversation: ApiConversation): ApiMessage[] {
  const mapping = apiMapping(conversation);
  const currentNode = stringValue(conversation.current_node);

  if (mapping.size === 0) {
    return [];
  }

  if (currentNode && mapping.has(currentNode)) {
    const path: ApiMessage[] = [];
    const seen = new Set<string>();
    let nodeId: string | null = currentNode;

    while (nodeId && mapping.has(nodeId) && !seen.has(nodeId)) {
      seen.add(nodeId);
      const node = mapping.get(nodeId);
      const message = isRecord(node?.message) ? (node.message as ApiMessage) : null;
      if (message) {
        path.push(message);
      }
      nodeId = stringValue(node?.parent);
    }

    return path.reverse();
  }

  return Array.from(mapping.values())
    .map((node) => (isRecord(node.message) ? (node.message as ApiMessage) : null))
    .filter((message): message is ApiMessage => Boolean(message))
    .sort((a, b) => {
      const aTime = typeof a.create_time === "number" ? a.create_time : 0;
      const bTime = typeof b.create_time === "number" ? b.create_time : 0;
      return aTime - bTime;
    });
}

function markdownLinkAsset(asset: ExportAsset): string {
  return asset.isImage
    ? `![${asset.label}](${asset.localPath})`
    : `[${asset.label}](${asset.localPath})`;
}

function markdownRoleTitle(role: RenderedMessage["role"]): string {
  return role === "user" ? "User" : "ChatGPT";
}

function markdownFromConversation(title: string, messages: RenderedMessage[]): string {
  const sections = [`# ${title}`];
  let previousRole: RenderedMessage["role"] | null = null;

  messages.forEach((message) => {
    if (message.role !== previousRole) {
      sections.push(`# ${markdownRoleTitle(message.role)}`);
      previousRole = message.role;
    }

    if (message.text) {
      sections.push(message.text);
    }
    if (message.assets.length > 0) {
      sections.push(message.assets.map(markdownLinkAsset).join("\n\n"));
    }
  });

  return `${sections.join("\n\n").trim()}\n`;
}

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

function crc32(data: Uint8Array): number {
  crcTable ??= makeCrcTable();
  let value = 0xffffffff;
  data.forEach((byte) => {
    value = (crcTable?.[(value ^ byte) & 0xff] ?? 0) ^ (value >>> 8);
  });
  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()): { date: number; time: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  };
}

function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.byteLength;
  });
  return output;
}

function exactArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

function createZip(entries: ZipEntry[]): Blob {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const { date, time } = dosDateTime();
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = textEncoder.encode(entry.name);
    const checksum = crc32(entry.data);
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, time);
    writeUint16(localView, 12, date);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, entry.data.byteLength);
    writeUint32(localView, 22, entry.data.byteLength);
    writeUint16(localView, 26, nameBytes.byteLength);
    writeUint16(localView, 28, 0);

    localParts.push(localHeader, nameBytes, entry.data);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, time);
    writeUint16(centralView, 14, date);
    writeUint32(centralView, 16, checksum);
    writeUint32(centralView, 20, entry.data.byteLength);
    writeUint32(centralView, 24, entry.data.byteLength);
    writeUint16(centralView, 28, nameBytes.byteLength);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);

    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.byteLength + nameBytes.byteLength + entry.data.byteLength;
  });

  const localData = concatBytes(localParts);
  const centralData = concatBytes(centralParts);
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 8, entries.length);
  writeUint16(endView, 10, entries.length);
  writeUint32(endView, 12, centralData.byteLength);
  writeUint32(endView, 16, localData.byteLength);

  return new Blob(
    [exactArrayBuffer(localData), exactArrayBuffer(centralData), exactArrayBuffer(endHeader)],
    { type: "application/zip" }
  );
}

async function downloadAsset(asset: ExportAsset, signal: AbortSignal): Promise<ZipEntry> {
  const response = await fetchAssetInPageContext(asset.sourceUrl, signal);

  return {
    data: new Uint8Array(response.bytes),
    name: asset.localPath
  };
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function exportResultFromRenderedMessages(
  title: string,
  messages: RenderedMessage[],
  signal: AbortSignal
): Promise<ConversationExportResult> {
  const markdown = markdownFromConversation(title, messages);
  const markdownName = `${title}.md`;
  const assets = messages.flatMap((message) => message.assets);

  if (assets.length === 0) {
    return {
      blob: new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
      fileName: markdownName
    };
  }

  const assetEntries = await Promise.all(assets.map((asset) => downloadAsset(asset, signal)));
  const entries = [
    {
      data: textEncoder.encode(markdown),
      name: markdownName
    },
    ...assetEntries
  ];

  return {
    blob: createZip(entries),
    fileName: `${title}.zip`
  };
}

export async function buildConversationExport(
  item: ConversationItem,
  signal: AbortSignal
): Promise<ConversationExportResult> {
  const conversation = (await fetchConversationByIdInPageContext(item.id, signal)) as ApiConversation;
  if (!isRecord(conversation)) {
    throw new Error("Conversation response was empty");
  }

  const apiTitle = sanitizeFileName(stringValue(conversation.title) ?? item.title, "Untitled chat");
  const usedAssetNames = new Set<string>();
  const usedAssetSources: AssetSourceMap = new Map();
  const messages = orderedMessages(conversation)
    .map((message) => contentFromMessage(message, usedAssetNames, usedAssetSources))
    .filter((message): message is RenderedMessage => Boolean(message));

  return exportResultFromRenderedMessages(apiTitle, messages, signal);
}

export async function downloadConversationExport(result: ConversationExportResult): Promise<void> {
  downloadBlob(result.blob, result.fileName);
  await delay(250);
}
