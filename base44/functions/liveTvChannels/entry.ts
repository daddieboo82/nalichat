import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// The public Free TV USA playlist lists every channel it has ever carried,
// including streams that have gone dark. Browsers cannot check most of these
// hosts themselves (the servers send no CORS headers), so the page asks this
// function: it fetches each stream's playlists and newest segment server-side
// and returns only the channels that actually play right now.
const PLAYLIST_URL = "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_usa.m3u8";
const ORIGIN = "https://nalichat.org";
const CACHE_MS = 10 * 60 * 1000;
const CONCURRENCY = 6;

type Channel = { name: string; logo: string; group: string; url: string; cors: boolean };

let cache: { at: number; channels: Channel[] } = { at: 0, channels: [] };

function parsePlaylist(text: string): Omit<Channel, "cors">[] {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const channels: Omit<Channel, "cors">[] = [];
  let meta: { name: string; logo: string; group: string } | null = null;
  for (const line of lines) {
    if (line.startsWith("#EXTINF:")) {
      const comma = line.lastIndexOf(",");
      const attrs = line.slice(0, comma);
      meta = {
        name: comma >= 0 ? line.slice(comma + 1).trim() : "Untitled channel",
        logo: attrs.match(/tvg-logo="([^"]*)"/i)?.[1] || "",
        group: attrs.match(/group-title="([^"]*)"/i)?.[1] || "Other",
      };
    } else if (!line.startsWith("#") && meta) {
      try {
        const url = new URL(line);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported protocol");
        const host = url.hostname.toLowerCase();
        const isKnownWebPage = host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be" || host === "twitch.tv" || host.endsWith(".twitch.tv");
        if (isKnownWebPage) throw new Error("Webpage URL is not a direct stream");
        channels.push({ ...meta, url: url.href });
      } catch {}
      meta = null;
    }
  }
  return channels;
}

async function fetchPlaylist(url: string) {
  const response = await fetch(url, {
    headers: { Origin: ORIGIN },
    redirect: "follow",
    signal: AbortSignal.timeout(9000),
  });
  const text = await response.text();
  return {
    ok: response.ok,
    text,
    // Whether a browser on another origin may read this host's playlists.
    cors: Boolean(response.headers.get("access-control-allow-origin")),
  };
}

function isPlaylist(text: string) {
  return text.trimStart().startsWith("#EXTM3U");
}

function mediaEntries(text: string) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
}

function absolute(base: string, ref: string) {
  try {
    return new URL(ref, base).href;
  } catch {
    return "";
  }
}

async function probe(url: string): Promise<{ live: boolean; cors: boolean }> {
  try {
    if (!/\.m3u8(?:$|[?#])/i.test(url)) {
      // A direct media file: reachable headers are enough to list it.
      const head = await fetch(url, { headers: { Origin: ORIGIN }, signal: AbortSignal.timeout(8000) });
      const ok = head.ok;
      try { await head.body?.cancel(); } catch {}
      return { live: ok, cors: Boolean(head.headers.get("access-control-allow-origin")) };
    }

    const master = await fetchPlaylist(url);
    if (!master.ok || !isPlaylist(master.text)) return { live: false, cors: master.cors };
    const variants = mediaEntries(master.text);
    if (!variants.length) return { live: false, cors: master.cors };

    const variantUrl = absolute(url, variants[0]);
    if (!variantUrl) return { live: false, cors: master.cors };
    const variant = await fetchPlaylist(variantUrl);
    if (!variant.ok || !isPlaylist(variant.text)) return { live: false, cors: master.cors };

    const segments = mediaEntries(variant.text);
    if (!segments.length) return { live: false, cors: master.cors };

    // The newest segment is the real test: stale playlists still answer 200
    // while every segment they point at has been deleted.
    const segmentUrl = absolute(variantUrl, segments[segments.length - 1]);
    if (!segmentUrl) return { live: false, cors: master.cors };
    const segment = await fetch(segmentUrl, { headers: { Origin: ORIGIN }, signal: AbortSignal.timeout(9000) });
    const ok = segment.ok;
    try { await segment.body?.cancel(); } catch {}
    return { live: ok, cors: master.cors };
  } catch {
    return { live: false, cors: false };
  }
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (cache.channels.length && Date.now() - cache.at < CACHE_MS) {
      return Response.json({ channels: cache.channels, checkedAt: cache.at, cached: true });
    }

    const playlist = await fetchPlaylist(PLAYLIST_URL);
    if (!playlist.ok) return Response.json({ error: "Playlist unavailable" }, { status: 502 });

    const entries = parsePlaylist(playlist.text);
    const live: Channel[] = [];
    for (let index = 0; index < entries.length; index += CONCURRENCY) {
      const batch = entries.slice(index, index + CONCURRENCY);
      const probed = await Promise.allSettled(batch.map((channel) => probe(channel.url)));
      probed.forEach((result, offset) => {
        if (result.status === "fulfilled" && result.value.live) {
          live.push({ ...batch[offset], cors: result.value.cors });
        }
      });
    }

    cache = { at: Date.now(), channels: live };
    return Response.json({ channels: live, checkedAt: cache.at, cached: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}