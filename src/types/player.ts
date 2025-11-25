export type PlayerStatus = 'idle' | 'scanning' | 'transmitting' | 'halted' | 'signal-lost';

export interface PlayerState {
  isReady: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  videoId: string | null;
  status: PlayerStatus;
}

export type PlayerAction =
  | { type: 'SET_READY' }
  | { type: 'SET_VIDEO'; videoId: string }
  | { type: 'SET_PLAYING'; isPlaying: boolean }
  | { type: 'SET_MUTED'; isMuted: boolean }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'SET_TIME'; currentTime: number; duration: number }
  | { type: 'SET_STATUS'; status: PlayerStatus }
  | { type: 'RESET' };
