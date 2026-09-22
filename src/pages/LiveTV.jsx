import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { Link } from "react-router-dom";
import { ArrowLeft, Heart, ListVideo, PictureInPicture2, Play, Upload, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

export default function LiveTV() {
  const [channels, setChannels] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState(() => { try { return JSON.parse(localStorage.getItem("nalichat:live-tv:favorites") || "[]"); } catch { return []; } });
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem("nalichat:live-tv:recent") || "[]"); } catch { return []; } });
  const fileRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => { try { localStorage.setItem("nalichat:live-tv:favorites", JSON.stringify(favorites)); } catch {} }, [favorites]);
  useEffect(() => { try { localStorage.setItem("nalichat:live-tv:recent", JSON.stringify(recent)); } catch {} }, [recent]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selected?.url) return undefined;
    const isHls = /\.m3u8(?:$|[?#])/i.test(selected.url);
    if (!isHls || video.canPlayType("application/vnd.apple.mpegurl")) return undefined;
    if (!Hls.isSupported()) { setError("This browser cannot play this HLS stream."); return undefined; }
    const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
    hls.loadSource(selected.url);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_event, data) => { if (data?.fatal) setError("This channel could not be played. Check that the stream is online and permits browser playback."); });
    return () => hls.destroy();
  }, [selected?.url]);

  const chooseChannel = (channel) => {
    setSelected(channel);
    setRecent((items) => [channel, ...items.filter((item) => item.url !== channel.url)].slice(0, 12));
  };
  const toggleFavorite = (channel) => setFavorites((items) =>
    items.some((item) => item.url === channel.url) ? items.filter((item) => item.url !== channel.url) : [channel, ...items]
  );
  const filtered = useMemo(() => channels.filter((c) =>
    (c.name + " " + c.group).toLowerCase().includes(query.toLowerCase())
  ), [channels, query]);

  const loadText = (text) => {
    const parsed = parseM3u(text);
    setChannels(parsed);
    if (parsed[0]) chooseChannel(parsed[0]); else setSelected(null);
    setError(parsed.length ? "" : "No playable HTTP/HTTPS channels were found in this playlist.");
  };

  const openPictureInPicture = async () => {
    const video = videoRef.current;
    if (!video || typeof video.requestPictureInPicture !== "function") {
      setError("Picture-in-picture is not available in this browser.");
      return;
    }
    try { await video.requestPictureInPicture(); setError(""); } catch { setError("Picture-in-picture could not be started."); }
  };

  const loadFreeTv = async () => {
    setError("");
    try {
      const response = await fetch("https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8");
      if (!response.ok) throw new Error("Playlist unavailable");
      loadText(await response.text());
    } catch {
      setError("Free TV could not be loaded right now. You can still import an M3U/M3U8 playlist.");
    }
  };

  const loadFile = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Playlist is too large. Choose an M3U/M3U8 file under 5 MB.");
      return;
    }
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
          <Button type="button" onClick={loadFreeTv}><Tv className="mr-2 h-4 w-4" />Free TV</Button>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Import M3U</Button>
          <input ref={fileRef} className="hidden" type="file" accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl" onChange={(e) => loadFile(e.target.files?.[0])} />
          <Input className="min-w-52 flex-1" placeholder="Search imported channels" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Import playlists you own or have permission to use. NaliChat does not supply unauthorized TV streams.</p>
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-2xl border bg-black">
          {selected ? (
            <div>
              <video ref={videoRef} key={selected.url} src={/\.m3u8(?:$|[?#])/i.test(selected.url) ? undefined : selected.url} controls playsInline className="aspect-video w-full bg-black" onError={() => setError("This channel could not play in the browser. Some sources require a compatible CORS-enabled provider.")} />
              <div className="bg-card p-4">
                <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">{selected.name}</h2><p className="text-xs text-muted-foreground">{selected.group}</p></div><div className="flex items-center gap-1"><Button type="button" size="icon" variant="ghost" aria-label="Picture in picture" onClick={openPictureInPicture}><PictureInPicture2 className="h-5 w-5" /></Button><Button type="button" size="icon" variant="ghost" aria-label="Toggle favorite" onClick={() => toggleFavorite(selected)}><Heart className={`h-5 w-5 ${favorites.some((item) => item.url === selected.url) ? "fill-current text-primary" : ""}`} /></Button></div></div>
              </div>
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center p-8 text-center text-sm text-white/60">
              Choose Free TV or import an authorized M3U playlist to start your inspiration break.
            </div>
          )}
        </section>

        <aside className="max-h-[70vh] overflow-y-auto rounded-2xl border bg-card p-2">
          <div className="flex items-center gap-2 px-2 py-2 text-sm font-semibold"><ListVideo className="h-4 w-4" />Channels ({filtered.length})</div>
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
