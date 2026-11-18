// Automatically acquire publicly published RVC models for VoxShift's free
// default-voice demo. These URLs are static model files, not hosted inference.
// Source model cards: TigreGotico/voiceclonnx-rvc (MIT) and
// PhoenixStormJr/RVC-V2-default-voice (MIT, author-created voice).
// The built-in preset changes timbre; it does not learn the user's own voice.
const HF = 'https://huggingface.co';
export const AUTO_RVC_PRESET = Object.freeze({
  label: 'Built-in default voice (experimental)',
  estimatedDownloadMB: 240,
  sources: [
    { key: 'contentVec', name: 'contentvec_768l12_q8.onnx', url: HF + '/TigreGotico/voiceclonnx-rvc/resolve/main/contentvec_768l12_q8.onnx', max: 120 * 1024 * 1024 },
    { key: 'rmvpe', name: 'rmvpe_q8.onnx', url: HF + '/TigreGotico/voiceclonnx-rvc/resolve/main/rmvpe_q8.onnx', max: 120 * 1024 * 1024 },
    { key: 'voicePth', name: 'default.pth', url: HF + '/PhoenixStormJr/RVC-V2-default-voice/resolve/main/default.pth', max: 80 * 1024 * 1024 },
  ],
});

async function download(file, { fetchImpl, signal, onStatus }) {
  signal?.throwIfAborted();
  onStatus?.('Downloading free local model: ' + file.name + '…');
  const response = await fetchImpl(file.url, { signal, mode: 'cors', redirect: 'follow' });
  if (!response?.ok) throw new Error('Could not download ' + file.name + '. Check your connection and try again.');
  const length = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(length) && length > file.max) {
    throw new Error(file.name + ' exceeds the safe download limit.');
  }
  const blob = await response.blob();
  signal?.throwIfAborted();
  if (blob.size < 4096 || blob.size > file.max) {
    throw new Error(file.name + ' is incomplete or exceeds the supported size.');
  }
  return new File([blob], file.name, { type: 'application/octet-stream' });
}

// Lazy loading avoids ~240 MB of downloads before the user asks to generate.
// The downloads contain weights only; source audio remains on the device.
// No background fetch, no secrets, and no paid service invocation.
export async function loadAutomaticRvcModels({
  signal, onStatus,
  fetchImpl = fetch,
  convert = async (file) => (await import('rvc-onnx-web')).pthToOnnx(file),
} = {}) {
  const sources = AUTO_RVC_PRESET.sources;
  const contentVec = await download(sources[0], { fetchImpl, signal, onStatus });
  const rmvpe = await download(sources[1], { fetchImpl, signal, onStatus });
  const pth = await download(sources[2], { fetchImpl, signal, onStatus });
  signal?.throwIfAborted();
  onStatus?.('Preparing the built-in voice model locally…');
  const converted = await convert(pth);
  signal?.throwIfAborted();
  const bytes = converted?.onnxBuffer;
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 4096) {
    throw new Error('The built-in voice preset could not be converted into a compatible model.');
  }
  const model = new File([bytes], 'voxshift-default-voice.onnx', { type: 'application/octet-stream' });
  onStatus?.('Free voice models ready; reconstructing audio…');
  return { model, contentVec, rmvpe };
}
