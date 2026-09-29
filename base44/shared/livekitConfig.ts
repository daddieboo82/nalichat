// Centralized LiveKit configuration. All battle/meeting functions read
// LiveKit credentials through this module so environment access stays in one
// auditable place using the platform secrets runtime.

import { secrets } from 'base44:runtime';

export interface LiveKitConfig {
  url: string;
  key: string;
  secret: string;
  configured: boolean;
  /** HTTPS host derived from the wss:// URL, suitable for RoomServiceClient. */
  httpHost: string;
  /** True when the URL matches the expected wss:// shape and credentials exist. */
  urlValid: boolean;
}

const URL_PATTERN = /^wss:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i;

export function getLiveKitConfig(): LiveKitConfig {
  const url = secrets.get('LIVEKIT_URL') || '';
  const key = secrets.get('LIVEKIT_API_KEY') || '';
  const secret = secrets.get('LIVEKIT_API_SECRET') || '';
  const urlValid = URL_PATTERN.test(url);
  return {
    url,
    key,
    secret,
    configured: Boolean(url && key && secret),
    httpHost: url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'),
    urlValid,
  };
}