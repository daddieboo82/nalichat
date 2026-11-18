// NaliBase-authored worker for self-supervised neural audio restoration.
// This worker only receives local PCM; it does not use any network services.
import { createNaliVoiceModel, trainNaliVoiceRestorer, inferNaliVoice } from './naliVoiceCore';

self.onmessage = ({ data }) => {
  if (data?.type !== 'RESTORE') return;
  try {
    const samples = new Float32Array(data.samples);
    const model = createNaliVoiceModel();
    trainNaliVoiceRestorer(model, samples, { iterations: 2800 });
    const restored = inferNaliVoice(model, samples);
    self.postMessage({ type: 'COMPLETE', samples: restored.buffer }, [restored.buffer]);
  } catch (error) {
    self.postMessage({ type: 'ERROR', message: error?.message || 'NaliVoice worker failed.' });
  }
};
