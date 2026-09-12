const BASE44_ENTITY_ID = /^[0-9A-F]{24}$/i;

export function isBase44EntityId(value: unknown): value is string {
  return typeof value === 'string' && BASE44_ENTITY_ID.test(value);
}

export function workflowEntityRecordId(body: {
  event?: { entity_id?: unknown; id?: unknown };
  data?: { id?: unknown };
}) {
  const supplied = [
    body?.event?.entity_id,
    body?.event?.id,
    body?.data?.id,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  const invalid = supplied.some((value) => !isBase44EntityId(value));
  const unique = [...new Set(supplied.filter(isBase44EntityId))];
  return {
    id: !invalid && unique.length === 1 ? unique[0] : null,
    conflict: unique.length > 1,
    invalid,
  };
}

export function workflowRecordIsFresh(
  record: { created_date?: unknown; updated_date?: unknown },
  kind: 'create' | 'update',
  nowMs = Date.now(),
  maxAgeMs = 10 * 60 * 1000,
) {
  const raw = kind === 'update' ? record?.updated_date : record?.created_date;
  const timestamp = Date.parse(String(raw || ''));
  return Number.isFinite(timestamp)
    && nowMs >= timestamp
    && nowMs - timestamp <= maxAgeMs;
}
