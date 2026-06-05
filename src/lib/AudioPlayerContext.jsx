import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

const AudioPlayerContext = createContext();

export function AudioPlayerProvider({ children }) {
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

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleEnded);
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

  const togglePlay = () => {
    if (!audioRef.current) return;
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(e => {
          console.error("Playback failed:", e);
          setIsPlaying(false);
        });
      }
    } catch (e) {
      console.error("Toggle play error:", e);
      setIsPlaying(false);
    }
  };

  const seek = (time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const playTrack = (track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      setCurrentTrack(track);
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
    }
  };

  return (
    <AudioPlayerContext.Provider value={{
      currentTrack,
      isPlaying,
      currentTime,
      duration,
      volume,
      setVolume,
      togglePlay,
      seek,
      playTrack,
      closePlayer: () => {
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
      }
    }}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export const useAudioPlayer = () => useContext(AudioPlayerContext);