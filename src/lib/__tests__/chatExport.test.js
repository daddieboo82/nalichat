// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  createMarkdownExport,
  preparePdfContent,
  sanitizeExportFilename,
  triggerBlobDownload,
} from '@/lib/chatExport';

const exportModel = {
  version: 1,
  exportedAt: '2026-09-10T18:00:00.000Z',
  conversation: {
    title: 'Project <Launch>',
    type: 'group',
    participants: ['Avery', 'Blake'],
  },
  messages: [
    {
      number: 1,
      sender: 'Avery *Admin*',
      timestamp: '2026-09-10T17:30:00.000Z',
      edited: true,
      deleted: false,
      text: '# heading\n<script>alert("x")</script>',
      relation: {
        replyTo: 'Blake: earlier [message]',
        thread: 'Thread reply to message #4',
      },
      attachment: {
        name: 'demo [final].mp3',
        mediaType: 'audio/mpeg',
        sizeBytes: 1234,
        url: 'https://files.example.com/demo(final).mp3',
        unsupported: false,
      },
    },
  ],
  limits: {
    messageCap: 5000,
    truncated: true,
  },
};

describe('chat export client preparation', () => {
  it('escapes Markdown content and includes export metadata and relationships', () => {
    const markdown = createMarkdownExport(exportModel);

    expect(markdown).toContain('# Project \\<Launch\\>');
    expect(markdown).toContain('Private conversation export');
    expect(markdown).toContain('Avery \\*Admin\\*');
    expect(markdown).toContain('_Thread reply to message \\#4_');
    expect(markdown).toContain('_Replying to Blake: earlier \\[message\\]_');
    expect(markdown).toContain('> \\# heading');
    expect(markdown).toContain('> \\<script\\>alert\\(\"x\"\\)\\</script\\>');
    expect(markdown).toContain('[Open attachment](https://files.example.com/demo%28final%29.mp3)');
    expect(markdown).toContain('Only the first 5000 messages are included');
  });

  it('sanitizes filenames for cross-platform downloads', () => {
    expect(sanitizeExportFilename('  Project: Demo / Final?  ', exportModel.exportedAt))
      .toBe('NaliChat-Project-Demo-Final-2026-09-10');
    expect(sanitizeExportFilename('CON', exportModel.exportedAt))
      .toBe('NaliChat-conversation-2026-09-10');
    expect(sanitizeExportFilename('🔥', 'invalid'))
      .toBe('NaliChat-conversation-export');
  });

  it('prepares PDF input as plain text blocks with pagination metadata', () => {
    const blocks = preparePdfContent(exportModel);

    expect(blocks[0]).toEqual({ kind: 'title', text: 'Project <Launch>' });
    expect(blocks).toContainEqual({
      kind: 'warning',
      text: 'Private conversation export. Anyone with this file can read its contents.',
    });
    expect(blocks).toContainEqual({
      kind: 'message',
      text: '# heading\n<script>alert("x")</script>',
    });
    expect(blocks.some((block) => block.text.includes('only the first 5000 messages'))).toBe(true);
    expect(blocks.every((block) => typeof block.text === 'string')).toBe(true);
  });

  it('always removes the temporary anchor and revokes its object URL', () => {
    const anchor = {
      click: vi.fn(() => {
        throw new Error('download blocked');
      }),
      remove: vi.fn(),
    };
    const documentApi = {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn() },
    };
    const urlApi = {
      createObjectURL: vi.fn(() => 'blob:export'),
      revokeObjectURL: vi.fn(),
    };

    expect(() => triggerBlobDownload(
      new Blob(['content']),
      'conversation.md',
      { documentApi, urlApi },
    )).toThrow('download blocked');
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:export');
  });
});
