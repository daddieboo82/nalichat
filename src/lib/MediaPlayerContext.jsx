import { createContext, useContext, useState, useRef, useEffect } from "react";

const MediaPlayerContext = createContext();

export function MediaPlayerProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const audioRef = useRef(null);

  // Create or reuse audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => skipNext();
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, []);

  const playTrack = (track, newQueue = [track]) => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTrack(track);
    setQueue(newQueue);
    setCurrentIndex(0);
    setCurrentTime(0);
    audio.src = track.file_url;
    audio.play().catch(err => console.warn("Autoplay blocked:", err.message));
    setIsPlaying(true);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(err => console.warn("Play failed:", err.message));
      setIsPlaying(true);
    }
  };

  const seek = (time) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(duration, time));
  };

  const skipNext = () => {
    if (queue.length === 0) return;
    const nextIndex = (currentIndex + 1) % queue.length;
    setCurrentIndex(nextIndex);
    const nextTrack = queue[nextIndex];
    setCurrentTrack(nextTrack);
    setCurrentTime(0);
    const audio = audioRef.current;
    if (audio) {
      audio.src = nextTrack.file_url;
      audio.play().catch(err => console.warn("Play failed:", err.message));
    }
  };

  const skipPrev = () => {
    if (queue.length === 0) return;
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    setCurrentIndex(prevIndex);
    const prevTrack = queue[prevIndex];
    setCurrentTrack(prevTrack);
    setCurrentTime(0);
    const audio = audioRef.current;
    if (audio) {
      audio.src = prevTrack.file_url;
      audio.play().catch(err => console.warn("Play failed:", err.message));
    }
  };

  const addToQueue = (tracks) => {
    const tracksArray = Array.isArray(tracks) ? tracks : [tracks];
    setQueue(prev => [...prev, ...tracksArray]);
  };

  const clearQueue = () => {
    setCurrentTrack(null);
    setQueue([]);
    setCurrentIndex(0);
    setCurrentTime(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  };

  const value = {
    currentTrack,
    queue,
    isPlaying,
    currentTime,
    duration,
    volume,
    setVolume,
    playTrack,
    togglePlay,
    seek,
    skipNext,
    skipPrev,
    addToQueue,
    clearQueue,
  };

  return (
    <MediaPlayerContext.Provider value={value}>
      {children}
    </MediaPlayerContext.Provider>
  );
}

export function useMediaPlayer() {
  const context = useContext(MediaPlayerContext);
  if (!context) {
    throw new Error("useMediaPlayer must be used within MediaPlayerProvider");
  }
  return context;
}