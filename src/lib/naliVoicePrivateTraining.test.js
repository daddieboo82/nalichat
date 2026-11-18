import { describe, expect, it, vi } from 'vitest';
import { createNaliVoiceModel } from './naliVoiceCore';
import { trainPrivateNaliVoiceFromRecording } from './naliVoicePrivateTraining';

const samples = () => new Float32Array(16000).fill(0.2);
function workerFactory() {
  return {
    postMessage(message) {
      queueMicrotask(() => this.onmessage?.({
        data: { type: 'TRAINED', model: { ...message.model, trainedSteps: message.model.trainedSteps + 2800 } },
      }));
    },
    terminate: vi.fn(),
    onmessage: null,
    onerror: null,
  };
}

describe('Simple account-scoped NaliVoice learning', () => {
  it('does nothing before explicit opt in', async () => {
    const readModel = vi.fn();
    const prepare = vi.fn(samples);
    const result = await trainPrivateNaliVoiceFromRecording('owner-one', {}, {
      consentCheck: async () => false, readModel, prepare,
    });
    expect(result).toEqual({ skipped: 'not_opted_in' });
    expect(prepare).not.toHaveBeenCalled();
    expect(readModel).not.toHaveBeenCalled();
  });

  it('serializes multiple recordings into the same account checkpoint', async () => {
    let saved = createNaliVoiceModel();
    const load = vi.fn(async () => saved);
    const save = vi.fn(async (_owner, model) => { saved = model; });
    const options = {
      consentCheck: async () => true,
      readModel: load, saveModel: save, prepare: samples, workerFactory,
    };
    const [first, second] = await Promise.all([
      trainPrivateNaliVoiceFromRecording('owner-two', {}, options),
      trainPrivateNaliVoiceFromRecording('owner-two', {}, options),
    ]);
    expect(first.trainedSteps).toBe(2800);
    expect(second.trainedSteps).toBe(5600);
    expect(saved.trainedSteps).toBe(5600);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('does not save after consent was revoked while training', async () => {
    let enabled = true;
    const save = vi.fn();
    const result = await trainPrivateNaliVoiceFromRecording('owner-three', {}, {
      consentCheck: async () => enabled,
      readModel: async () => createNaliVoiceModel(),
      saveModel: save,
      prepare: samples,
      workerFactory: () => ({
        terminate() {},
        onerror: null,
        onmessage: null,
        postMessage(message) {
          enabled = false;
          queueMicrotask(() => this.onmessage?.({
            data: { type: 'TRAINED', model: { ...message.model, trainedSteps: 2800 } },
          }));
        },
      }),
    });
    expect(result).toEqual({ skipped: 'consent_revoked' });
    expect(save).not.toHaveBeenCalled();
  });
});
