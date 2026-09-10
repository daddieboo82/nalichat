import { resolveUserSubscription } from './subscriptionAccess.ts';

export const CHAT_EXPORT_PAGE_SIZE = 250;
export const CHAT_EXPORT_MESSAGE_CAP = 5_000;

const MAX_TITLE_LENGTH = 200;
const MAX_NAME_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 100_000;
const MAX_ATTACHMENT_NAME_LENGTH = 255;

type EntityRecord = Record<string, unknown>;

interface FilterEntity {
  filter(
    query: Record<string, unknown>,
    sort: string,
    limit: number,
    skip: number,
  ): Promise<EntityRecord[]>;
}

interface GetEntity {
  get(id: string): Promise<EntityRecord | null>;
}

interface ChatExportEntities {
  Conversation: GetEntity;
  Message: FilterEntity;
  User: GetEntity;
  Subscription: FilterEntity;
}

export interface ChatExportModel {
  version: 1;
  exportedAt: string;
  conversation: {
    title: string;
    type: 'dm' | 'group';
    participants: string[];
  };
  messages: Array<{
    number: number;
    sender: string;
    timestamp: string | null;
    edited: boolean;
    deleted: boolean;
    text: string;
    relation: {
      replyTo: string | null;
      thread: string | null;
    };
    attachment: {
      name: string;
      mediaType: string;
      sizeBytes: number | null;
      url: string | null;
      unsupported: boolean;
    } | null;
  }>;
  limits: {
    messageCap: number;
    truncated: boolean;
  };
}

export class ChatExportError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ChatExportError';
    this.status = status;
    this.code = code;
  }
}

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value
    .replace(/\u0000/g, '')
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
    .trim();
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return null;
  }
}

function participantName(user: EntityRecord | null, fallback: string): string {
  return cleanText(user?.display_name || user?.full_name, fallback, MAX_NAME_LENGTH);
}

function normalizeMessages(
  messages: EntityRecord[],
  participantIds: Set<string>,
  participantNames: Map<string, string>,
): ChatExportModel['messages'] {
  const sorted = [...messages].sort((left, right) => {
    const leftTime = Date.parse(String(left.created_date || ''));
    const rightTime = Date.parse(String(right.created_date || ''));
    const timeDifference = (Number.isFinite(leftTime) ? leftTime : 0)
      - (Number.isFinite(rightTime) ? rightTime : 0);
    return timeDifference || String(left.id || '').localeCompare(String(right.id || ''));
  });
  const messageNumbers = new Map(
    sorted.map((message, index) => [String(message.id || ''), index + 1]),
  );

  return sorted.map((message, index) => {
    const senderId = typeof message.sender_id === 'string' ? message.sender_id : '';
    const sender = participantIds.has(senderId)
      ? participantNames.get(senderId)
        || cleanText(message.sender_name, 'Conversation participant', MAX_NAME_LENGTH)
      : cleanText(message.sender_name, 'System', MAX_NAME_LENGTH);
    const deleted = message.is_deleted === true
      || typeof message.deleted_date === 'string'
      || typeof message.deleted_at === 'string';
    const attachmentUrl = deleted ? null : safeHttpUrl(message.file_url);
    const rawMediaType = cleanText(message.file_type || message.type, 'file', 120);
    const attachment = !deleted && (message.file_url || message.file_name)
      ? {
          name: cleanText(message.file_name, 'Attachment', MAX_ATTACHMENT_NAME_LENGTH),
          mediaType: rawMediaType,
          sizeBytes: positiveInteger(message.file_size),
          url: attachmentUrl,
          unsupported: attachmentUrl === null,
        }
      : null;
    const threadId = typeof message.thread_id === 'string' ? message.thread_id : null;
    const threadNumber = threadId ? messageNumbers.get(threadId) : null;
    const replySender = cleanText(message.reply_to_sender, '', MAX_NAME_LENGTH);
    const replyText = cleanText(message.reply_to_text, '', 240);

    return {
      number: index + 1,
      sender,
      timestamp: isoTimestamp(message.created_date),
      edited: message.is_edited === true,
      deleted,
      text: deleted
        ? '[Deleted message]'
        : cleanText(message.text, attachment ? '' : '[Unsupported message content]', MAX_MESSAGE_LENGTH),
      relation: {
        replyTo: replySender || replyText
          ? `${replySender || 'Message'}${replyText ? `: ${replyText}` : ''}`
          : null,
        thread: threadId
          ? threadNumber
            ? `Thread reply to message #${threadNumber}`
            : 'Thread reply (parent message unavailable)'
          : null,
      },
      attachment,
    };
  });
}

