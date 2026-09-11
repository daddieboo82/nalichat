const INVALID_FILENAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001F]/g;
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function plainText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, "")
    .trim();
}

function safeHttpUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function escapeMarkdown(value) {
  return plainText(value)
    .replace(/\\/g, "\\\\")
    .replace(/([`*_[\]{}()#+.!|<>-])/g, "\\$1");
}

function markdownQuote(value) {
  const text = plainText(value, "[No text]");
  return text.split(/\r?\n/).map((line) => `> ${escapeMarkdown(line) || " "}`).join("\n");
}

function isoDate(value, fallback = "Unknown time") {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

export function sanitizeExportFilename(title, exportedAt = new Date().toISOString()) {
  let safeTitle = plainText(title, "conversation")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(INVALID_FILENAME_CHARACTERS, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\s-]+|[.\s-]+$/g, "")
    .slice(0, 80);
  if (!safeTitle || WINDOWS_RESERVED_NAMES.test(safeTitle)) {
    safeTitle = "conversation";
  }
  const parsedDate = new Date(exportedAt);
  const date = Number.isFinite(parsedDate.getTime())
    ? parsedDate.toISOString().slice(0, 10)
    : "export";
  return `NaliChat-${safeTitle}-${date}`;
}

export function createMarkdownExport(model) {
  const title = escapeMarkdown(model?.conversation?.title || "Conversation");
  const participants = Array.isArray(model?.conversation?.participants)
    ? model.conversation.participants
    : [];
  const messages = Array.isArray(model?.messages) ? model.messages : [];
  const lines = [
    `# ${title}`,
    "",
    "> Private conversation export. Anyone with this file can read its contents.",
    "",
    `- **Exported:** ${isoDate(model?.exportedAt)}`,
    `- **Conversation type:** ${model?.conversation?.type === "group" ? "Group" : "Direct message"}`,
    `- **Participants:** ${participants.map(escapeMarkdown).join(", ") || "Unavailable"}`,
    `- **Messages included:** ${messages.length}`,
  ];

  if (model?.limits?.truncated) {
    lines.push(
      `- **Size limit:** Only the first ${model.limits.messageCap} messages are included.`,
    );
  }

  lines.push("", "---", "");
  for (const message of messages) {
    const edited = message.edited ? " · Edited" : "";
    lines.push(
      `## Message ${message.number} — ${escapeMarkdown(message.sender || "Unknown")} — ${isoDate(message.timestamp)}${edited}`,
      "",
    );
    if (message.relation?.thread) {
      lines.push(`_${escapeMarkdown(message.relation.thread)}_`, "");
    }
    if (message.relation?.replyTo) {
      lines.push(`_Replying to ${escapeMarkdown(message.relation.replyTo)}_`, "");
    }
    lines.push(markdownQuote(message.text), "");

    if (message.attachment) {
      const attachment = message.attachment;
      const metadata = [
        escapeMarkdown(attachment.name || "Attachment"),
        escapeMarkdown(attachment.mediaType || "file"),
        Number.isSafeInteger(attachment.sizeBytes) ? `${attachment.sizeBytes} bytes` : null,
      ].filter(Boolean).join(" · ");
      const attachmentUrl = safeHttpUrl(attachment.url);
      lines.push(`**Attachment:** ${metadata}`);
      if (attachmentUrl) {
        const escapedUrl = attachmentUrl.replace(/\(/g, "%28").replace(/\)/g, "%29");
        lines.push(`[Open attachment](${escapedUrl})`);
      } else {
        lines.push("_Attachment link unavailable; binary content was not embedded._");
      }
      lines.push("");
    }
    lines.push("---", "");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function preparePdfContent(model) {
  const participants = Array.isArray(model?.conversation?.participants)
    ? model.conversation.participants.map((name) => plainText(name, "Participant"))
    : [];
  const messages = Array.isArray(model?.messages) ? model.messages : [];
  const blocks = [
    { kind: "title", text: plainText(model?.conversation?.title, "Conversation") },
    { kind: "warning", text: "Private conversation export. Anyone with this file can read its contents." },
    { kind: "meta", text: `Exported: ${isoDate(model?.exportedAt)}` },
    { kind: "meta", text: `Type: ${model?.conversation?.type === "group" ? "Group" : "Direct message"}` },
    { kind: "meta", text: `Participants: ${participants.join(", ") || "Unavailable"}` },
    { kind: "meta", text: `Messages included: ${messages.length}` },
  ];

  if (model?.limits?.truncated) {
    blocks.push({
      kind: "warning",
      text: `Size limit reached: only the first ${model.limits.messageCap} messages are included.`,
    });
  }

  for (const message of messages) {
    const header = [
      `Message ${message.number}`,
      plainText(message.sender, "Unknown"),
      isoDate(message.timestamp),
      message.edited ? "Edited" : null,
    ].filter(Boolean).join(" | ");
    blocks.push({ kind: "messageHeader", text: header });
    if (message.relation?.thread) {
      blocks.push({ kind: "relation", text: plainText(message.relation.thread) });
    }
    if (message.relation?.replyTo) {
      blocks.push({ kind: "relation", text: `Replying to ${plainText(message.relation.replyTo)}` });
    }
    blocks.push({ kind: "message", text: plainText(message.text, "[No text]") });

    if (message.attachment) {
      const attachment = message.attachment;
      const attachmentUrl = safeHttpUrl(attachment.url);
      const size = Number.isSafeInteger(attachment.sizeBytes)
        ? `, ${attachment.sizeBytes} bytes`
        : "";
      blocks.push({
        kind: "attachment",
        text: `Attachment: ${plainText(attachment.name, "Attachment")} (${plainText(attachment.mediaType, "file")}${size})`,
      });
      blocks.push({
        kind: "attachment",
        text: attachmentUrl || "Attachment link unavailable; binary content was not embedded.",
      });
    }
  }

  return blocks;
}

export function triggerBlobDownload(blob, filename, environment = {}) {
  const urlApi = environment.urlApi || URL;
  const documentApi = environment.documentApi || document;
  const objectUrl = urlApi.createObjectURL(blob);
  const anchor = documentApi.createElement("a");

  try {
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    documentApi.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    urlApi.revokeObjectURL(objectUrl);
  }
}

function cancellationError() {
  const error = new Error("Export canceled");
  error.name = "AbortError";
  return error;
}

export async function createPdfExport(model, options = {}) {
  const { jsPDF } = await import("jspdf");
  if (options.isCancelled?.()) throw cancellationError();

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;
  const blocks = preparePdfContent(model);

  const addPage = () => {
    doc.addPage();
    y = margin;
  };

  blocks.forEach((block, index) => {
    if (options.isCancelled?.()) throw cancellationError();
    const isTitle = block.kind === "title";
    const isHeader = block.kind === "messageHeader";
    doc.setFont("helvetica", isTitle || isHeader ? "bold" : "normal");
    doc.setFontSize(isTitle ? 18 : isHeader ? 11 : 9);
    doc.setTextColor(block.kind === "warning" ? 150 : 30);
    const lines = doc.splitTextToSize(block.text, contentWidth);
    const lineHeight = isTitle ? 22 : 13;
    if (isHeader && y + (lineHeight * 2) > pageHeight - margin) addPage();
    for (const line of lines) {
      if (y + lineHeight > pageHeight - margin) addPage();
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += isHeader ? 10 : 5;
    options.onProgress?.(Math.round(((index + 1) / blocks.length) * 100));
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`NaliChat export | Page ${page} of ${pageCount}`, margin, pageHeight - 24);
  }
  return doc.output("blob");
}

export async function exportConversationFile(model, format, options = {}) {
  if (options.isCancelled?.()) throw cancellationError();
  const baseName = sanitizeExportFilename(model?.conversation?.title, model?.exportedAt);
  if (format === "markdown") {
    options.onProgress?.(100);
    const blob = new Blob([createMarkdownExport(model)], { type: "text/markdown;charset=utf-8" });
    if (options.isCancelled?.()) throw cancellationError();
    triggerBlobDownload(blob, `${baseName}.md`, options.environment);
    return;
  }
  if (format !== "pdf") {
    throw new Error("Unsupported export format");
  }

  const blob = await createPdfExport(model, options);
  if (options.isCancelled?.()) throw cancellationError();
  triggerBlobDownload(blob, `${baseName}.pdf`, options.environment);
}
