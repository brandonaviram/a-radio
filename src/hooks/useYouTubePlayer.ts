import { useEffect, useReducer, useRef, useCallback } from 'react';

// YouTube IFrame API types
interface YTPlayerOptions {
  height?: string;
  width?: string;
  videoId?: string;
  playerVars?: {
    autoplay?: 0 | 1;
    controls?: 0 | 1;
    disablekb?: 0 | 1;
    enablejsapi?: 0 | 1;
    modestbranding?: 0 | 1;
    playsinline?: 0 | 1;
    rel?: 0 | 1;
  };
  events?: {
    onReady?: (event: YTPlayerEvent) => void;
    onStateChange?: (event: YTStateChangeEvent) => void;
    onError?: (event: YTErrorEvent) => void;
  };
}

interface YTPlayerEvent {
  target: YTPlayer;
}

interface YTStateChangeEvent extends YTPlayerEvent {
  data: number;
}

interface YTErrorEvent extends YTPlayerEvent {
  data: number;
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getVolume(): number;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  loadVideoById(videoId: string): void;
  destroy(): void;
}

interface YTApi {
  Player: new (elementId: string, config: YTPlayerOptions) => YTPlayer;
  PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

declare global {
  interface Window {
    YT: YTApi;
    onYouTubeIframeAPIReady: () => void;
  }
}

// Player state
export type PlayerStatus = 'idle' | 'scanning' | 'transmitting' | 'halted' | 'signal-lost';

export interface PlayerState {
  isReady: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number; // 0-100
  currentTime: number;
  duration: number;
  videoId: string | null;
  status: PlayerStatus;
}

// Player controls
export interface PlayerControls {
  loadVideo: (videoId: string) => void;
  togglePlayPause: () => void;
  seek: (seconds: number) => void;
  seekTo: (timestamp: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  getCurrentTime: () => number;
}

// State actions
type PlayerAction =
  | { type: 'SET_READY'; payload: boolean }
  | { type: 'SET_PLAYING'; payload: boolean }
  | { type: 'SET_MUTED'; payload: boolean }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'SET_CURRENT_TIME'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_VIDEO_ID'; payload: string | null }
  | { type: 'SET_STATUS'; payload: PlayerStatus }
  | { type: 'UPDATE_STATE'; payload: Partial<PlayerState> };

// Initial state
const initialState: PlayerState = {
  isReady: false,
  isPlaying: false,
  isMuted: false,
  volume: 100,
  currentTime: 0,
  duration: 0,
  videoId: null,
  status: 'idle',
};

// Reducer
function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'SET_READY':
      return { ...state, isReady: action.payload };
    case 'SET_PLAYING':
      return {
        ...state,
        isPlaying: action.payload,
        status: action.payload ? 'transmitting' : 'halted'
      };
    case 'SET_MUTED':
      return { ...state, isMuted: action.payload };
    case 'SET_VOLUME':
      return { ...state, volume: action.payload };
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload };
    case 'SET_DURATION':
      return { ...state, duration: action.payload };
    case 'SET_VIDEO_ID':
      return { ...state, videoId: action.payload };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'UPDATE_STATE':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// Helper function to extract video ID from URL
export function extractVideoId(url: string): string | null {
  if (!url) return null;

  // Already a video ID (11 characters)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }

  // youtube.com/watch?v=ID
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  // youtu.be/ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // youtube.com/embed/ID
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  // youtube.com/v/ID
  const vMatch = url.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/);
  if (vMatch) return vMatch[1];

  return null;
}

// Load YouTube IFrame API
function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      resolve();
    };
  });
}

