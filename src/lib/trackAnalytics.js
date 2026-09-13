import { base44 } from '@/api/base44Client';

export async function recordArtPostPlay(postId, expectedUserId) {
  if (!postId) return null;
  try {
    const response = await base44.functions.invoke('recordArtPostPlay', { post_id: postId });
    const data = response?.data ?? response;
    if (
      data?.success !== true ||
      data?.action !== 'record_art_post_play' ||
      data?.userId !== expectedUserId ||
      data?.postId !== postId ||
      typeof data?.counted !== 'boolean'
    ) {
      throw new Error(data?.error || 'Play tracking was not confirmed.');
    }
    return data;
  } catch {
    return null;
  }
}

export async function recordArtPostView(postId, expectedUserId) {
  if (!postId) return null;
  try {
    const response = await base44.functions.invoke('recordArtPostView', { postId });
    const data = response?.data ?? response;
    if (
      data?.success !== true ||
      data?.action !== 'record_art_post_view' ||
      data?.userId !== expectedUserId ||
      data?.postId !== postId ||
      typeof data?.counted !== 'boolean'
    ) {
      throw new Error(data?.error || 'View tracking was not confirmed.');
    }
    return data;
  } catch {
    return null;
  }
}
