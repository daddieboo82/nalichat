import { secrets } from "base44:runtime";

export function getSupabaseConfig() {
  const url = secrets.get("SUPABASE_URL");
  const serviceKey = secrets.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets must be set in the dashboard Secrets page");
  }
  return { url, serviceKey };
}

let _tableColumnsCache = null;

export async function getTableColumns() {
  if (_tableColumnsCache) return _tableColumnsCache;
  const { url, serviceKey } = getSupabaseConfig();
  const res = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const spec = await res.json();
  const columns = {};
  for (const [tableName, definition] of Object.entries(spec.definitions || {})) {
    if (definition.properties) {
      columns[tableName] = Object.keys(definition.properties);
    }
  }
  _tableColumnsCache = columns;
  return columns;
}

function filterRecord(record, columns) {
  const filtered = {};
  for (const col of columns) {
    filtered[col] = record[col] === undefined ? null : record[col];
  }
  return filtered;
}

export async function supabaseUpsert(table, records) {
  const { url, serviceKey } = getSupabaseConfig();
  if (!records || records.length === 0) return { upserted: 0 };

  const allColumns = await getTableColumns();
  const tableCols = allColumns[table];
  if (!tableCols) {
    throw new Error(`Table "${table}" not found in Supabase schema — create it first`);
  }

  const filteredRecords = records.map((r) => filterRecord(r, tableCols));

  const res = await fetch(`${url}/${table}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(filteredRecords),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert to "${table}" failed (${res.status}): ${text}`);
  }
  return { upserted: records.length };
}

export async function supabaseSelect(table, columns = "*") {
  const { url, serviceKey } = getSupabaseConfig();
  const res = await fetch(`${url}/${table}?select=${encodeURIComponent(columns)}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase select from "${table}" failed (${res.status}): ${text}`);
  }
  return res.json();
}