export function useYouTubePlayer(): [PlayerState, PlayerControls] {
  const [state, dispatch] = useReducer(playerReducer, initialState);
  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timeUpdateIntervalRef = useRef<number | null>(null);

  // Initialize YouTube player
  useEffect(() => {
    let mounted = true;

    const initPlayer = async () => {
      await loadYouTubeAPI();

      if (!mounted) return;

      // Create hidden container
      const container = document.createElement('div');
      container.id = 'youtube-player-container';
      container.style.position = 'absolute';
      container.style.width = '0';
      container.style.height = '0';
      container.style.overflow = 'hidden';
      container.style.pointerEvents = 'none';
      document.body.appendChild(container);
      containerRef.current = container;

      // Create player div
      const playerDiv = document.createElement('div');
      playerDiv.id = 'youtube-player';
      container.appendChild(playerDiv);

      // Initialize player
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '0',
        width: '0',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: handleReady,
          onStateChange: handleStateChange,
          onError: handleError,
        },
      });
    };

    initPlayer();

    return () => {
      mounted = false;
      if (timeUpdateIntervalRef.current) {
        window.clearInterval(timeUpdateIntervalRef.current);
      }
      if (playerRef.current) {
        playerRef.current.destroy();
      }
      if (containerRef.current) {
        containerRef.current.remove();
      }
    };
  }, []);

  // Handle player ready
  const handleReady = useCallback(() => {
    dispatch({ type: 'SET_READY', payload: true });

    if (playerRef.current) {
      const volume = playerRef.current.getVolume();
      const isMuted = playerRef.current.isMuted();
      dispatch({ type: 'SET_VOLUME', payload: volume });
      dispatch({ type: 'SET_MUTED', payload: isMuted });
    }
  }, []);

  // Handle state change
  const handleStateChange = useCallback((event: YTStateChangeEvent) => {
    const playerState = event.data;

    switch (playerState) {
      case window.YT.PlayerState.PLAYING:
        dispatch({ type: 'SET_PLAYING', payload: true });
        startTimeUpdate();
        break;
      case window.YT.PlayerState.PAUSED:
        dispatch({ type: 'SET_PLAYING', payload: false });
        stopTimeUpdate();
        break;
      case window.YT.PlayerState.ENDED:
        dispatch({ type: 'SET_PLAYING', payload: false });
        dispatch({ type: 'SET_STATUS', payload: 'halted' });
        stopTimeUpdate();
        break;
      case window.YT.PlayerState.BUFFERING:
        dispatch({ type: 'SET_STATUS', payload: 'scanning' });
        break;
      case window.YT.PlayerState.CUED:
        const duration = playerRef.current?.getDuration() || 0;
        dispatch({ type: 'SET_DURATION', payload: duration });
        break;
    }
  }, []);

  // Handle error
  const handleError = useCallback(() => {
    dispatch({ type: 'SET_STATUS', payload: 'signal-lost' });
    dispatch({ type: 'SET_PLAYING', payload: false });
    stopTimeUpdate();
  }, []);

  // Start time update interval
  const startTimeUpdate = () => {
    if (timeUpdateIntervalRef.current) return;

    timeUpdateIntervalRef.current = window.setInterval(() => {
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        dispatch({ type: 'SET_CURRENT_TIME', payload: currentTime });
        dispatch({ type: 'SET_DURATION', payload: duration });
      }
    }, 500);
  };

  // Stop time update interval
  const stopTimeUpdate = () => {
    if (timeUpdateIntervalRef.current) {
      window.clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }
  };

  // Controls
  const loadVideo = useCallback((videoId: string) => {
    if (!playerRef.current || !state.isReady) return;

    const id = extractVideoId(videoId);
    if (!id) return;

    dispatch({ type: 'SET_VIDEO_ID', payload: id });
    dispatch({ type: 'SET_STATUS', payload: 'scanning' });
    playerRef.current.loadVideoById(id);
  }, [state.isReady]);

  const togglePlayPause = useCallback(() => {
    if (!playerRef.current || !state.isReady) return;

    if (state.isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, [state.isReady, state.isPlaying]);

  const seek = useCallback((seconds: number) => {
    if (!playerRef.current || !state.isReady) return;

    const currentTime = playerRef.current.getCurrentTime();
    const newTime = Math.max(0, currentTime + seconds);
    playerRef.current.seekTo(newTime, true);
  }, [state.isReady]);

  const seekTo = useCallback((timestamp: number) => {
    if (!playerRef.current || !state.isReady) return;

    playerRef.current.seekTo(timestamp, true);
  }, [state.isReady]);

  const setVolume = useCallback((volume: number) => {
    if (!playerRef.current || !state.isReady) return;

    const clampedVolume = Math.max(0, Math.min(100, volume));
    playerRef.current.setVolume(clampedVolume);
    dispatch({ type: 'SET_VOLUME', payload: clampedVolume });
  }, [state.isReady]);

  const toggleMute = useCallback(() => {
    if (!playerRef.current || !state.isReady) return;

    const isMuted = playerRef.current.isMuted();
    if (isMuted) {
      playerRef.current.unMute();
      dispatch({ type: 'SET_MUTED', payload: false });
    } else {
      playerRef.current.mute();
      dispatch({ type: 'SET_MUTED', payload: true });
    }
  }, [state.isReady]);

  const getCurrentTime = useCallback(() => {
    if (!playerRef.current || !state.isReady) return 0;
    return playerRef.current.getCurrentTime();
  }, [state.isReady]);

  const controls: PlayerControls = {
    loadVideo,
    togglePlayPause,
    seek,
    seekTo,
    setVolume,
    toggleMute,
    getCurrentTime,
  };

  return [state, controls];
}
