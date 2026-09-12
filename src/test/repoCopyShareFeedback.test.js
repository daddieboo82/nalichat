// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('repo copy/share failure feedback', () => {
  it('checks clipboard results before reporting success', async () => {
    const challenge = await readText('src/components/challenges/ShareButtons.jsx');
    const jam = await readText('src/components/studio/JamRoomOverlay.jsx');
    const viral = await readText('src/components/viralseed/ViralConceptCard.jsx');
    const files = await readText('src/pages/Files.jsx');
    const media = await readText('src/components/explore/MediaViewerModal.jsx');
    const projects = await readText('src/pages/ProjectsSummary.jsx');
    const transfer = await readText('src/components/files/LargeFileTransfer.jsx');

    expect(challenge).toContain('const copied = await copyToClipboard(url);');
    expect(jam).toContain('const copied = await copyToClipboard(url.toString());');
    expect(viral).toContain('const copiedSuccessfully = await copyToClipboard(content || "");');
    expect(files).toContain('const copied = await copyToClipboard(url);');
    expect(media).toContain('const copied = await copyToClipboard');
    expect(projects).toContain('const copied = await copyToClipboard(url);');
    expect(projects).toContain("Invite created, but couldn't copy it. The link is shown below.");
    expect(transfer).toContain('const copied = await copyToClipboard(shareLink);');
    expect(transfer).toContain("Couldn't copy the link. Please copy it manually.");
  });

  it('surfaces download/share failures while keeping user-cancel quiet', async () => {
    const files = await readText('src/pages/Files.jsx');
    const media = await readText('src/components/explore/MediaViewerModal.jsx');

    expect(files).toContain('function FileDownloadButton({ file })');
    expect(files).toContain('const { toast } = useToast();');
    expect(files).toContain('title: "Download failed"');
    expect(media).toContain('if (error?.name !== "AbortError")');
    expect(media).toContain("Couldn't share this track. Please try again.");
  });
});
