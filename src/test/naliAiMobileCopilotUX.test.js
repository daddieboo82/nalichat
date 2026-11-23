import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const source = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai mobile creator copilot experience', () => {
  it('uses a safe-area-aware full-height conversation on phones and a floating panel on desktop', async () => {
    const ui = await source();
    expect(ui).toContain('top-[env(safe-area-inset-top)] bottom-[env(safe-area-inset-bottom)]');
    expect(ui).toContain('sm:bottom-8 sm:right-4 sm:w-96');
    expect(ui).toContain('flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y');
    expect(ui).toContain('pb-[max(0.75rem,env(safe-area-inset-bottom))]');
  });
  it('offers editable creator prompts without automatically spending an AI request', async () => {
    const ui = await source();
    expect(ui).toContain('What can we create today?');
    expect(ui).toContain('Help me write a catchy song hook');
    expect(ui).toContain('Give me a vocal mixing checklist');
    expect(ui).toContain('setInput(s.text); inputRef.current?.focus();');
  });
  it('offers accessible copy controls and touch-friendly message input', async () => {
    const ui = await source();
    expect(ui).toContain('aria-label="NALI.ai conversation"');
    expect(ui).toContain('aria-label="Copy Nali response"');
    expect(ui).toContain('navigator.clipboard.writeText');
    expect(ui).toContain('aria-label="Message NALI.ai"');
    expect(ui).toContain('min-h-12 w-full');
    expect(ui).toContain('aria-label="Voice input"');
  });
});