/**
 * useAudioPlayer - Unified audio player hook
 *
 * Factory pattern that creates the appropriate player based on the current source.
 * Both YouTube and SoundCloud players are initialized, but only the active one is used.
 * This allows seamless switching between sources without reinitializing.
 */

import { useState, useCallback } from 'react';
import { useYouTubePlayer } from './useYouTubePlayer';
import { useSoundCloudPlayer } from './useSoundCloudPlayer';
import { AudioSource, PlayerState, PlayerControls } from '../types/player';
import { detectSource } from '../utils/sourceDetection';

export interface UseAudioPlayerReturn {
  state: PlayerState;
  controls: PlayerControls;
  activeSource: AudioSource;
  loadFromUrl: (url: string, startTime?: number) => AudioSource | null;
}

/**
 * Unified audio player that supports multiple sources
 *
 * Usage:
 * ```tsx
 * const { state, controls, activeSource, loadFromUrl } = useAudioPlayer();
 *
 * // Load by URL (auto-detects source)
 * loadFromUrl('https://soundcloud.com/artist/track');
 * loadFromUrl('https://youtube.com/watch?v=dQw4w9WgXcQ');
 *
 * // Use controls (work regardless of source)
 * controls.togglePlayPause();
 * controls.seek(10);
 * ```
 */
export function useAudioPlayer(): UseAudioPlayerReturn {
  const [activeSource, setActiveSource] = useState<AudioSource>('youtube');

  // Initialize both players
  const [ytState, ytControls] = useYouTubePlayer();
  const [scState, scControls] = useSoundCloudPlayer();

  // Get active player state/controls based on current source
  const state = activeSource === 'youtube' ? ytState : scState;
  const controls = activeSource === 'youtube' ? ytControls : scControls;

  /**
   * Load audio from URL, auto-detecting the source
   * Returns the detected source, or null if URL not recognized
   */
  const loadFromUrl = useCallback((url: string, startTime?: number): AudioSource | null => {
    const detection = detectSource(url);

    if (!detection) {
      console.warn('[useAudioPlayer] Could not detect source for URL:', url);
      return null;
    }

    // Switch to the detected source
    setActiveSource(detection.source);

    // Load the content with the appropriate player
    if (detection.source === 'youtube') {
      ytControls.loadVideo(detection.id, startTime);
    } else if (detection.source === 'soundcloud') {
      scControls.loadVideo(detection.id, startTime);
    }

    return detection.source;
  }, [ytControls, scControls]);

  /**
   * Enhanced loadVideo that auto-detects source
   * Wraps the raw loadVideo to handle URL detection
   */
  const enhancedLoadVideo = useCallback((sourceId: string, startTime?: number) => {
    // Try to detect source from the ID/URL
    const detection = detectSource(sourceId);

    if (detection) {
      // URL provided - use auto-detection
      loadFromUrl(sourceId, startTime);
    } else {
      // Assume it's a raw ID for the current source
      controls.loadVideo(sourceId, startTime);
    }
  }, [loadFromUrl, controls]);

  // Create enhanced controls with URL auto-detection
  const enhancedControls: PlayerControls = {
    ...controls,
    loadVideo: enhancedLoadVideo,
  };

  return {
    state,
    controls: enhancedControls,
    activeSource,
    loadFromUrl,
  };
}

/**
 * Hook for using a specific source directly
 * Useful when you already know the source type
 */
export function useSourcePlayer(source: AudioSource): [PlayerState, PlayerControls] {
  const [ytState, ytControls] = useYouTubePlayer();
  const [scState, scControls] = useSoundCloudPlayer();

  if (source === 'soundcloud') {
    return [scState, scControls];
  }

  // Default to YouTube
  return [ytState, ytControls];
}
