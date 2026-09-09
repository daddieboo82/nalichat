import { secrets } from "base44:runtime";

export function getSupabaseConfig() {
  const url = secrets.get("SUPABASE_URL");
  const serviceKey = secrets.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets must be set in the dashboard Secrets page");
  }
  return { url, serviceKey };
}

export async function supabaseUpsert(table, records) {
  const { url, serviceKey } = getSupabaseConfig();
  if (!records || records.length === 0) return { upserted: 0 };

  const res = await fetch(`${url}/${table}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(records),
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
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase select from "${table}" failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function supabaseDeleteAll(table) {
  const { url, serviceKey } = getSupabaseConfig();
  const res = await fetch(`${url}/${table}?id=neq.0`, {
    method: "DELETE",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase delete from "${table}" failed (${res.status}): ${text}`);
  }
  return { deleted: true };
}