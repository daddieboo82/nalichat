import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Heart, ListVideo, PictureInPicture2, Play, Upload, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";

function parseM3u(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const channels = [];
  let meta = null;
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
        // NaliVision currently plays direct browser-compatible media/HLS URLs.
        // Skip webpage links (for example YouTube/Twitch channel pages) that are not media streams.
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

// Public Free TV playlist of United States channels.
const FREE_TV_USA_PLAYLIST = "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_usa.m3u8";

export default function LiveTV() {
  const [channels, setChannels] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState(() => { try { return JSON.parse(localStorage.getItem("nalichat:live-tv:favorites") || "[]"); } catch { return []; } });
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem("nalichat:live-tv:recent") || "[]"); } catch { return []; } });
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  // Which list is on screen: the built-in Free TV list or an imported playlist.
  const sourceRef = useRef("free");

  useEffect(() => { try { localStorage.setItem("nalichat:live-tv:favorites", JSON.stringify(favorites)); } catch {} }, [favorites]);
  useEffect(() => { try { localStorage.setItem("nalichat:live-tv:recent", JSON.stringify(recent)); } catch {} }, [recent]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selected?.url) return undefined;
    const isHls = /\.m3u8(?:$|[?#])/i.test(selected.url);
    if (!isHls) return undefined;

    const url = selected.url;
    let disposed = false;
    let hls = null;
    let usingNative = false;

    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl") || video.canPlayType("application/x-mpegURL");
    if (nativeHls) {
      usingNative = true;
      video.src = url;
      video.load();
    } else if (selected.cors === false) {
      // The channel's host sends no CORS headers, so the fetch-based player
      // cannot read its playlists. Only browsers with native HLS can play it.
      setError("This channel only plays in Safari. Pick another channel, or open NaliChat in Safari.");
    } else {
      // The HLS player library is ~600 kB. Importing it with the page made the
      // first visit blank while that chunk downloaded, so it is fetched only
      // once a channel actually needs it — browsers with native HLS never pay
      // for it at all.
      import("hls.js")
        .then(({ default: Hls }) => {
          if (disposed) return;
          if (!Hls.isSupported()) {
            setError("This browser cannot play this HLS stream.");
            return;
          }
          hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(url));
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_event, data) => { if (data?.fatal) setError("This channel is offline right now. Pick another channel from the list."); });
        })
        .catch(() => { if (!disposed) setError("This channel could not be played in this browser."); });
    }

    return () => {
      disposed = true;
      if (hls) hls.destroy();
      if (usingNative) { video.removeAttribute("src"); video.load(); }
    };
  }, [selected?.url]);

  const chooseChannel = (channel) => {
    setError("");
    setSelected(channel);
    setRecent((items) => [channel, ...items.filter((item) => item.url !== channel.url)].slice(0, 12));
  };

  const playSelectedChannel = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setError("");
    } catch {
      setError("Press Play to start this channel. Your browser may require a direct playback gesture.");
    }
  };
  const toggleFavorite = (channel) => setFavorites((items) =>
    items.some((item) => item.url === channel.url) ? items.filter((item) => item.url !== channel.url) : [channel, ...items]
  );
  const filtered = useMemo(() => channels.filter((c) =>
    (c.name + " " + c.group).toLowerCase().includes(query.toLowerCase())
  ), [channels, query]);

  const loadText = (text, { selectFirst = true } = {}) => {
    const parsed = parseM3u(text);
    setChannels(parsed);
    if (selectFirst && parsed[0]) chooseChannel(parsed[0]);
    else if (!parsed.length) setSelected(null);
    setError(parsed.length ? "" : "No playable HTTP/HTTPS channels were found in this playlist.");
    return parsed;
  };

  const openPictureInPicture = async () => {
    const video = videoRef.current;
    if (!video || typeof video.requestPictureInPicture !== "function") {
      setError("Picture-in-picture is not available in this browser.");
      return;
    }
    try { await video.requestPictureInPicture(); setError(""); } catch { setError("Picture-in-picture could not be started."); }
  };

  // The public playlist still lists channels whose streams have gone dark, and
  // browsers cannot check most of those hosts directly. The probe runs
  // server-side and swaps in only the channels that play right now.
  const loadVerifiedChannels = async () => {
    try {
      const response = await base44.functions.invoke("liveTvChannels", {});
      const live = response?.data?.channels;
      if (sourceRef.current !== "free" || !Array.isArray(live) || !live.length) return;
      setChannels(live);
      setSelected((current) => (current && !live.some((channel) => channel.url === current.url) ? null : current));
    } catch {}
  };

  const loadFreeTv = async ({ selectFirst = true } = {}) => {
    setError("");
    setLoading(true);
    sourceRef.current = "free";
    try {
      const response = await fetch(FREE_TV_USA_PLAYLIST);
      if (!response.ok) throw new Error("Playlist unavailable");
      loadText(await response.text(), { selectFirst });
      loadVerifiedChannels();
    } catch {
      setError("Free TV could not be loaded right now. You can still import an M3U/M3U8 playlist.");
    } finally {
      setLoading(false);
    }
  };

  // The USA channel list is what the page is for, so load it on open. It is not
  // auto-selected: browsers block unprompted playback, and pulling a stream
  // would download the HLS player before the visitor asks for a channel.
  useEffect(() => {
    loadFreeTv({ selectFirst: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFile = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Playlist is too large. Choose an M3U/M3U8 file under 5 MB.");
      return;
    }
    sourceRef.current = "import";
    loadText(await file.text());
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 p-4 pb-24 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Inspiration break</p>
          <h1 className="font-heading text-3xl font-black">NaliVision</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Watch channels you are authorized to access, then jump back into your recording session.
          </p>
        </div>
        <Button asChild variant="outline"><Link to="/studio"><ArrowLeft className="mr-2 h-4 w-4" />Back to Studio</Link></Button>
      </div>

      <section className="rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => loadFreeTv()} disabled={loading}><Tv className="mr-2 h-4 w-4" />{loading ? "Loading…" : "Free TV"}</Button>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Import M3U</Button>
          <input ref={fileRef} className="hidden" type="file" accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl" onChange={(e) => loadFile(e.target.files?.[0])} />
          <Input className="min-w-52 flex-1" placeholder="Search channels" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Free TV loads the public USA channel list. Import playlists you own or have permission to use. NaliChat does not supply unauthorized TV streams.</p>
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-2xl border bg-black">
          {selected ? (
            <div>
              <video ref={videoRef} key={selected.url} src={/\.m3u8(?:$|[?#])/i.test(selected.url) ? undefined : selected.url} controls playsInline className="aspect-video w-full bg-black" onError={() => setError("This channel is offline right now. Pick another channel from the list.")} />
              <div className="bg-card p-4">
                <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">{selected.name}</h2><p className="text-xs text-muted-foreground">{selected.group}</p></div><div className="flex items-center gap-1"><Button type="button" variant="secondary" onClick={playSelectedChannel}><Play className="mr-2 h-4 w-4" />Play</Button><Button type="button" size="icon" variant="ghost" aria-label="Picture in picture" onClick={openPictureInPicture}><PictureInPicture2 className="h-5 w-5" /></Button><Button type="button" size="icon" variant="ghost" aria-label="Toggle favorite" onClick={() => toggleFavorite(selected)}><Heart className={`h-5 w-5 ${favorites.some((item) => item.url === selected.url) ? "fill-current text-primary" : ""}`} /></Button></div></div>
              </div>
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center p-8 text-center text-sm text-white/60">
              Choose a channel from the list, or import an authorized M3U playlist, to start your inspiration break.
            </div>
          )}
        </section>

        <aside className="max-h-[70vh] overflow-y-auto rounded-2xl border bg-card p-2">
          <div className="flex items-center gap-2 px-2 py-2 text-sm font-semibold"><ListVideo className="h-4 w-4" />Channels ({filtered.length})</div>
          {loading && <p className="px-2 pb-2 text-xs text-muted-foreground">Loading USA channels…</p>}
          {favorites.length > 0 && <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Favorites: {favorites.length} · Recent: {recent.length}</p>}
          {filtered.map((channel, index) => (
            <button key={channel.url + index} type="button" onClick={() => chooseChannel(channel)}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-secondary">
              {channel.logo ? <img src={channel.logo} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <Play className="h-5 w-5 text-primary" />}
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{channel.name}</span><span className="block truncate text-xs text-muted-foreground">{channel.group}</span></span>
            </button>
          ))}
        </aside>
      </div>
    </main>
  );
}

export { parseM3u };