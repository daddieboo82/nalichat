// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Nali Transfer persistent download authorization", () => {
  it("stores private object identity and refreshes signed URLs after token authorization", async () => {
    const schema = await readFile("base44/entities/SharedFile.jsonc", "utf8");
    const create = await readFile("base44/functions/createSharedFileRecord/entry.ts", "utf8");
    const share = await readFile("base44/functions/getSharedFileByToken/entry.ts", "utf8");
    const ui = await readFile("src/components/files/LargeFileTransfer.jsx", "utf8");

    expect(schema).toContain('"storage_provider"');
    expect(schema).toContain('"storage_bucket"');
    expect(schema).toContain('"storage_path"');
    expect(ui).toContain('storage_provider: "supabase"');
    expect(ui).toContain("storage_bucket: transfer.bucket");
    expect(ui).toContain("storage_path: transfer.objectPath");
    expect(create).toContain("storageBucket !== \'nalichat-transfers\'");
    expect(create).toContain("storagePath.startsWith(");
    expect(share).toContain("file.storage_bucket === \'nalichat-transfers\'");
    expect(share).toContain(".createSignedUrl(file.storage_path, 15 * 60)");
    expect(share).toContain("file_url: downloadUrl");
  });
});
