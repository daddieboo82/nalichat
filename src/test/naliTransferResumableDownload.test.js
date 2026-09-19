// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Nali Transfer resumable downloads", () => {
  it("uses byte ranges, persistent offsets, retries, and refreshed authorization", async () => {
    const transfer = await readFile("src/lib/resumableUpload.js", "utf8");
    const shared = await readFile("src/pages/SharedFileDownload.jsx", "utf8");

    expect(transfer).toContain("Range: `bytes=${offset}-`");
    expect(transfer).toContain("response.status !== 206");
    expect(transfer).toContain('typeof window.showSaveFilePicker === "function"');
    expect(transfer).toContain("existing.size");
    expect(transfer).toContain("createWritable({ keepExistingData: true })");
    expect(transfer).toContain("await writable.seek(offset)");
    expect(transfer).toContain("await writable.write(value)");
    expect(transfer).toContain("await writable.truncate(0)");
    expect(transfer).toContain("sessionStorage.setItem(storageKey");
    expect(transfer).not.toContain("localStorage.setItem(storageKey");
    expect(transfer).toContain("for (let attempt = 0; attempt < 6; attempt += 1)");
    expect(shared).toContain('base44.functions.invoke("getSharedFileByToken", { fileId, token })');
    expect(shared).toContain("resumableDownload(refreshUrl");
  });
});
