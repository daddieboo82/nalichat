import { describe, expect, it } from 'vitest';
import { checkLocalRvcReadiness } from './voxLocalReadiness';

describe('free local AI compatibility', () => {
  it('rejects browsers without Web Workers', () => {
    const result = checkLocalRvcReadiness({ workerAvailable: false, wasmAvailable: true });
    expect(result.supported).toBe(false);
    expect(result.reason).toContain('workers');
  });

  it('rejects browsers without WebAssembly', () => {
    const result = checkLocalRvcReadiness({ workerAvailable: true, wasmAvailable: false });
    expect(result.supported).toBe(false);
    expect(result.reason).toContain('WebAssembly');
  });

  it('warns on low-memory devices without falsely claiming incompatibility', () => {
    const result = checkLocalRvcReadiness({ workerAvailable: true, wasmAvailable: true, memoryGB: 2 });
    expect(result.supported).toBe(true);
    expect(result.caution).toBe(true);
  });

  it('does not require WebGPU for the RVC CPU inference runtime', () => {
    const result = checkLocalRvcReadiness({ workerAvailable: true, wasmAvailable: true, memoryGB: 8 });
    expect(result.supported).toBe(true);
    expect(result.caution).toBe(false);
    expect(result.reason).toContain('WebAssembly');
  });
});
