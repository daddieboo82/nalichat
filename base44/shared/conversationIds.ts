import { isBase44EntityId } from './workflowEvents.ts';

const DETERMINISTIC_CONVERSATION_ID = /^(?:dm|group_request|public_room)_[0-9a-f]{64}$/;

export function isConversationId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const id = value.trim();
  return isBase44EntityId(id) || DETERMINISTIC_CONVERSATION_ID.test(id);
}
