// Voice messages enter Studio only on explicit user action. The current
// conversation participant must pass the message-download authorization gate;
// URL parameters never grant media access on their own.
export async function fetchAuthorizedStudioVoiceMessage(messageId, userId, {
  invoke, fetchImpl = fetch,
} = {}) {
  if (typeof messageId !== 'string' || !/^[a-f0-9]{24}$/i.test(messageId) ||
      !userId || typeof invoke !== 'function') {
    throw new Error('Select a valid voice message while signed in.');
  }
  const response = await invoke('authorizeMessageDownload', { messageId });
  const result = response?.data;
  if (result?.success !== true || result.action !== 'authorize_message_download' ||
      result.userId !== userId || result.messageId !== messageId ||
      typeof result.file_url !== 'string' || !/^https:\/\//i.test(result.file_url)) {
    throw new Error(result?.error || 'You do not have permission to import this message.');
  }
  const media = await fetchImpl(result.file_url, { credentials: 'omit' });
  if (!media?.ok) throw new Error('Could not load the authorized voice recording.');
  const limit = 50 * 1024 * 1024;
  const size = Number(media.headers?.get?.('content-length'));
  if (Number.isFinite(size) && size > limit) throw new Error('This recording exceeds the Studio import limit.');
  const blob = await media.blob();
  if (!blob?.size || blob.size > limit) throw new Error('Voice recording is empty or too large.');
  // Do not trust a caller-supplied URL or filename to label non-audio as audio.
  const type = blob.type?.split(';')[0] || 'audio/webm';
  if (!type.startsWith('audio/')) throw new Error('Message is not an audio recording.');
  const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' :
    type.includes('wav') ? 'wav' : type.includes('mpeg') ? 'mp3' : 'webm';
  return new File([blob], `Message Voice ${messageId.slice(-6)}.${extension}`, { type });
}
