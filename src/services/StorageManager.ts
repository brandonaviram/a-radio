/**
 * StorageManager - Persistent data layer for Aviram Radio
 *
 * Manages frequencies, stars, peaks, archivist notes, and settings
 * All data stored in localStorage with proper error handling
 */

import { SEED_FREQUENCIES } from '../constants/seeds';
import { AudioSource } from '../types/player';

// ============================================================================
// Data Types
// ============================================================================

export interface Star {
  timestamp: number; // seconds into video
  createdAt: number; // Date.now()
}

export interface Session {
  startedAt: number; // Date.now() when session began
  duration: number; // seconds listened
}

export interface Frequency {
  videoId: string; // YouTube videoId or SoundCloud track URL
  title: string;
  addedAt: number;
  stars: Star[];
  sessions: Session[]; // Track listening behavior
  archivistNotes?: string; // AI-generated museum note
  lastPlayedAt?: number;
  // v4: Engagement tracking
  skips: number; // Times user skipped this frequency
  completions: number; // Times played to natural end
  duration?: number; // Video duration in seconds (for completion rate)
  // v5: Multi-source support
  source: AudioSource;
}

export interface ApiConfig {
  apiKey: string;
  provider: 'openai' | 'anthropic';
}

export interface RadioData {
  frequencies: Frequency[];
  archivistNotesCache: Record<string, string>; // videoId → notes (works for all videos)
  settings: {
    volume: number;
    lastVideoId?: string;
    apiConfig?: ApiConfig; // Persisted API credentials
  };
  version: number; // for future migrations
}

// ============================================================================
// StorageManager Class
// ============================================================================

export class StorageManager {
  private static readonly STORAGE_KEY = 'aviram-radio-data';
  private static readonly VERSION = 5; // v5: Multi-source support (youtube, soundcloud)
  private static readonly DEFAULT_WINDOW_SIZE = 30; // seconds
  private static readonly DEFAULT_PEAK_COUNT = 10;

  // Engagement algorithm constants (from TikTok/implicit research)
  private static readonly RECENCY_WEIGHT = 0.3;
  private static readonly ENGAGEMENT_WEIGHT = 0.7;
  private static readonly RECENCY_HALF_LIFE_HOURS = 168; // 1 week
  private static readonly CONFIDENCE_ALPHA = 40;
  private static readonly STAR_WEIGHT = 1.0;
  private static readonly SKIP_WEIGHT = -0.3;
  private static readonly COMPLETION_WEIGHT = 0.5;

  // ==========================================================================
  // Core CRUD
  // ==========================================================================

