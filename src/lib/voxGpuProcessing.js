// Free client-side WebGPU processing. Pure DSP (not neural voice conversion).
// The CPU path is an automatic fallback, and no external inference API is called.
const SHADER = `
struct Params { gain: f32, count: u32, reserved0: u32, reserved1: u32 };
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  if (index >= params.count) { return; }
  output[index] = clamp(input[index] * params.gain, -0.93, 0.93);
}
`;

// Standard GPUBufferUsage / GPUMapMode values, encoded to allow isolated tests.
const MAP_READ = 0x0001;
const COPY_SRC = 0x0004;
const COPY_DST = 0x0008;
const UNIFORM = 0x0040;
const STORAGE = 0x0080;
const CHUNK_SAMPLES = 65536;

export function cpuVocalGain(samples, gain) {
  const result = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    result[i] = Math.max(-0.93, Math.min(0.93, samples[i] * gain));
  }
  return result;
}

export async function gpuVocalGain(samples, gain, { gpu = globalThis.navigator?.gpu, signal } = {}) {
  signal?.throwIfAborted();
  if (!gpu?.requestAdapter || !Number.isFinite(gain) || gain < 0 || gain > 4) {
    return { samples: cpuVocalGain(samples, gain), backend: 'cpu' };
  }
  let device;
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter');
    device = await adapter.requestDevice();
    const shader = device.createShaderModule({ code: SHADER });
    const pipeline = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: shader, entryPoint: 'main' },
    });
    const output = new Float32Array(samples.length);
    const maxByDevice = Math.floor((device.limits?.maxStorageBufferBindingSize || 262144) / 4);
    const maxByBuffer = Math.floor((device.limits?.maxBufferSize || 262144) / 4);
    const chunk = Math.min(CHUNK_SAMPLES, maxByDevice, maxByBuffer);
    if (!Number.isFinite(chunk) || chunk < 64) throw new Error('Insufficient WebGPU buffer size');
    for (let offset = 0; offset < samples.length; offset += chunk) {
      signal?.throwIfAborted();
      const count = Math.min(chunk, samples.length - offset);
      const byteLength = count * 4;
      const created = [];
      let mapped = false;
      try {
        const create = (size, usage) => {
          const buffer = device.createBuffer({ size, usage });
          created.push(buffer);
          return buffer;
        };
        const input = create(byteLength, STORAGE | COPY_DST);
        const result = create(byteLength, STORAGE | COPY_SRC);
        const readback = create(byteLength, COPY_DST | MAP_READ);
        const uniforms = create(16, UNIFORM | COPY_DST);
        device.queue.writeBuffer(input, 0, samples.subarray(offset, offset + count));
        const header = new ArrayBuffer(16);
        const view = new DataView(header);
        view.setFloat32(0, gain, true);
        view.setUint32(4, count, true);
        device.queue.writeBuffer(uniforms, 0, header);
        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: input } },
            { binding: 1, resource: { buffer: result } },
            { binding: 2, resource: { buffer: uniforms } },
          ],
        });
        const command = device.createCommandEncoder();
        const pass = command.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(count / 64));
        pass.end();
        command.copyBufferToBuffer(result, 0, readback, 0, byteLength);
        device.queue.submit([command.finish()]);
        await readback.mapAsync(MAP_READ);
        mapped = true;
        output.set(new Float32Array(readback.getMappedRange().slice(0)), offset);
      } finally {
        for (const buffer of created) {
          if (buffer.mapState === 'mapped') buffer.unmap();
          buffer.destroy();
        }
        if (mapped) mapped = false;
      }
    }
    signal?.throwIfAborted();
    return { samples: output, backend: 'webgpu' };
  } catch (error) {
    signal?.throwIfAborted();
    return { samples: cpuVocalGain(samples, gain), backend: 'cpu' };
  } finally {
    device?.destroy?.();
  }
}
