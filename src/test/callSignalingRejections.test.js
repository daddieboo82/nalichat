// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('call signaling rejection handling', () => {
  it('catches call-end signaling failures inside CallEngine', async () => {
    const source = await readText('src/lib/callEngine.js');
    expect(source).toContain('Promise.resolve(this.onSignal?.({ type: "end", callId: this.callId }))');
    expect(source).toContain('Failed to send call end signal:');
  });

  it('handles async signal processing and decline failures', async () => {
    const source = await readText('src/hooks/useCall.js');
    expect(source).toContain('void engineRef.current.handleSignal(signal).catch');
    expect(source).toContain('void engine.handleSignal(bufferedSignal).catch');
    expect(source).toContain('void sendSignal({ type: "end", callId: callIdRef.current }).catch');
    expect(source).not.toContain('sendSignal({ type: "end", callId });\n            engineRef.current?.endCall();');
  });
});
