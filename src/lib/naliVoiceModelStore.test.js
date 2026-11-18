import { beforeEach, describe, expect, it, vi } from 'vitest';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/api/base44Client', () => ({ base44: { functions: { invoke } } }));
import {
  getPrivateNaliVoiceStatus, updatePrivateNaliVoiceConsent,
  readPrivateNaliVoiceModel, savePrivateNaliVoiceModel, clearPrivateNaliVoiceModel,
} from './naliVoiceModelStore';

describe('NaliVoice authenticated server model storage', () => {
  beforeEach(() => invoke.mockReset());

  it('reads a new private model without browser IndexedDB', async () => {
    invoke.mockResolvedValueOnce({ data: { consent: false, revision: 0, model: null } });
    const model = await readPrivateNaliVoiceModel('signed-in-user');
    expect(model.format).toBe('nalivoice-residual-v1');
    expect(model._serverRevision).toBe(0);
    expect(invoke).toHaveBeenCalledWith('naliVoicePrivateModel', { action: 'get' });
  });

  it('saves only tiny model weights, never raw recordings or caller-chosen user IDs', async () => {
    invoke.mockResolvedValueOnce({ data: { consent: true, revision: 2, model: null } });
    const model = await readPrivateNaliVoiceModel();
    invoke.mockResolvedValueOnce({ data: { success: true, revision: 3 } });
    await savePrivateNaliVoiceModel('other-account-ignored', model);
    const [functionName, body] = invoke.mock.calls[1];
    expect(functionName).toBe('naliVoicePrivateModel');
    expect(body.action).toBe('save');
    expect(body.revision).toBe(2);
    expect(body.model.w1).toHaveLength(144);
    expect(body).not.toHaveProperty('owner');
    expect(body).not.toHaveProperty('audio');
    expect(body).not.toHaveProperty('blob');
    expect(model._serverRevision).toBe(3);
  });

  it('stores consent and erases private training via authenticated server calls', async () => {
    invoke.mockResolvedValueOnce({ data: { success: true, consent: true } });
    await updatePrivateNaliVoiceConsent(true);
    invoke.mockResolvedValueOnce({ data: { success: true } });
    await clearPrivateNaliVoiceModel();
    expect(invoke.mock.calls.map(c => c[1].action)).toEqual(['set_consent', 'erase']);
  });

  it('does not claim success if server denies training', async () => {
    invoke.mockRejectedValueOnce(new Error('Private voice training is disabled'));
    await expect(getPrivateNaliVoiceStatus()).rejects.toThrow('disabled');
  });
});
