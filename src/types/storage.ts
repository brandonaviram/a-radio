export interface Star {
  timestamp: number;
  createdAt: number;
}

export interface Frequency {
  videoId: string;
  title: string;
  addedAt: number;
  stars: Star[];
  archivistNotes?: string;
  lastPlayedAt?: number;
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
