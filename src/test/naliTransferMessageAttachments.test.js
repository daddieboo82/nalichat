// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Nali Transfer message attachments", () => {
  it("persists transfer identity and refreshes private download URLs", async () => {
    const schema = await readFile("base44/entities/Message.jsonc", "utf8");
    const input = await readFile("src/components/messages/ChatInput.jsx", "utf8");
    const auth = await readFile("base44/functions/authorizeMessageDownload/entry.ts", "utf8");

    expect(schema).toContain('"storage_provider"');
    expect(schema).toContain('"storage_bucket"');
    expect(schema).toContain('"storage_path"');
    expect(input).not.toContain('import { validateUpload }');
    expect(input).toContain('storage_provider: "supabase"');
    expect(input).toContain("storage_bucket: transfer.bucket");
    expect(input).toContain("storage_path: transfer.objectPath");
    expect(auth).toContain("message.storage_bucket === \'nalichat-transfers\'");
    expect(auth).toContain(".createSignedUrl(message.storage_path, 15 * 60)");
    expect(auth).toContain("file_url: downloadUrl");
  });
});
