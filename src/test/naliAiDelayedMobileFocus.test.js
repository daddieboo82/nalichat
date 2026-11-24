// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai delayed mobile keyboard focus', () => {
  it('cancels pending focus when closing or minimizing the assistant', async () => {
    const source = await read();
    expect(source).toContain('const focusTimerRef = useRef(null);');
    expect(source).toMatch(/onClick=\{\(\) => \{ if \(focusTimerRef\.current\) \{ clearTimeout\(focusTimerRef\.current\); focusTimerRef\.current = null; \} setMinimized\(v => !v\); \}\}/);
    expect(source).toMatch(/onClick=\{\(\) => \{ if \(focusTimerRef\.current\) \{ clearTimeout\(focusTimerRef\.current\); focusTimerRef\.current = null; \} setOpen\(false\); \}\}/);
  });
  it('invalidates focus on account switch and component unmount', async () => {
    const source = await read();
    const cleanup = 'if (focusTimerRef.current) { clearTimeout(focusTimerRef.current); focusTimerRef.current = null; }';
    const identity = source.slice(source.indexOf('useEffect(() => {\n    identityGenerationRef.current += 1;'), source.indexOf('}, [identityKey]);'));
    const unmount = source.slice(source.indexOf('useEffect(() => () => {'), source.indexOf('}, []);', source.indexOf('useEffect(() => () => {')));
    expect(identity).toContain(cleanup);
    expect(unmount).toContain(cleanup);
  });
  it('does not focus a disconnected input or a hidden/background page', async () => {
    const source = await read();
    const open = source.slice(source.indexOf('const openChat = async'), source.indexOf('const keepContextPrompt ='));
    expect(open).toContain('const focusGeneration = identityGenerationRef.current;');
    expect(open).toContain("focusGeneration !== identityGenerationRef.current || document.visibilityState === 'hidden'");
    expect(open).toContain('if (inputRef.current?.isConnected) inputRef.current.focus();');
  });
});
