import { useEffect, useReducer, useRef, useCallback } from 'react';
import {
  PlayerState,
  PlayerControls,
  createInitialState,
  playerReducer,
} from '../types/player';

// SoundCloud Widget API types
interface SCWidget {
  play(): void;
  pause(): void;
  toggle(): void;
  seekTo(milliseconds: number): void;
  setVolume(volume: number): void; // 0-100
  getVolume(callback: (volume: number) => void): void;
  getPosition(callback: (position: number) => void): void;
  getDuration(callback: (duration: number) => void): void;
  isPaused(callback: (paused: boolean) => void): void;
  getCurrentSound(callback: (sound: SCSound | null) => void): void;
  load(url: string, options?: SCLoadOptions): void;
  bind(event: string, callback: (data?: SCEventData) => void): void;
  unbind(event: string): void;
}

interface SCSound {
  title: string;
  duration: number; // milliseconds
  artwork_url: string | null;
  user: {
    username: string;
    avatar_url: string;
  };
}

interface SCLoadOptions {
  auto_play?: boolean;
  show_artwork?: boolean;
  show_comments?: boolean;
  show_playcount?: boolean;
  show_user?: boolean;
  buying?: boolean;
  liking?: boolean;
  download?: boolean;
  sharing?: boolean;
}

interface SCEventData {
  currentPosition?: number;
  relativePosition?: number;
  loadProgress?: number;
}

interface SCWidgetApi {
  Widget: (iframe: HTMLIFrameElement | string) => SCWidget;
  Events: {
    READY: string;
    PLAY: string;
    PAUSE: string;
    FINISH: string;
    SEEK: string;
    PLAY_PROGRESS: string;
    LOAD_PROGRESS: string;
    ERROR: string;
  };
}

declare global {
  interface Window {
    SC: SCWidgetApi;
  }
}

// Load SoundCloud Widget API script
function loadSoundCloudAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded and ready
    if (window.SC && window.SC.Widget) {
      resolve();
      return;
    }

    // Check if script is already loading
    const existingScript = document.querySelector('script[src*="w.soundcloud.com/player/api.js"]');
    if (existingScript) {
      // Wait for it to load
      const checkReady = setInterval(() => {
        if (window.SC && window.SC.Widget) {
          clearInterval(checkReady);
          resolve();
        }
      }, 50);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkReady);
        reject(new Error('SoundCloud API load timeout'));
      }, 5000);
      return;
    }

    // Load the script
    const script = document.createElement('script');
    script.src = 'https://w.soundcloud.com/player/api.js';
    script.async = true;

    script.onload = () => {
      // Poll until SC.Widget is available
      const waitForWidget = setInterval(() => {
        if (window.SC && window.SC.Widget) {
          clearInterval(waitForWidget);
          resolve();
        }
      }, 50);

      // Timeout safety
      setTimeout(() => {
        clearInterval(waitForWidget);
        if (window.SC && window.SC.Widget) {
          resolve();
        } else {
          reject(new Error('SC.Widget not available'));
        }
      }, 2000);
    };

    script.onerror = () => reject(new Error('Failed to load SoundCloud API'));
    document.body.appendChild(script);
  });
}

