import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Nali Transfer resumable upload isolation", () => {
  it("uses authenticated TUS sessions instead of legacy persisted file URLs", async () => {
    const source = await readFile(
      new URL("../../src/lib/resumableUpload.js", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain('const STORAGE_KEY = "resumable_uploads"');
    expect(source).not.toContain("savedState?.fileUrl");
    expect(source).not.toContain("secureUploadFile({ file })");
    expect(source).toContain('from "tus-js-client"');
    expect(source).toContain("const TUS_CHUNK_SIZE = 6 * 1024 * 1024");
    expect(source).toContain('"createResumableTransferUpload"');
    expect(source).toContain('"x-signature": auth.token');
    expect(source).toContain("findPreviousUploads()");
    expect(source).toContain("resumeFromPreviousUpload(previous[0])");
    expect(source).toContain('"finalizeResumableTransferUpload"');
  });
});
