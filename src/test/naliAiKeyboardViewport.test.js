// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const source = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai visual viewport keyboard resilience', () => {
  it('tracks visible height and offset on mobile keyboard and orientation changes', async () => {
    const code = await source();
    expect(code).toContain('const viewport = window.visualViewport;');
    expect(code).toContain('viewport?.height ?? window.innerHeight');
    expect(code).toContain('viewport?.offsetTop ?? 0');
    expect(code).toContain("viewport?.addEventListener('resize', updateViewport)");
    expect(code).toContain("viewport?.addEventListener('scroll', updateViewport)");
    expect(code).toContain("window.addEventListener('resize', updateViewport)");
    expect(code).toContain("viewport?.removeEventListener('resize', updateViewport)");
    expect(code).toContain("viewport?.removeEventListener('scroll', updateViewport)");
    expect(code).toContain("window.removeEventListener('resize', updateViewport)");
  });

  it('positions only the expanded mobile panel in the visible viewport', async () => {
    const code = await source();
    expect(code).toContain("if (!open || minimized) return;");
    expect(code).toContain('if (window.innerWidth >= 640)');
    expect(code).toContain("style={!minimized && mobileViewport ? { top: mobileViewport.top, bottom: 'auto', height: mobileViewport.height } : undefined}");
    expect(code).toContain('sm:bottom-8 sm:right-4 sm:w-96');
    expect(code).toContain('enterKeyHint="send"');
  });
});