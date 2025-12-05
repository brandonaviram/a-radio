// Audio source types supported by Aviram Radio
export type AudioSource = 'youtube' | 'soundcloud';

// Player status using radio/signal terminology
export type PlayerStatus = 'idle' | 'scanning' | 'transmitting' | 'halted' | 'signal-lost';

// Generic player state - works for any audio source
export interface PlayerState {
  isReady: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number; // 0-100
  currentTime: number; // seconds
  duration: number; // seconds
  videoId: string | null; // Kept as videoId for backward compat (represents sourceId)
  status: PlayerStatus;
}

// Generic player controls - source-agnostic interface
export interface PlayerControls {
  loadVideo: (sourceId: string, startTime?: number) => void; // Kept as loadVideo for backward compat
  togglePlayPause: () => void;
  seek: (seconds: number) => void; // Relative seek
  seekTo: (timestamp: number) => void; // Absolute seek
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  getCurrentTime: () => number;
}

// Hook return type for any audio player
export type UseAudioPlayerHook = () => [PlayerState, PlayerControls];

// Source detection result
export interface SourceDetection {
  source: AudioSource;
  id: string; // YouTube videoId or SoundCloud track URL
}

// State actions for reducer (unified across sources)
export type PlayerAction =
  | { type: 'SET_READY'; payload: boolean }
  | { type: 'SET_PLAYING'; payload: boolean }
  | { type: 'SET_MUTED'; payload: boolean }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'SET_CURRENT_TIME'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_VIDEO_ID'; payload: string | null }
  | { type: 'SET_STATUS'; payload: PlayerStatus }
  | { type: 'UPDATE_STATE'; payload: Partial<PlayerState> };

// Initial state factory
export const createInitialState = (): PlayerState => ({
  isReady: false,
  isPlaying: false,
  isMuted: false,
  volume: 100,
  currentTime: 0,
  duration: 0,
  videoId: null,
  status: 'idle',
});

// Shared reducer for player state
export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
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
