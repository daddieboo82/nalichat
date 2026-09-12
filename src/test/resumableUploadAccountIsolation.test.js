import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("resumable upload storage isolation", () => {
  it("never trusts legacy browser-persisted upload URLs", async () => {
    const source = await readFile(
      new URL("../../src/lib/resumableUpload.js", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain('const STORAGE_KEY = "resumable_uploads"');
    expect(source).not.toContain("getUploadState()");
    expect(source).not.toContain("savedState?.fileUrl");
    expect(source).not.toContain("clearUploadState(fileId)");
    expect(source).toContain("secureUploadFile({ file })");
  });
});
