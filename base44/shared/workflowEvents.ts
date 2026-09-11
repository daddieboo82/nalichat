export function workflowEntityRecordId(body: {
  event?: { entity_id?: unknown; id?: unknown };
  data?: { id?: unknown };
}) {
  const ids = [
    body?.event?.entity_id,
    body?.event?.id,
    body?.data?.id,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  const unique = [...new Set(ids)];
  return {
    id: unique.length === 1 ? unique[0] : null,
    conflict: unique.length > 1,
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