  /**
   * Load data from localStorage
   * Returns default structure if nothing exists or parse fails
   * Seeds with default frequencies on first load
   */
  static load(): RadioData {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        const defaultData = this.getDefaultData();
        return this.seedIfEmpty(defaultData);
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

      // Ensure archivistNotesCache exists (defensive, in case of corrupt data)
      if (!data.archivistNotesCache) {
        data.archivistNotesCache = {};
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
   * Add a new frequency (video/track) to the collection
   */
  static addFrequency(videoId: string, title: string, source: AudioSource = 'youtube'): Frequency {
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
      sessions: [],
      skips: 0,
      completions: 0,
      source,
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

  /**
   * Update a frequency's title
   * Used to fix frequencies that were saved with placeholder titles
   */
  static updateFrequencyTitle(videoId: string, title: string): boolean {
    const data = this.load();
    const frequency = data.frequencies.find(f => f.videoId === videoId);
    if (frequency) {
      frequency.title = title;
      this.save(data);
      return true;
    }
    return false;
  }

  /**
   * Get frequencies that have placeholder titles (need fixing)
   * These are titles that start with "Frequency " followed by the videoId
   */
  static getFrequenciesWithBadTitles(): Frequency[] {
    const data = this.load();
    return data.frequencies.filter(f =>
      f.title.startsWith('Frequency ') || f.title === 'Unknown'
    );
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
   * Calculate peak regions where stars are clustered
   *
   * Algorithm (cluster-based):
   * 1. Sort stars by timestamp
   * 2. Group stars within windowSize of each other into clusters
   * 3. Calculate center of each cluster (average timestamp)
   * 4. Return cluster centers, sorted by cluster size (most stars = highest priority)
   *
   * This approach handles both clustered AND evenly-spread stars correctly.
   *
   * @param videoId - Video to analyze
   * @param windowSize - Maximum gap between stars in same cluster (default 30s)
   * @returns Array of peak timestamps sorted by cluster size (largest first)
   */
  static calculatePeaks(videoId: string, windowSize: number = this.DEFAULT_WINDOW_SIZE): number[] {
    const stars = this.getStars(videoId);

    if (stars.length === 0) {
      return [];
    }

    // Edge case: very few stars - just return their timestamps
    if (stars.length <= 2) {
      return stars.map(s => s.timestamp);
    }

    // Sort stars by timestamp
    const sortedStars = [...stars].sort((a, b) => a.timestamp - b.timestamp);

    // Group stars into clusters (stars within windowSize of each other)
    const clusters: Array<{ timestamps: number[] }> = [];
    let currentCluster: number[] = [sortedStars[0].timestamp];

    for (let i = 1; i < sortedStars.length; i++) {
      const gap = sortedStars[i].timestamp - sortedStars[i - 1].timestamp;

      if (gap <= windowSize) {
        // Same cluster - add to current
        currentCluster.push(sortedStars[i].timestamp);
      } else {
        // New cluster - save current and start new one
        clusters.push({ timestamps: currentCluster });
        currentCluster = [sortedStars[i].timestamp];
      }
    }

    // Don't forget the last cluster
    clusters.push({ timestamps: currentCluster });

    // Calculate center of each cluster and sort by size
    const peaks = clusters.map(cluster => ({
      // Center is the average of all timestamps in cluster
      center: cluster.timestamps.reduce((a, b) => a + b, 0) / cluster.timestamps.length,
      size: cluster.timestamps.length,
    }));

    // Sort by cluster size (most stars = highest priority)
    // For ties, sort by timestamp (earlier first)
    peaks.sort((a, b) => {
      if (b.size !== a.size) return b.size - a.size;
      return a.center - b.center;
    });

    // Get top N peaks by size, then sort by timestamp for navigation
    const topPeaks = peaks.slice(0, this.DEFAULT_PEAK_COUNT);

    // Re-sort by timestamp (chronological order for navigation)
    topPeaks.sort((a, b) => a.center - b.center);

    return topPeaks.map(p => Math.round(p.center)); // Round to nearest second
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

    // Ensure cache exists (in case of old data)
    if (!data.archivistNotesCache) {
      data.archivistNotesCache = {};
    }

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
    // Use optional chaining in case archivistNotesCache is undefined (old data)
    if (data.archivistNotesCache?.[videoId]) {
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

  /**
   * Get last playback position (in seconds)
   */
  static getLastPosition(): number {
    const data = this.load();
    return (data.settings as { lastPosition?: number }).lastPosition || 0;
  }

  /**
   * Set last playback position (in seconds)
   */
  static setLastPosition(position: number): void {
    const data = this.load();
    (data.settings as { lastPosition?: number }).lastPosition = position;
    this.save(data);
  }

  /**
   * Get saved API configuration
   */
  static getApiConfig(): ApiConfig | null {
    const data = this.load();
    return data.settings.apiConfig || null;
  }

  /**
   * Save API configuration (key + provider)
   */
  static setApiConfig(config: ApiConfig): void {
    const data = this.load();
    data.settings.apiConfig = config;
    this.save(data);
  }

  /**
   * Clear API configuration
   */
  static clearApiConfig(): void {
    const data = this.load();
    delete data.settings.apiConfig;
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
   * Seed default frequencies on first load
   * Only populates if frequencies array is empty
   */
  private static seedIfEmpty(data: RadioData): RadioData {
    if (data.frequencies.length > 0) return data;

    console.log('[StorageManager] First run - seeding default frequencies');

    const now = Date.now();
    SEED_FREQUENCIES.forEach((seed, i) => {
      data.frequencies.push({
        videoId: seed.videoId,
        title: seed.title,
        addedAt: now - i * 1000, // Stagger for sort order
        stars: [],
        sessions: [],
        skips: 0,
        completions: 0,
        source: seed.source || 'youtube',
      });
    });

    this.save(data);
    return data;
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

    // v2 → v3: Add session tracking
    if (data.version < 3) {
      console.log('[StorageManager] v2 → v3: Adding session tracking');

      // Initialize sessions array for existing frequencies
      for (const freq of data.frequencies) {
        if (!freq.sessions) {
          freq.sessions = [];
        }
      }
    }

    // v3 → v4: Add engagement tracking (skips, completions)
    if (data.version < 4) {
      console.log('[StorageManager] v3 → v4: Adding engagement tracking');

      for (const freq of data.frequencies) {
        if (freq.skips === undefined) {
          freq.skips = 0;
        }
        if (freq.completions === undefined) {
          freq.completions = 0;
        }
      }
    }

    // v4 → v5: Add multi-source support
    if (data.version < 5) {
      console.log('[StorageManager] v4 → v5: Adding multi-source support');

      for (const freq of data.frequencies) {
        if ((freq as Frequency).source === undefined) {
          // Default all existing frequencies to YouTube
          (freq as Frequency).source = 'youtube';
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

  // ==========================================================================
  // Session Tracking (Behavior-Based Ranking)
  // ==========================================================================

  /**
   * Record a listening session for a frequency
   * Call this when user stops playing or navigates away
   */
  static recordSession(videoId: string, duration: number): void {
    if (duration < 10) return; // Ignore sessions shorter than 10 seconds

    const data = this.load();
    const frequency = data.frequencies.find(f => f.videoId === videoId);

    if (!frequency) {
      console.warn(`[StorageManager] Cannot record session: frequency ${videoId} not found`);
      return;
    }

    frequency.sessions.push({
      startedAt: Date.now() - (duration * 1000), // Approximate start time
      duration,
    });

    this.save(data);
  }

  /**
   * Get total listen time for a frequency (in seconds)
   */
  static getTotalListenTime(videoId: string): number {
    const frequency = this.getFrequency(videoId);
    if (!frequency) return 0;

    return frequency.sessions.reduce((total, s) => total + s.duration, 0);
  }

  /**
   * Get play count for a frequency
   */
  static getPlayCount(videoId: string): number {
    const frequency = this.getFrequency(videoId);
    if (!frequency) return 0;

    return frequency.sessions.length;
  }

  // ==========================================================================
  // Smart Categories ("What Fills Your Cup")
  // ==========================================================================

  /**
   * Heavy Rotation - Most frequently played
   * The stuff you keep coming back to
   */
  static getHeavyRotation(limit: number = 5): Frequency[] {
    const data = this.load();

    return [...data.frequencies]
      .filter(f => f.sessions && f.sessions.length > 0)
      .sort((a, b) => (b.sessions?.length || 0) - (a.sessions?.length || 0))
      .slice(0, limit);
  }

  /**
   * Deep Listens - Longest total listen time
   * The frequencies you've spent the most time with
   */
  static getDeepListens(limit: number = 5): Frequency[] {
    const data = this.load();

    const withTotalTime = data.frequencies.map(f => ({
      frequency: f,
      totalTime: (f.sessions || []).reduce((sum, s) => sum + s.duration, 0),
    }));

    return withTotalTime
      .filter(item => item.totalTime > 0)
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, limit)
      .map(item => item.frequency);
  }

  /**
   * Current Vibe - Recent + frequent combination
   * What you're into right now (last 7 days, weighted by frequency)
   */
  static getCurrentVibe(limit: number = 5): Frequency[] {
    const data = this.load();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    const withRecentScore = data.frequencies.map(f => {
      // Count sessions in last 7 days
      const sessions = f.sessions || [];
      const recentSessions = sessions.filter(s => s.startedAt > sevenDaysAgo);
      const recentCount = recentSessions.length;

      // Calculate recency weight (more recent = higher weight)
      let recencyWeight = 0;
      if (f.lastPlayedAt && f.lastPlayedAt > sevenDaysAgo) {
        // Normalize to 0-1 range (0 = 7 days ago, 1 = now)
        recencyWeight = (f.lastPlayedAt - sevenDaysAgo) / (7 * 24 * 60 * 60 * 1000);
      }

      // Combined score: play count + recency bonus
      const score = recentCount + recencyWeight;

      return { frequency: f, score, recentCount };
    });

    return withRecentScore
      .filter(item => item.recentCount > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.frequency);
  }

  /**
   * Get all smart categories at once
   * Returns categorized frequencies for UI display
   */
  static getSmartCategories(): {
    heavyRotation: Frequency[];
    deepListens: Frequency[];
    currentVibe: Frequency[];
  } {
    return {
      heavyRotation: this.getHeavyRotation(),
      deepListens: this.getDeepListens(),
      currentVibe: this.getCurrentVibe(),
    };
  }

  // ==========================================================================
  // Engagement Algorithm (TikTok-style ranking)
  // ==========================================================================

  /**
   * Record a skip (negative signal)
   * Called when user presses N/skip before video ends
   *
   * Position-aware: skipping top items is a stronger negative signal
   */
  static recordSkip(videoId: string, position: number = 0): void {
    const data = this.load();
    const frequency = data.frequencies.find(f => f.videoId === videoId);

    if (!frequency) {
      console.warn(`[StorageManager] Cannot record skip: frequency ${videoId} not found`);
      return;
    }

    // Position multiplier: top 3 positions penalized more (from Metarank research)
    const positionMultiplier = position < 3 ? 2.0 : 1.0;
    frequency.skips = (frequency.skips || 0) + positionMultiplier;

    this.save(data);
  }

  /**
   * Record a completion (strong positive signal)
   * Called when video ends naturally (not skipped)
   */
  static recordCompletion(videoId: string): void {
    const data = this.load();
    const frequency = data.frequencies.find(f => f.videoId === videoId);

    if (!frequency) {
      console.warn(`[StorageManager] Cannot record completion: frequency ${videoId} not found`);
      return;
    }

    frequency.completions = (frequency.completions || 0) + 1;
    this.save(data);
  }

  /**
   * Set video duration (needed for completion rate calculation)
   * Called when video metadata is loaded
   */
  static setVideoDuration(videoId: string, duration: number): void {
    const data = this.load();
    const frequency = data.frequencies.find(f => f.videoId === videoId);

    if (frequency) {
      frequency.duration = duration;
      this.save(data);
    }
  }

  /**
   * Calculate engagement score for a frequency
   *
   * Formula (from TikTok/implicit feedback research):
   * confidence = 1 + α * (stars - skipWeight*skips + completionWeight*completions)
   *
   * @returns Confidence score (higher = more engaged)
   */
  static calculateConfidence(frequency: Frequency): number {
    const stars = frequency.stars?.length || 0;
    const skips = frequency.skips || 0;
    const completions = frequency.completions || 0;
    const plays = frequency.sessions?.length || 0;

    // Calculate completion rate (0-1)
    const completionRate = plays > 0 ? completions / plays : 0;

    // Raw engagement: stars are positive, skips are negative, completions boost
    const rawEngagement =
      (stars * this.STAR_WEIGHT) +
      (skips * this.SKIP_WEIGHT) +
      (completionRate * this.COMPLETION_WEIGHT * plays);

    // Confidence formula (from implicit feedback research)
    return 1 + this.CONFIDENCE_ALPHA * Math.max(0, rawEngagement);
  }

  /**
   * Calculate recency score (0-1)
   * Newer items score higher, decays over 1 week
   */
  static calculateRecencyScore(addedAt: number): number {
    const hoursSinceAdded = (Date.now() - addedAt) / 3600000;
    return 1 / (1 + hoursSinceAdded / this.RECENCY_HALF_LIFE_HOURS);
  }

  /**
   * Calculate final engagement score for a frequency
   *
   * Formula: score = (recencyWeight * recency) + (engagementWeight * normalizedConfidence)
   *
   * @param frequency - The frequency to score
   * @param maxConfidence - Max confidence in collection (for normalization)
   * @returns Final score (0-1 range)
   */
  static calculateEngagementScore(frequency: Frequency, maxConfidence: number): number {
    const recency = this.calculateRecencyScore(frequency.addedAt);
    const confidence = this.calculateConfidence(frequency);
    const normalizedConfidence = maxConfidence > 0 ? confidence / maxConfidence : 0.5;

    return (this.RECENCY_WEIGHT * recency) + (this.ENGAGEMENT_WEIGHT * normalizedConfidence);
  }

  /**
   * Get frequencies ranked by engagement score
   * This is the TikTok-style algorithm: starred content bubbles up
   *
   * @returns Frequencies sorted by engagement (highest first)
   */
  static getEngagementRankedFrequencies(): Frequency[] {
    const data = this.load();
    const frequencies = data.frequencies;

    if (frequencies.length === 0) {
      return [];
    }

    // Find max confidence for normalization
    const maxConfidence = Math.max(
      1,
      ...frequencies.map(f => this.calculateConfidence(f))
    );

    // Score and sort
    const scored = frequencies.map(f => ({
      frequency: f,
      score: this.calculateEngagementScore(f, maxConfidence),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .map(item => item.frequency);
  }

  /**
   * Get engagement stats for debugging/display
   */
  static getEngagementStats(videoId: string): {
    stars: number;
    skips: number;
    completions: number;
    plays: number;
    confidence: number;
    recency: number;
    score: number;
  } | null {
    const frequency = this.getFrequency(videoId);
    if (!frequency) return null;

    const data = this.load();
    const maxConfidence = Math.max(
      1,
      ...data.frequencies.map(f => this.calculateConfidence(f))
    );

    return {
      stars: frequency.stars?.length || 0,
      skips: frequency.skips || 0,
      completions: frequency.completions || 0,
      plays: frequency.sessions?.length || 0,
      confidence: this.calculateConfidence(frequency),
      recency: this.calculateRecencyScore(frequency.addedAt),
      score: this.calculateEngagementScore(frequency, maxConfidence),
    };
  }
}