async function loadMessages(
  entity: FilterEntity,
  conversationId: string,
): Promise<{ messages: EntityRecord[]; truncated: boolean }> {
  const messages: EntityRecord[] = [];

  while (messages.length <= CHAT_EXPORT_MESSAGE_CAP) {
    const remainingWithSentinel = CHAT_EXPORT_MESSAGE_CAP + 1 - messages.length;
    const page = await entity.filter(
      { conversation_id: conversationId },
      'created_date',
      Math.min(CHAT_EXPORT_PAGE_SIZE, remainingWithSentinel),
      messages.length,
    );
    messages.push(...page);
    if (page.length < Math.min(CHAT_EXPORT_PAGE_SIZE, remainingWithSentinel)) break;
  }

  return {
    messages: messages.slice(0, CHAT_EXPORT_MESSAGE_CAP),
    truncated: messages.length > CHAT_EXPORT_MESSAGE_CAP,
  };
}

export async function buildAuthorizedChatExport({
  entities,
  user,
  conversationId,
  now = new Date().toISOString(),
}: {
  entities: ChatExportEntities;
  user: EntityRecord;
  conversationId: string;
  now?: string;
}): Promise<ChatExportModel> {
  if (!user?.id || typeof user.id !== 'string') {
    throw new ChatExportError(401, 'UNAUTHORIZED', 'Authentication is required');
  }
  if (!conversationId) {
    throw new ChatExportError(400, 'INVALID_REQUEST', 'conversation_id is required');
  }

  const conversation = await entities.Conversation.get(conversationId);
  if (!conversation) {
    throw new ChatExportError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
  }
  const participantIds = Array.isArray(conversation.participant_ids)
    ? conversation.participant_ids.filter((id): id is string => typeof id === 'string')
    : [];
  if (!participantIds.includes(user.id)) {
    throw new ChatExportError(403, 'NOT_A_PARTICIPANT', 'Conversation membership is required');
  }

  const access = await resolveUserSubscription(entities.Subscription, user.id, now);
  if (access.entitlements['chat.export'] !== true) {
    throw new ChatExportError(403, 'CHAT_EXPORT_NOT_ENTITLED', 'Chat export requires Premium');
  }

  const [participantUsers, loaded] = await Promise.all([
    Promise.all(participantIds.map((id) => entities.User.get(id))),
    loadMessages(entities.Message, conversationId),
  ]);
  const participantNames = new Map<string, string>();
  participantIds.forEach((id, index) => {
    const fallback = id === user.id
      ? cleanText(user.display_name || user.full_name, 'You', MAX_NAME_LENGTH)
      : `Participant ${index + 1}`;
    participantNames.set(id, participantName(participantUsers[index], fallback));
  });
  const names = participantIds.map((id) => participantNames.get(id) || 'Participant');
  const type = conversation.type === 'group' ? 'group' : 'dm';
  const otherNames = participantIds
    .filter((id) => id !== user.id)
    .map((id) => participantNames.get(id) || 'Participant');
  const fallbackTitle = type === 'group'
    ? 'Group conversation'
    : `Conversation with ${otherNames.join(', ') || 'yourself'}`;

  return {
    version: 1,
    exportedAt: new Date(now).toISOString(),
    conversation: {
      title: cleanText(conversation.name, fallbackTitle, MAX_TITLE_LENGTH),
      type,
      participants: names,
    },
    messages: normalizeMessages(
      loaded.messages.filter((message) => message.conversation_id === conversationId),
      new Set(participantIds),
      participantNames,
    ),
    limits: {
      messageCap: CHAT_EXPORT_MESSAGE_CAP,
      truncated: loaded.truncated,
    },
  };
}
