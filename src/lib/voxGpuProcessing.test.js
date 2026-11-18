import { describe, expect, it, vi } from 'vitest';
import { cpuVocalGain, gpuVocalGain } from './voxGpuProcessing';

describe('VoxShift on-device GPU DSP processing', () => {
  it('safely limits output gain using the CPU fallback', () => {
    const input = Float32Array.from([0, 0.5, -0.8, 0.1]);
    expect(Array.from(cpuVocalGain(input, 2))).toEqual([0, 0.93, -0.93, expect.closeTo(0.2, 5)]);
    expect(input[1]).toBe(0.5);
  });

  it('uses CPU when WebGPU is unavailable', async () => {
    const value = await gpuVocalGain(Float32Array.from([0.2, -0.5]), 2, { gpu: null });
    expect(value.backend).toBe('cpu');
    expect(value.samples[1]).toBeCloseTo(-0.93);
  });

  it('uses CPU when no adapter is available', async () => {
    const value = await gpuVocalGain(Float32Array.from([0.3]), 2, {
      gpu: { requestAdapter: vi.fn().mockResolvedValue(null) },
    });
    expect(value.backend).toBe('cpu');
    expect(value.samples[0]).toBeCloseTo(0.6);
  });

  it('uses CPU when GPU initialization fails', async () => {
    const value = await gpuVocalGain(Float32Array.from([0.1]), 2, {
      gpu: { requestAdapter: vi.fn().mockRejectedValue(Error('unavailable')) },
    });
    expect(value.backend).toBe('cpu');
  });

  it('does not perform GPU work for an aborted job', async () => {
    const controller = new AbortController();
    controller.abort();
    const requestAdapter = vi.fn();
    await expect(gpuVocalGain(new Float32Array(20), 1, {
      gpu: { requestAdapter }, signal: controller.signal,
    })).rejects.toThrow();
    expect(requestAdapter).not.toHaveBeenCalled();
  });

  it('accepts an initialized mock compute pipeline and releases GPU resources', async () => {
    const values = [];
    const buffers = [];
    const device = {
      limits: { maxStorageBufferBindingSize: 262144, maxBufferSize: 262144 },
      createShaderModule: vi.fn(() => ({})),
      createComputePipelineAsync: vi.fn(async () => ({ getBindGroupLayout: () => ({}) })),
      createBindGroup: vi.fn(() => ({})),
      createBuffer: vi.fn(({ size }) => {
        const array = new ArrayBuffer(size);
        const buf = {
          mapState: 'unmapped',
          size,
          array,
          mapAsync: vi.fn(async () => { buf.mapState = 'mapped'; }),
          getMappedRange: () => array,
          unmap: vi.fn(() => { buf.mapState = 'unmapped'; }),
          destroy: vi.fn(),
        };
        buffers.push(buf);
        return buf;
      }),
      queue: {
        writeBuffer: vi.fn((buffer, offset, data) => {
          new Uint8Array(buffer.array).set(new Uint8Array(data.buffer || data, data.byteOffset || 0, data.byteLength), offset);
        }),
        submit: vi.fn(),
      },
      createCommandEncoder: () => ({
        beginComputePass: () => ({
          setPipeline: vi.fn(),
          setBindGroup: vi.fn(),
          dispatchWorkgroups: vi.fn(),
          end: vi.fn(),
        }),
        copyBufferToBuffer: (src, s, dst, d, bytes) => {
          // Test stub supplies the expected output, as a real GPU would after compute.
          new Float32Array(dst.array).set(Float32Array.from([0.4, -0.2]));
          values.push(bytes);
        },
        finish: () => ({}),
      }),
      destroy: vi.fn(),
    };
    const result = await gpuVocalGain(Float32Array.from([0.2, -0.1]), 2, {
      gpu: { requestAdapter: vi.fn().mockResolvedValue({ requestDevice: vi.fn().mockResolvedValue(device) }) },
    });
    expect(result.backend).toBe('webgpu');
    expect(Array.from(result.samples)).toEqual(expect.arrayContaining([expect.closeTo(0.4, 5), expect.closeTo(-0.2, 5)]));
    expect(values).toEqual([8]);
    expect(buffers.every(x => x.destroy.mock.calls.length === 1)).toBe(true);
    expect(device.destroy).toHaveBeenCalledOnce();
  });
});