export function useSoundCloudPlayer(): [PlayerState, PlayerControls] {
  const [state, dispatch] = useReducer(playerReducer, createInitialState());
  const widgetRef = useRef<SCWidget | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timeUpdateIntervalRef = useRef<number | null>(null);
  const currentVolumeRef = useRef<number>(100);
  const pendingLoadRef = useRef<{ url: string; startTime?: number } | null>(null);

  // Initialize SoundCloud player
  useEffect(() => {
    let mounted = true;

    const initPlayer = async () => {
      try {
        await loadSoundCloudAPI();

        if (!mounted) return;

        // Create hidden container
        const container = document.createElement('div');
        container.id = 'soundcloud-player-container';
        container.style.position = 'absolute';
        container.style.width = '1px';
        container.style.height = '1px';
        container.style.overflow = 'hidden';
        container.style.opacity = '0';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);
        containerRef.current = container;

        // Create iframe for SoundCloud widget
        // Use a silent/short track as placeholder to avoid 404 on empty URL
        const iframe = document.createElement('iframe');
        iframe.id = 'soundcloud-widget';
        iframe.allow = 'autoplay';
        iframe.width = '100%';
        iframe.height = '166';
        // Use a real track URL to initialize (will be replaced when loading)
        iframe.src = 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/293&auto_play=false';
        container.appendChild(iframe);
        iframeRef.current = iframe;

        // Wait for iframe to load before initializing widget
        iframe.onload = () => {
          if (!mounted) return;

          // SC API should already be loaded by loadSoundCloudAPI()
          if (!window.SC || !window.SC.Widget) {
            console.error('[SoundCloud] API not ready after iframe load');
            return;
          }

          const widget = window.SC.Widget(iframe);
          widgetRef.current = widget;

          // Bind events
          widget.bind(window.SC.Events.READY, () => {
            dispatch({ type: 'SET_READY', payload: true });
          });

          widget.bind(window.SC.Events.PLAY, () => {
            dispatch({ type: 'SET_PLAYING', payload: true });
            dispatch({ type: 'SET_STATUS', payload: 'transmitting' });
            startTimeUpdate();
          });

          widget.bind(window.SC.Events.PAUSE, () => {
            dispatch({ type: 'SET_PLAYING', payload: false });
            dispatch({ type: 'SET_STATUS', payload: 'idle' });
            stopTimeUpdate();
          });

          // PLAY_PROGRESS fires during playback with position data
          widget.bind(window.SC.Events.PLAY_PROGRESS, (data) => {
            if (data?.currentPosition !== undefined) {
              dispatch({ type: 'SET_CURRENT_TIME', payload: data.currentPosition / 1000 });
            }
          });

          widget.bind(window.SC.Events.FINISH, () => {
            dispatch({ type: 'SET_PLAYING', payload: false });
            dispatch({ type: 'SET_STATUS', payload: 'halted' });
            stopTimeUpdate();
          });

          widget.bind(window.SC.Events.ERROR, () => {
            dispatch({ type: 'SET_STATUS', payload: 'signal-lost' });
            dispatch({ type: 'SET_PLAYING', payload: false });
            stopTimeUpdate();
          });

          // Mark as ready
          dispatch({ type: 'SET_READY', payload: true });
          console.log('[SoundCloud] Widget initialized');

          // Check for pending load
          if (pendingLoadRef.current) {
            console.log('[SoundCloud] Loading pending track:', pendingLoadRef.current.url);
            const { url, startTime } = pendingLoadRef.current;
            pendingLoadRef.current = null;

            dispatch({ type: 'SET_VIDEO_ID', payload: url });
            dispatch({ type: 'SET_STATUS', payload: 'scanning' });
            widget.load(url, {
              auto_play: false,
              show_artwork: true,
              show_comments: false,
              show_playcount: false,
              show_user: true,
            });

            if (startTime && startTime > 0) {
              setTimeout(() => {
                widget.seekTo(startTime * 1000);
              }, 1000);
            }
          }
        };
      } catch (error) {
        console.error('[SoundCloud] Failed to initialize player:', error);
        dispatch({ type: 'SET_STATUS', payload: 'signal-lost' });
      }
    };

    initPlayer();

    return () => {
      mounted = false;
      stopTimeUpdate();
      if (containerRef.current) {
        containerRef.current.remove();
      }
    };
  }, []);

  // Start time update polling
  const startTimeUpdate = useCallback(() => {
    if (timeUpdateIntervalRef.current) return;

    timeUpdateIntervalRef.current = window.setInterval(() => {
      if (widgetRef.current) {
        widgetRef.current.getPosition((position) => {
          dispatch({ type: 'SET_CURRENT_TIME', payload: position / 1000 }); // Convert ms to seconds
        });
        widgetRef.current.getDuration((duration) => {
          dispatch({ type: 'SET_DURATION', payload: duration / 1000 }); // Convert ms to seconds
        });
      }
    }, 500);
  }, []);

  // Stop time update polling
  const stopTimeUpdate = useCallback(() => {
    if (timeUpdateIntervalRef.current) {
      window.clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }
  }, []);

  // Load a SoundCloud track
  const loadVideo = useCallback((trackUrl: string, startTime?: number) => {
    if (!widgetRef.current) {
      // Queue the load for when widget is ready
      console.log('[SoundCloud] Widget not ready, queuing load:', trackUrl);
      pendingLoadRef.current = { url: trackUrl, startTime };
      dispatch({ type: 'SET_VIDEO_ID', payload: trackUrl });
      dispatch({ type: 'SET_STATUS', payload: 'scanning' });
      return;
    }

    dispatch({ type: 'SET_VIDEO_ID', payload: trackUrl });
    dispatch({ type: 'SET_STATUS', payload: 'scanning' });

    widgetRef.current.load(trackUrl, {
      auto_play: false,
      show_artwork: true,
      show_comments: false,
      show_playcount: false,
      show_user: true,
    });

    // If startTime provided, seek after load
    if (startTime && startTime > 0) {
      // Need to wait for track to load before seeking
      setTimeout(() => {
        widgetRef.current?.seekTo(startTime * 1000); // Convert seconds to ms
      }, 1000);
    }
  }, []);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!widgetRef.current) return;
    widgetRef.current.toggle();
  }, []);

  // Relative seek
  const seek = useCallback((seconds: number) => {
    if (!widgetRef.current) return;

    widgetRef.current.getPosition((currentPosition) => {
      const newPosition = Math.max(0, currentPosition + (seconds * 1000));
      widgetRef.current?.seekTo(newPosition);
    });
  }, []);

  // Absolute seek
  const seekTo = useCallback((timestamp: number) => {
    if (!widgetRef.current) return;
    widgetRef.current.seekTo(timestamp * 1000); // Convert seconds to ms
  }, []);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    if (!widgetRef.current) return;

    const clampedVolume = Math.max(0, Math.min(100, volume));
    currentVolumeRef.current = clampedVolume;
    widgetRef.current.setVolume(clampedVolume);
    dispatch({ type: 'SET_VOLUME', payload: clampedVolume });
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!widgetRef.current) return;

    if (state.isMuted) {
      // Unmute - restore previous volume
      widgetRef.current.setVolume(currentVolumeRef.current);
      dispatch({ type: 'SET_MUTED', payload: false });
    } else {
      // Mute - set to 0
      widgetRef.current.setVolume(0);
      dispatch({ type: 'SET_MUTED', payload: true });
    }
  }, [state.isMuted]);

  // Get current time
  const getCurrentTime = useCallback(() => {
    return state.currentTime;
  }, [state.currentTime]);

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
