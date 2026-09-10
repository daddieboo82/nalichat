import { resolveUserSubscription } from './subscriptionAccess.ts';

export const MESSAGE_SEARCH_TYPES = ['text', 'image', 'audio', 'file', 'session'] as const;
export type MessageSearchType = (typeof MESSAGE_SEARCH_TYPES)[number];

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;
const MAX_OFFSET = 10_000;
const MAX_QUERY_LENGTH = 200;
const MAX_SCAN_PER_REQUEST = 500;
const BATCH_SIZE = 100;
const MESSAGE_TYPE_SET = new Set<string>(MESSAGE_SEARCH_TYPES);

interface SearchMessage extends Record<string, unknown> {
  id?: unknown;
  conversation_id?: unknown;
  sender_id?: unknown;
  sender_name?: unknown;
  text?: unknown;
  type?: unknown;
  file_name?: unknown;
  created_date?: unknown;
  thread_id?: unknown;
}

interface ConversationRecord {
  participant_ids?: unknown;
}

interface SearchDependencies {
  conversationEntity: {
    get(id: string): Promise<ConversationRecord | null>;
  };
  messageEntity: {
    filter(
      query: Record<string, unknown>,
      sort: string,
      limit: number,
      skip: number,
    ): Promise<SearchMessage[]>;
  };
  subscriptionEntity: Parameters<typeof resolveUserSubscription>[0];
}

export interface MessageSearchInput {
  conversation_id?: unknown;
  query?: unknown;
  sender_id?: unknown;
  date_from?: unknown;
  date_to?: unknown;
  types?: unknown;
  order?: unknown;
  limit?: unknown;
  offset?: unknown;
}

interface NormalizedSearchInput {
  conversationId: string;
  query: string;
  senderId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  types: MessageSearchType[];
  order: 'newest' | 'oldest';
  limit: number;
  offset: number;
  usesAdvancedFilters: boolean;
}

export class MessageSearchError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'MessageSearchError';
  }
}

function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new MessageSearchError(400, 'INVALID_SEARCH_INPUT', `${field} must be a string.`);
  }
  return value.trim() || null;
}

