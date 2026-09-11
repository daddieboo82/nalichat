import { base44 } from '@/api/base44Client';

export async function recordArtPostPlay(postId) {
  if (!postId) return null;
  try {
    const response = await base44.functions.invoke('recordArtPostPlay', { post_id: postId });
    return response?.data ?? response;
  } catch {
    return null;
  }
}
