import { describe, expect, it, vi } from 'vitest';
import { checkLocalWebGPU } from './voxWebGPU';

describe('free local WebGPU readiness', () => {
  it('rejects insecure contexts', async () => {
    expect((await checkLocalWebGPU({ secure: false, navigatorObject: {} })).ready).toBe(false);
  });
  it('handles missing browser support without network calls', async () => {
    const result = await checkLocalWebGPU({ secure: true, navigatorObject: {} });
    expect(result.ready).toBe(false);
  });
  it('handles adapter unavailable', async () => {
    const result = await checkLocalWebGPU({
      secure: true,
      navigatorObject: { gpu: { requestAdapter: vi.fn().mockResolvedValue(null) } },
    });
    expect(result.ready).toBe(false);
  });
  it('reports ready only when a device initializes and destroys the temporary device', async () => {
    const destroy = vi.fn();
    const requestDevice = vi.fn().mockResolvedValue({
      destroy,
      limits: { maxBufferSize: 123456 },
      lost: new Promise(() => {}),
    });
    const result = await checkLocalWebGPU({
      secure: true,
      navigatorObject: { gpu: { requestAdapter: vi.fn().mockResolvedValue({ requestDevice }) } },
    });
    expect(result.ready).toBe(true);
    expect(result.maxBufferSize).toBe(123456);
    expect(destroy).toHaveBeenCalledOnce();
  });
  it('handles a browser GPU initialization error', async () => {
    const result = await checkLocalWebGPU({
      secure: true,
      navigatorObject: { gpu: { requestAdapter: vi.fn().mockRejectedValue(new Error('gpu unavailable')) } },
    });
    expect(result.ready).toBe(false);
  });
});
