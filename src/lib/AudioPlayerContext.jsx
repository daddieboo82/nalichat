import React, { createContext, useContext, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';

const AudioPlayerContext = createContext();
// Playback position updates fire ~4x/second. Keeping them in the main context
// re-rendered every consumer (AppLayout and therefore the whole routed page)
// on every tick, so they live in their own context that only the player UI reads.
const AudioPlayerTimeContext = createContext({ currentTime: 0, duration: 0 });

export function AudioPlayerProvider({ children }) {
  const { user } = useAuth();
  const lastUserIdRef = useRef(user?.id || null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef(null);
  
  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.playsInline = true;
    audioRef.current.setAttribute('playsinline', '');
    audioRef.current.setAttribute('webkit-playsinline', '');
    audioRef.current.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
    audioRef.current.disablePictureInPicture = true;
  }

  useEffect(() => {
    const audio = audioRef.current;
    
    const setAudioData = () => {
      setDuration(audio.duration);
    };

    const setAudioTime = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);



  useEffect(() => {
    if (audioRef.current && !isNaN(volume)) {
      try {
        audioRef.current.volume = Math.max(0, Math.min(1, volume));
      } catch (e) {
        console.error("Error setting volume:", e);
      }
    }
  }, [volume]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    try {
      if (audioRef.current.paused) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(e => {
          console.error("Playback failed:", e);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    } catch (e) {
      console.error("Toggle play error:", e);
      setIsPlaying(false);
    }
  }, []);

  const seek = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const playTrack = useCallback((track) => {
    setCurrentTrack(prev => {
      if (prev?.id === track.id) {
        togglePlay();
        return prev;
      }
      if (audioRef.current && track?.file_url) {
        try {
          audioRef.current.src = track.file_url;
          audioRef.current.load();
          audioRef.current.play().then(() => {
            setIsPlaying(true);
          }).catch(e => {
            console.warn("Autoplay blocked:", e.message);
            setIsPlaying(false);
          });
        } catch (e) {
          console.error("Audio src error:", e);
        }
      }
      return track;
    });
  }, [togglePlay]);

  const closePlayer = useCallback(() => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src'); // Clean up the source
        audioRef.current.load();
      }
    } catch (e) {
      console.error("Error closing player:", e);
    }
    setCurrentTrack(null);
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    const nextUserId = user?.id || null;
    if (lastUserIdRef.current !== nextUserId) {
      closePlayer();
      setCurrentTime(0);
      setDuration(0);
    }
    lastUserIdRef.current = nextUserId;
  }, [user?.id, closePlayer]);

  const value = useMemo(() => ({
    currentTrack,
    isPlaying,
    volume,
    setVolume,
    togglePlay,
    seek,
    playTrack,
    closePlayer,
  }), [currentTrack, isPlaying, volume, togglePlay, seek, playTrack, closePlayer]);

  const timeValue = useMemo(() => ({ currentTime, duration }), [currentTime, duration]);

  return (
    <AudioPlayerContext.Provider value={value}>
      <AudioPlayerTimeContext.Provider value={timeValue}>
        {children}
      </AudioPlayerTimeContext.Provider>
    </AudioPlayerContext.Provider>
  );
}

export const useAudioPlayer = () => useContext(AudioPlayerContext);
export const useAudioPlayerTime = () => useContext(AudioPlayerTimeContext);