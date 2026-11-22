// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LargeFileTransfer from '@/components/files/LargeFileTransfer';

const { upload, invoke } = vi.hoisted(() => ({ upload: vi.fn(), invoke: vi.fn() }));
vi.mock('@/lib/resumableUpload', () => ({ resumableUpload: upload }));
vi.mock('@/api/base44Client', () => ({ base44: { functions: { invoke } } }));
vi.mock('sonner', () => ({ toast: { info: vi.fn() } }));

afterEach(cleanup);

it('ignores a late completion from a cancelled upload', async () => {
  let completeUpload;
  const pending = new Promise(resolve => { completeUpload = resolve; });
  const cancel = vi.fn().mockResolvedValue(undefined);
  pending.controller = { cancel };
  upload.mockReturnValueOnce(pending);
  render(<LargeFileTransfer currentUser={{ id: 'uploader' }} />);
  const file = new File(['audio'], 'track.wav', { type: 'audio/wav' });
  fireEvent.change(screen.getByLabelText('Choose transfer file'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Upload and create link' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await screen.findByRole('button', { name: 'Upload and create link' });
  await act(async () => completeUpload({ file_url: 'https://example.com/uploaded' }));

  expect(cancel).toHaveBeenCalledOnce();
  expect(invoke).not.toHaveBeenCalled();
});
