export interface Star {
  timestamp: number;
  createdAt: number;
}

export interface Session {
  startedAt: number;
  duration: number;
}

export interface Frequency {
  videoId: string;
  title: string;
  addedAt: number;
  stars: Star[];
  sessions: Session[];
  archivistNotes?: string;
  lastPlayedAt?: number;
  // v4: Engagement algorithm
  skips: number;
  completions: number;
  duration?: number;
}

export interface RadioData {
  frequencies: Frequency[];
  settings: RadioSettings;
  version: number;
}

export interface RadioSettings {
  volume: number;
  lastVideoId?: string;
}
