import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Picks 3 public-domain feature films from the Internet Archive each day and
// resolves their real direct MP4 stream URLs. Auto-rotates once per UTC day.
// 100% legal — Internet Archive hosts public-domain films and serves direct MP4s.

const todayStr = () => new Date().toISOString().slice(0, 10);

// Find a playable MP4 file inside an Internet Archive item.
async function resolveStream(identifier) {
  try {
    const res = await fetch(`https://archive.org/metadata/${identifier}`);
    if (!res.ok) return null;
    const meta = await res.json();
    const files = meta?.files || [];
    // Prefer h.264 mp4, then any mp4, then ogv.
    const mp4 = files.find((f) => /\.mp4$/i.test(f.name) && /h\.?264|512kb|mpeg4/i.test(f.format || "")) ||
                files.find((f) => /\.mp4$/i.test(f.name)) ||
                files.find((f) => /\.ogv$/i.test(f.name));
    if (!mp4) return null;
    return {
      stream_url: `https://archive.org/download/${identifier}/${encodeURIComponent(mp4.name)}`,
      runtime: mp4.length ? formatRuntime(mp4.length) : undefined,
      meta_title: meta?.metadata?.title,
      meta_year: meta?.metadata?.year || (meta?.metadata?.date ? String(meta.metadata.date).slice(0, 4) : undefined),
      meta_desc: stripHtml(meta?.metadata?.description),
    };
  } catch {
    return null;
  }
}

function formatRuntime(seconds) {
  const s = parseFloat(seconds);
  if (!s || isNaN(s)) return undefined;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function stripHtml(str) {
  if (!str) return "";
  const text = Array.isArray(str) ? str.join(" ") : String(str);
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 320);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const date = todayStr();

    const { force = false } = await req.json().catch(() => ({}));

    // Already have today's picks? Return them (unless forced).
    const existing = await base44.asServiceRole.entities.DailyMovie.filter({ pick_date: date }, "slot", 3);
    if (!force && existing.length >= 3) {
      return Response.json({ movies: existing, cached: true });
    }

    // Ask AI to choose 3 great public-domain films likely on the Internet Archive,
    // and give us a likely archive.org identifier for each.
    const ai = await base44.integrations.Core.InvokeLLM({
      prompt: `You are curating 3 outstanding PUBLIC DOMAIN feature films that are freely and legally available on the Internet Archive (archive.org). Pick well-loved classics across different genres (e.g. film noir, sci-fi, horror, comedy, drama). Vary the picks — be creative, this rotates daily.

For each film provide:
- title (exact)
- year
- a one-sentence enticing description
- genre
- rating out of 10
- archive_id: the most likely archive.org item identifier for the FULL FILM (lowercase, words separated by underscores, e.g. "night_of_the_living_dead", "Plan_9_from_Outer_Space_1959", "Charade19631280"). Use real, known archive.org identifiers for famous public-domain films.

Today's date is ${date} — choose a fresh, interesting trio.`,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          films: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                year: { type: "string" },
                description: { type: "string" },
                genre: { type: "string" },
                rating: { type: "number" },
                archive_id: { type: "string" },
              },
              required: ["title", "archive_id"],
            },
          },
        },
        required: ["films"],
      },
    });

    const candidates = ai?.films || [];
    const resolved = [];

    for (const film of candidates) {
      if (resolved.length >= 3) break;
      let stream = await resolveStream(film.archive_id);

      // Fallback: search the Internet Archive directly by title within movies.
      if (!stream) {
        try {
          const q = encodeURIComponent(`title:(${film.title}) AND mediatype:(movies)`);
          const sres = await fetch(`https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&rows=3&output=json`);
          const sjson = await sres.json();
          const ids = (sjson?.response?.docs || []).map((d) => d.identifier);
          for (const id of ids) {
            stream = await resolveStream(id);
            if (stream) { film.archive_id = id; break; }
          }
        } catch { /* ignore */ }
      }

      if (!stream) continue;

      const id = film.archive_id;
      resolved.push({
        title: film.title || stream.meta_title || "Untitled",
        year: film.year || stream.meta_year || "",
        description: film.description || stream.meta_desc || "",
        genre: film.genre || "",
        rating: typeof film.rating === "number" ? film.rating : undefined,
        runtime: stream.runtime,
        stream_url: stream.stream_url,
        archive_id: id,
        poster_url: `https://archive.org/services/img/${id}`,
        backdrop_url: `https://archive.org/services/img/${id}`,
        pick_date: date,
        slot: resolved.length + 1,
      });
    }

    if (resolved.length === 0) {
      return Response.json({ error: "Could not resolve any streams today", movies: [] }, { status: 500 });
    }

    // Clear today's prior picks then store the new trio.
    for (const old of existing) {
      await base44.asServiceRole.entities.DailyMovie.delete(old.id).catch(() => {});
    }
    const created = await base44.asServiceRole.entities.DailyMovie.bulkCreate(resolved);

    return Response.json({ movies: created, cached: false });
  } catch (error) {
    console.error("refreshDailyMovies error:", error);
    return Response.json({ error: error.message, movies: [] }, { status: 500 });
  }
});