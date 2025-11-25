/**
 * StorageManager - Persistent data layer for Aviram Radio
 *
 * Manages frequencies, stars, peaks, archivist notes, and settings
 * All data stored in localStorage with proper error handling
 */

// ============================================================================
// Data Types
// ============================================================================

export interface Star {
  timestamp: number; // seconds into video
  createdAt: number; // Date.now()
}

export interface Frequency {
  videoId: string;
  title: string;
  addedAt: number;
  stars: Star[];
  archivistNotes?: string; // AI-generated museum note
  lastPlayedAt?: number;
}

export interface RadioData {
  frequencies: Frequency[];
  archivistNotesCache: Record<string, string>; // videoId → notes (works for all videos)
  settings: {
    volume: number;
    lastVideoId?: string;
  };
  version: number; // for future migrations
}

// ============================================================================
// StorageManager Class
// ============================================================================

export class StorageManager {
  private static readonly STORAGE_KEY = 'aviram-radio-data';
  private static readonly VERSION = 2; // v2: Added archivistNotesCache
  private static readonly DEFAULT_WINDOW_SIZE = 30; // seconds
  private static readonly DEFAULT_PEAK_COUNT = 10;

  // ==========================================================================
  // Core CRUD
  // ==========================================================================

  /**
   * Load data from localStorage
   * Returns default structure if nothing exists or parse fails
   */
  static load(): RadioData {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        return this.getDefaultData();
      }

      const data = JSON.parse(raw) as RadioData;

      // Validate structure
      if (!data.frequencies || !Array.isArray(data.frequencies)) {
        console.warn('[StorageManager] Invalid data structure, resetting');
        return this.getDefaultData();
      }

      // Handle version migrations if needed
      if (data.version !== this.VERSION) {
        return this.migrate(data);
      }