function normalizeTimestamp(value: unknown, field: string): string | null {
  const text = optionalString(value, field);
  if (!text) return null;
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) {
    throw new MessageSearchError(
      400,
      'INVALID_SEARCH_DATE',
      `${field} must include an explicit timezone.`,
    );
  }
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) {
    throw new MessageSearchError(400, 'INVALID_SEARCH_DATE', `${field} is not a valid date.`);
  }
  return new Date(timestamp).toISOString();
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  field: string,
): number {
  if (value === undefined || value === null) return fallback;
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new MessageSearchError(
      400,
      'INVALID_SEARCH_INPUT',
      `${field} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
  return Number(value);
}

export function normalizeMessageSearchInput(input: MessageSearchInput): NormalizedSearchInput {
  const conversationId = optionalString(input?.conversation_id, 'conversation_id');
  if (!conversationId) {
    throw new MessageSearchError(400, 'INVALID_SEARCH_INPUT', 'conversation_id is required.');
  }

  const query = optionalString(input?.query, 'query') || '';
  if (query.length > MAX_QUERY_LENGTH) {
    throw new MessageSearchError(
      400,
      'INVALID_SEARCH_INPUT',
      `query must be ${MAX_QUERY_LENGTH} characters or fewer.`,
    );
  }

  const senderId = optionalString(input?.sender_id, 'sender_id');
  const dateFrom = normalizeTimestamp(input?.date_from, 'date_from');
  const dateTo = normalizeTimestamp(input?.date_to, 'date_to');
  if (dateFrom && dateTo && Date.parse(dateFrom) >= Date.parse(dateTo)) {
    throw new MessageSearchError(
      400,
      'INVALID_SEARCH_DATE_RANGE',
      'date_from must be earlier than date_to.',
    );
  }

  const rawTypes = input?.types === undefined || input?.types === null ? [] : input.types;
  if (!Array.isArray(rawTypes) || rawTypes.some((type) => !MESSAGE_TYPE_SET.has(String(type)))) {
    throw new MessageSearchError(
      400,
      'INVALID_MESSAGE_TYPE',
      `types must contain only: ${MESSAGE_SEARCH_TYPES.join(', ')}.`,
    );
  }
  const types = [...new Set(rawTypes.map(String))] as MessageSearchType[];
  const requestedOrder = input?.order;
  if (requestedOrder !== undefined && requestedOrder !== 'newest' && requestedOrder !== 'oldest') {
    throw new MessageSearchError(
      400,
      'INVALID_SEARCH_INPUT',
      'order must be newest or oldest.',
    );
  }
  const order = requestedOrder === 'oldest' ? 'oldest' : 'newest';

  const normalized: NormalizedSearchInput = {
    conversationId,
    query,
    senderId,
    dateFrom,
    dateTo,
    types,
    order,
    limit: boundedInteger(input?.limit, DEFAULT_LIMIT, 1, MAX_LIMIT, 'limit'),
    offset: boundedInteger(input?.offset, 0, 0, MAX_OFFSET, 'offset'),
    usesAdvancedFilters: Boolean(senderId || dateFrom || dateTo || types.length),
  };

  if (!normalized.query && !normalized.usesAdvancedFilters) {
    throw new MessageSearchError(
      400,
      'EMPTY_SEARCH',
      'Enter a text query or select at least one advanced filter.',
    );
  }
  return normalized;
}

function messageMatches(message: SearchMessage, input: NormalizedSearchInput): boolean {
  if (message.conversation_id !== input.conversationId) return false;
  if (input.senderId && message.sender_id !== input.senderId) return false;
  if (input.types.length && !input.types.includes(String(message.type) as MessageSearchType)) {
    return false;
  }

  const createdAt = typeof message.created_date === 'string'
    ? Date.parse(message.created_date)
    : Number.NaN;
  if (input.dateFrom && (!Number.isFinite(createdAt) || createdAt < Date.parse(input.dateFrom))) {
    return false;
  }
  if (input.dateTo && (!Number.isFinite(createdAt) || createdAt >= Date.parse(input.dateTo))) {
    return false;
  }

  if (!input.query) return true;
  const needle = input.query.toLocaleLowerCase();
  const haystack = [message.text, message.sender_name, message.file_name]
    .filter((value): value is string => typeof value === 'string')
    .join('\n')
    .toLocaleLowerCase();
  return haystack.includes(needle);
}

function compareMessages(
  left: SearchMessage,
  right: SearchMessage,
  order: NormalizedSearchInput['order'],
): number {
  const leftTime = typeof left.created_date === 'string' ? Date.parse(left.created_date) : 0;
  const rightTime = typeof right.created_date === 'string' ? Date.parse(right.created_date) : 0;
  const dateComparison = (leftTime - rightTime) * (order === 'oldest' ? 1 : -1);
  if (dateComparison) return dateComparison;
  return String(left.id || '').localeCompare(String(right.id || ''))
    * (order === 'oldest' ? 1 : -1);
}

function searchResult(message: SearchMessage) {
  return {
    id: message.id,
    sender_id: message.sender_id,
    sender_name: message.sender_name,
    text: message.text,
    type: message.type,
    file_name: message.file_name,
    created_date: message.created_date,
    thread_id: message.thread_id,
  };
}

export async function executeMessageSearch(
  dependencies: SearchDependencies,
  rawInput: MessageSearchInput,
  requesterId: string,
) {
  const input = normalizeMessageSearchInput(rawInput);
  const conversation = await dependencies.conversationEntity.get(input.conversationId);
  const participantIds = Array.isArray(conversation?.participant_ids)
    ? conversation.participant_ids
    : [];
  if (!participantIds.includes(requesterId)) {
    throw new MessageSearchError(
      403,
      'CONVERSATION_ACCESS_DENIED',
      'You do not have access to this conversation.',
    );
  }
  if (input.senderId && !participantIds.includes(input.senderId)) {
    throw new MessageSearchError(
      400,
      'INVALID_SENDER_FILTER',
      'The sender must be a member of the conversation.',
    );
  }

  if (input.usesAdvancedFilters) {
    const access = await resolveUserSubscription(dependencies.subscriptionEntity, requesterId);
    if (access.entitlements['search.advanced'] !== true) {
      throw new MessageSearchError(
        403,
        'ADVANCED_SEARCH_ENTITLEMENT_REQUIRED',
        'Advanced message filters require Premium.',
      );
    }
  }

  const entityQuery: Record<string, unknown> = { conversation_id: input.conversationId };
  if (input.senderId) entityQuery.sender_id = input.senderId;
  if (input.types.length === 1) entityQuery.type = input.types[0];
  if (input.dateFrom || input.dateTo) {
    entityQuery.created_date = {
      ...(input.dateFrom ? { $gte: input.dateFrom } : {}),
      ...(input.dateTo ? { $lt: input.dateTo } : {}),
    };
  }

  const matches: SearchMessage[] = [];
  let backendOffset = input.offset;
  let scanned = 0;
  let reachedEnd = false;

  while (
    matches.length < input.limit
    && scanned < MAX_SCAN_PER_REQUEST
    && backendOffset <= MAX_OFFSET
  ) {
    const pageLimit = Math.min(
      BATCH_SIZE,
      MAX_SCAN_PER_REQUEST - scanned,
      MAX_OFFSET - backendOffset + 1,
    );
    const page = await dependencies.messageEntity.filter(
      entityQuery,
      input.order === 'newest' ? '-created_date' : 'created_date',
      pageLimit,
      backendOffset,
    );
    if (!page.length) {
      reachedEnd = true;
      break;
    }

    let consumed = 0;
    for (const message of page) {
      consumed += 1;
      scanned += 1;
      backendOffset += 1;
      if (messageMatches(message, input)) matches.push(message);
      if (matches.length === input.limit || scanned === MAX_SCAN_PER_REQUEST) break;
    }

    if (consumed === page.length && page.length < pageLimit) {
      reachedEnd = true;
      break;
    }
  }

  matches.sort((left, right) => compareMessages(left, right, input.order));
  const truncated = !reachedEnd && backendOffset > MAX_OFFSET;
  const hasMore = !reachedEnd && !truncated;

  return {
    results: matches.map(searchResult),
    pagination: {
      limit: input.limit,
      offset: input.offset,
      next_offset: hasMore ? backendOffset : null,
      has_more: hasMore,
      scanned,
      truncated,
    },
    order: input.order,
  };
}
