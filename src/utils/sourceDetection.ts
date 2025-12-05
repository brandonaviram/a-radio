/**
 * Source Detection Utility
 *
 * Detects whether a URL is from YouTube or SoundCloud and extracts the source ID.
 * For YouTube: returns the 11-character videoId
 * For SoundCloud: returns the full track URL (used directly by Widget API)
 */

import { AudioSource, SourceDetection } from '../types/player';

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeId(url: string): string | null {
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

/**
 * Check if URL is a SoundCloud link
 */
export function isSoundCloudUrl(url: string): boolean {
  if (!url) return false;
  return /^https?:\/\/(www\.|m\.)?soundcloud\.com\/.+/.test(url) ||
         /^https?:\/\/on\.soundcloud\.com\/.+/.test(url);
}

/**
 * Check if URL is a YouTube link (or raw video ID)
 */
export function isYouTubeUrl(url: string): boolean {
  if (!url) return false;

  // Raw video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return true;

  // YouTube domains
  return /youtube\.com|youtu\.be/.test(url);
}

/**
 * Normalize SoundCloud URL
 * Ensures consistent format for storage and API calls
 */
export function normalizeSoundCloudUrl(url: string): string {
  // Remove query params and trailing slashes
  let normalized = url.split('?')[0].replace(/\/+$/, '');

  // Ensure https
  if (normalized.startsWith('http://')) {
    normalized = normalized.replace('http://', 'https://');
  }

  return normalized;
}

/**
 * Detect audio source from URL and extract source ID
 *
 * @param url - URL or video ID to analyze
 * @returns SourceDetection with source type and ID, or null if unknown
 */
export function detectSource(url: string): SourceDetection | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();

  // Check YouTube first (more common + handles raw video IDs)
  if (isYouTubeUrl(trimmed)) {
    const videoId = extractYouTubeId(trimmed);
    if (videoId) {
      return { source: 'youtube', id: videoId };
    }
  }

  // Check SoundCloud
  if (isSoundCloudUrl(trimmed)) {
    return {
      source: 'soundcloud',
      id: normalizeSoundCloudUrl(trimmed), // Store full URL for SC Widget API
    };
  }

  return null;
}

/**
 * Get display-friendly source name
 */
export function getSourceDisplayName(source: AudioSource): string {
  switch (source) {
    case 'youtube':
      return 'YouTube';
    case 'soundcloud':
      return 'SoundCloud';
    default:
      return 'Unknown';
  }
}

/**
 * Get source icon character (for minimal UI)
 */
export function getSourceIcon(source: AudioSource): string {
  switch (source) {
    case 'youtube':
      return '▶'; // Play button
    case 'soundcloud':
      return '☁'; // Cloud
    default:
      return '?';
  }
}