      return data;
    } catch (error) {
      console.error('[StorageManager] Failed to load data:', error);
      return this.getDefaultData();
    }
  }

  /**
   * Save data to localStorage
   */
  static save(data: RadioData): void {
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(this.STORAGE_KEY, json);
    } catch (error) {
      console.error('[StorageManager] Failed to save data:', error);
      throw new Error('Failed to save data to localStorage');
    }
  }

  // ==========================================================================
  // Frequency Operations
  // ==========================================================================

  /**
   * Add a new frequency (video) to the collection
   */
  static addFrequency(videoId: string, title: string): Frequency {
    const data = this.load();

    // Check if frequency already exists
    const existing = data.frequencies.find(f => f.videoId === videoId);
    if (existing) {
      return existing;
    }

    const frequency: Frequency = {
      videoId,
      title,
      addedAt: Date.now(),
      stars: [],
    };

    data.frequencies.push(frequency);
    this.save(data);

    return frequency;
  }

  /**
   * Remove a frequency from the collection
   */
  static removeFrequency(videoId: string): void {
    const data = this.load();
    data.frequencies = data.frequencies.filter(f => f.videoId !== videoId);
    this.save(data);
  }

  /**
   * Get a specific frequency by videoId
   */
  static getFrequency(videoId: string): Frequency | null {
    const data = this.load();
    return data.frequencies.find(f => f.videoId === videoId) || null;
  }

  /**
   * Get all frequencies, sorted by most recently added
   */
  static getAllFrequencies(): Frequency[] {
    const data = this.load();
    return [...data.frequencies].sort((a, b) => b.addedAt - a.addedAt);
  }

  /**
   * Check if a frequency is locked (exists in collection)
   * Used for "LOCK SIGNAL" status
   */
  static isFrequencyLocked(videoId: string): boolean {
    return this.getFrequency(videoId) !== null;
  }

  /**
   * Update last played timestamp for a frequency
   */
  static updateLastPlayed(videoId: string): void {
    const data = this.load();
    const frequency = data.frequencies.find(f => f.videoId === videoId);
    if (frequency) {
      frequency.lastPlayedAt = Date.now();
      this.save(data);
    }
  }

  // ==========================================================================
  // Star Operations
  // ==========================================================================

  /**
   * Add a star at a specific timestamp
   */
  static addStar(videoId: string, timestamp: number): void {
    const data = this.load();
    const frequency = data.frequencies.find(f => f.videoId === videoId);

    if (!frequency) {
      throw new Error(`Frequency not found: ${videoId}`);
    }

    // Check if star already exists at this timestamp (within 1 second tolerance)
    const exists = frequency.stars.some(s => Math.abs(s.timestamp - timestamp) < 1);
    if (exists) {
      return; // Don't add duplicate
    }

    frequency.stars.push({
      timestamp,
      createdAt: Date.now(),
    });

    // Keep stars sorted by timestamp
    frequency.stars.sort((a, b) => a.timestamp - b.timestamp);

    this.save(data);
  }

  /**
   * Remove a star at a specific timestamp
   */
  static removeStar(videoId: string, timestamp: number): void {
    const data = this.load();
    const frequency = data.frequencies.find(f => f.videoId === videoId);

    if (!frequency) {
      throw new Error(`Frequency not found: ${videoId}`);
    }

    // Remove star within 1 second tolerance
    frequency.stars = frequency.stars.filter(s => Math.abs(s.timestamp - timestamp) >= 1);
    this.save(data);
  }

  /**
   * Get all stars for a frequency
   */
  static getStars(videoId: string): Star[] {
    const frequency = this.getFrequency(videoId);
    return frequency ? [...frequency.stars] : [];
  }

  // ==========================================================================
  // Peak Algorithm
  // ==========================================================================

  /**
   * Calculate peak timestamps where star density is highest
   *
   * Algorithm:
   * 1. Slide a window across the video duration
   * 2. Count stars within each window position
   * 3. Find local maxima (peaks in density)
   * 4. Return top N peaks sorted by density
   *
   * @param videoId - Video to analyze
   * @param windowSize - Window size in seconds (default 30)
   * @returns Array of peak timestamps sorted by density (highest first)
   */
  static calculatePeaks(videoId: string, windowSize: number = this.DEFAULT_WINDOW_SIZE): number[] {
    const stars = this.getStars(videoId);

    if (stars.length === 0) {
      return [];
    }

    // Edge case: very few stars
    if (stars.length <= 2) {
      return stars.map(s => s.timestamp);
    }

    // Find video duration (max star timestamp + buffer)
    const maxTimestamp = Math.max(...stars.map(s => s.timestamp));
    const duration = maxTimestamp + windowSize;

    // Calculate density at each second
    const densityMap = new Map<number, number>();

    for (let position = 0; position <= duration; position++) {
      const windowStart = position;
      const windowEnd = position + windowSize;

      // Count stars within this window
      const starsInWindow = stars.filter(
        s => s.timestamp >= windowStart && s.timestamp < windowEnd
      ).length;

      densityMap.set(position, starsInWindow);
    }

    // Find local maxima (peaks)
    const peaks: Array<{ timestamp: number; density: number }> = [];
    const positions = Array.from(densityMap.keys()).sort((a, b) => a - b);

    for (let i = 1; i < positions.length - 1; i++) {
      const pos = positions[i];
      const density = densityMap.get(pos)!;
      const prevDensity = densityMap.get(positions[i - 1])!;
      const nextDensity = densityMap.get(positions[i + 1])!;

      // Local maximum: higher than neighbors
      if (density > prevDensity && density > nextDensity && density > 0) {
        peaks.push({ timestamp: pos, density });
      }
    }

    // Handle edge cases (start/end of video)
    const firstDensity = densityMap.get(positions[0])!;
    const lastDensity = densityMap.get(positions[positions.length - 1])!;

    if (firstDensity > 0) {
      peaks.push({ timestamp: positions[0], density: firstDensity });
    }
    if (lastDensity > 0 && positions.length > 1) {
      peaks.push({ timestamp: positions[positions.length - 1], density: lastDensity });
    }

    // Sort by density (highest first) and return top N timestamps
    return peaks
      .sort((a, b) => b.density - a.density)
      .slice(0, this.DEFAULT_PEAK_COUNT)
      .map(p => p.timestamp);
  }

  // ==========================================================================
  // Archivist Notes
  // ==========================================================================

  /**
   * Set AI-generated archivist notes for a video
   * Works for any video (locked or not) using separate cache
   */
  static setArchivistNotes(videoId: string, notes: string): void {
    const data = this.load();

    // Store in separate cache (works for all videos)
    data.archivistNotesCache[videoId] = notes;

    // Also update frequency if it exists (keeps data in sync)
    const frequency = data.frequencies.find(f => f.videoId === videoId);
    if (frequency) {
      frequency.archivistNotes = notes;
    }

    this.save(data);
  }

  /**
   * Get archivist notes for a video
   * Checks cache first, then falls back to frequency property
   */
  static getArchivistNotes(videoId: string): string | null {
    const data = this.load();

    // Check separate cache first (works for all videos)
    if (data.archivistNotesCache[videoId]) {
      return data.archivistNotesCache[videoId];
    }

    // Fallback to frequency property (legacy support)
    const frequency = this.getFrequency(videoId);
    return frequency?.archivistNotes || null;
  }

  // ==========================================================================
  // Settings
  // ==========================================================================

  /**
   * Get current volume setting (0-1)
   */
  static getVolume(): number {
    const data = this.load();
    return data.settings.volume;
  }

  /**
   * Set volume (0-1)
   */
  static setVolume(volume: number): void {
    const data = this.load();
    data.settings.volume = Math.max(0, Math.min(1, volume)); // Clamp 0-1
    this.save(data);
  }

  /**
   * Get last played video ID
   */
  static getLastVideoId(): string | null {
    const data = this.load();
    return data.settings.lastVideoId || null;
  }

  /**
   * Set last played video ID
   */
  static setLastVideoId(videoId: string): void {
    const data = this.load();
    data.settings.lastVideoId = videoId;
    this.save(data);
  }

  // ==========================================================================
  // Import/Export ("DATA DUMP")
  // ==========================================================================

  /**
   * Export all data as JSON string
   */
  static exportData(): string {
    const data = this.load();
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import data from JSON string
   * Validates structure before importing
   *
   * @returns true if successful, false if validation fails
   */
  static importData(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString) as RadioData;

      // Validate structure
      if (!data.frequencies || !Array.isArray(data.frequencies)) {
        console.error('[StorageManager] Import failed: invalid structure');
        return false;
      }

      if (!data.settings || typeof data.settings.volume !== 'number') {
        console.error('[StorageManager] Import failed: invalid settings');
        return false;
      }

      // Validate each frequency
      for (const freq of data.frequencies) {
        if (!freq.videoId || !freq.title || !Array.isArray(freq.stars)) {
          console.error('[StorageManager] Import failed: invalid frequency', freq);
          return false;
        }
      }

      // Initialize archivistNotesCache if missing (v1 data)
      if (!data.archivistNotesCache) {
        data.archivistNotesCache = {};
        // Migrate notes from frequencies
        for (const freq of data.frequencies) {
          if (freq.archivistNotes) {
            data.archivistNotesCache[freq.videoId] = freq.archivistNotes;
          }
        }
      }

      // Ensure version is current
      data.version = this.VERSION;

      // Import successful
      this.save(data);
      return true;
    } catch (error) {
      console.error('[StorageManager] Import failed:', error);
      return false;
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Clear all data (nuclear option)
   */
  static clearAll(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('[StorageManager] Failed to clear data:', error);
    }
  }

  /**
   * Get default data structure
   */
  private static getDefaultData(): RadioData {
    return {
      frequencies: [],
      archivistNotesCache: {}, // Empty cache for AI notes
      settings: {
        volume: 0.7, // Default 70% volume
      },
      version: this.VERSION,
    };
  }

  /**
   * Migrate data from older versions
   */
  private static migrate(data: RadioData): RadioData {
    console.log(`[StorageManager] Migrating from version ${data.version} to ${this.VERSION}`);

    // v1 → v2: Add archivistNotesCache
    if (data.version < 2) {
      console.log('[StorageManager] v1 → v2: Adding archivistNotesCache');

      // Initialize cache if missing
      if (!data.archivistNotesCache) {
        data.archivistNotesCache = {};
      }

      // Migrate existing notes from frequencies into cache
      for (const freq of data.frequencies) {
        if (freq.archivistNotes) {
          data.archivistNotesCache[freq.videoId] = freq.archivistNotes;
        }
      }
    }

    data.version = this.VERSION;
    this.save(data);
    return data;
  }

  // ==========================================================================
  // Statistics & Analytics (Bonus)
  // ==========================================================================

  /**
   * Get total number of stars across all frequencies
   */
  static getTotalStarCount(): number {
    const data = this.load();
    return data.frequencies.reduce((sum, f) => sum + f.stars.length, 0);
  }

  /**
   * Get most starred frequency
   */
  static getMostStarredFrequency(): Frequency | null {
    const frequencies = this.getAllFrequencies();
    if (frequencies.length === 0) return null;

    return frequencies.reduce((max, f) =>
      f.stars.length > max.stars.length ? f : max
    );
  }

  /**
   * Get recently played frequencies (last 7 days)
   */
  static getRecentlyPlayed(): Frequency[] {
    const data = this.load();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    return data.frequencies
      .filter(f => f.lastPlayedAt && f.lastPlayedAt > sevenDaysAgo)
      .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
  }
}
