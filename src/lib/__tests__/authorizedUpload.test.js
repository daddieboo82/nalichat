import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authorizedUpload, finalizeSharedFileUpload } from '@/lib/authorizedUpload';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  upload: vi.fn(),
  checkSubscriptionStatus: vi.fn(),
}));

vi.mock('@/api/base44Client', () => ({
  base44: {
    functions: { invoke: mocks.invoke },
    integrations: { Core: { UploadFile: mocks.upload } },
  },
}));
vi.mock('@/lib/subscriptionClient', () => ({
  checkSubscriptionStatus: mocks.checkSubscriptionStatus,
}));

function fileWithSize(size) {
  const file = new File(['x'], 'track.wav', { type: 'audio/wav' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('authorizedUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkSubscriptionStatus.mockResolvedValue({
      limits: { upload: { maxBytes: 2 * 1024 * 1024 * 1024 } },
    });
    mocks.invoke.mockResolvedValue({ data: { authorized: true } });
    mocks.upload.mockResolvedValue({ file_url: 'https://files.example/track.wav' });
  });

  it('accepts a file exactly at the authoritative free boundary', async () => {
    await expect(authorizedUpload(fileWithSize(2 * 1024 * 1024 * 1024), {
      accept: 'audio',
    })).resolves.toMatchObject({ file_url: expect.any(String) });
    expect(mocks.invoke).toHaveBeenCalledWith('authorizeUpload', {
      size: 2 * 1024 * 1024 * 1024,
      kind: 'audio',
    });
    expect(mocks.upload).toHaveBeenCalledOnce();
  });

  it('rejects one byte above the free boundary before transfer work', async () => {
    await expect(authorizedUpload(fileWithSize(2 * 1024 * 1024 * 1024 + 1), {
      accept: 'audio',
      maxBytes: 20 * 1024 * 1024 * 1024,
    })).rejects.toThrow('limit is 2.0 GB');
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('does not send a client plan or limit to upload authorization', async () => {
    await authorizedUpload(fileWithSize(1024), {
      accept: 'audio',
      plan: 'premium_plus',
      maxBytes: Number.MAX_SAFE_INTEGER,
    });
    expect(mocks.invoke.mock.calls[0][1]).toEqual({ size: 1024, kind: 'audio' });
  });

  it('finalizes SharedFile metadata without accepting uploader identity', async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: { file: { id: 'file-1', uploader_id: 'server-user' } },
    });
    await expect(finalizeSharedFileUpload({
      name: 'mix.wav',
      file_url: 'https://files.example/mix.wav',
      file_type: 'audio',
      file_size: 1024,
      uploader_id: 'spoofed-user',
    })).resolves.toMatchObject({ id: 'file-1', uploader_id: 'server-user' });

    expect(mocks.invoke).toHaveBeenCalledWith('finalizeSharedFileUpload', {
      name: 'mix.wav',
      file_url: 'https://files.example/mix.wav',
      file_type: 'audio',
      file_size: 1024,
      description: undefined,
      folder_id: undefined,
      project_id: undefined,
    });
  });
});
