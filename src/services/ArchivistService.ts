/**
 * AI Archivist Service
 *
 * Generates museum placard-style notes for audio content using AI.
 * Supports OpenAI and Anthropic providers.
 * Fetches metadata from YouTube (oEmbed) and SoundCloud (oEmbed).
 */

import { AudioSource } from '../types/player';

interface ArchivistConfig {
  apiKey: string;
  provider: 'openai' | 'anthropic';
}

export interface TrackMetadata {
  sourceId: string;
  source: AudioSource;
  title?: string;
  author?: string;
  description?: string;
  thumbnailUrl?: string;
  tags?: string[];
}

// Legacy alias for backward compatibility
interface VideoMetadata {
  videoId: string;
  title?: string;
  description?: string;
  tags?: string[];
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface AnthropicResponse {
  content: Array<{
    text: string;
  }>;
}

interface YouTubeOEmbedResponse {
  title: string;
  author_name: string;
  author_url: string;
  type: string;
  height: number;
  width: number;
  version: string;
  provider_name: string;
  provider_url: string;
  thumbnail_height: number;
  thumbnail_width: number;
  thumbnail_url: string;
  html: string;
}

interface SoundCloudOEmbedResponse {
  title: string;
  author_name: string;
  author_url: string;
  thumbnail_url: string;
  html: string;
  version: string;
  type: string;
  provider_name: string;
  provider_url: string;
  height: number;
  width: string;
}

const CURATOR_SYSTEM_PROMPT = `You are a late-night radio host writing brief intros for an audio archive — think NPR Tiny Desk, RadioLab, or All Songs Considered.

Your task is to write a 2-3 sentence description that makes someone hear the audio differently.

Guidelines:
- Start with texture: What does it actually sound like? Be specific and sensory.
- Find the interesting angle: A detail about who made it, how, or why that makes you lean in.
- Connect to feeling: When would you listen to this? What mood does it serve?

Style:
- Warm and curious, like a knowledgeable friend, not a museum docent
- Conversational but precise — you know your stuff but you're not showing off
- Specific sensory details over genre labels
- Present tense, active voice
- No academic jargon (words like "liminal" or "juxtaposition" are banned)
- No superlatives or marketing language

Example output:
"There's something about the way the synths sit just behind the beat — unhurried, like they know you're not going anywhere. Built from samples of forgotten department store muzak, it somehow became the soundtrack to a million late-night coding sessions. The kind of thing you put on at 11pm and suddenly it's 3am."`;

export class ArchivistService {
  private static config: ArchivistConfig | null = null;
  // In-memory cache for oEmbed metadata (persists for session)
  private static metadataCache: Map<string, VideoMetadata> = new Map();
  private static trackMetadataCache: Map<string, TrackMetadata> = new Map();

  /**
   * Configure the Archivist with API credentials
   */
  static configure(config: ArchivistConfig): void {
    this.config = config;
    console.log(`[Archivist] Configured with provider: ${config.provider}`);
  }

  /**
   * Check if Archivist is configured
   */
  static isConfigured(): boolean {
    return this.config !== null;
  }

  /**
   * Get current configuration
   */
  static getConfig(): ArchivistConfig | null {
    return this.config;
  }

  /**
   * Fetch video metadata from YouTube using oEmbed endpoint (no API key needed)
   * Results are cached in memory to avoid redundant API calls
   */
  static async fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
    // Check cache first
    const cached = this.metadataCache.get(videoId);
    if (cached) {
      console.log(`[Archivist] Using cached metadata for: ${videoId}`);
      return cached;
    }

    try {
      const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`YouTube oEmbed failed: ${response.status}`);
      }

      const data: YouTubeOEmbedResponse = await response.json();

      const metadata: VideoMetadata = {
        videoId,
        title: data.title,
        description: `By ${data.author_name}`,
        tags: [],
      };

      // Cache the result
      this.metadataCache.set(videoId, metadata);
      console.log(`[Archivist] Cached metadata for: ${videoId}`);

      return metadata;
    } catch (error) {
      console.error('[Archivist] Failed to fetch video metadata:', error);
      return {
        videoId,
        title: 'Unknown',
        description: undefined,
        tags: [],
      };
    }
  }

  /**
   * Fetch SoundCloud track metadata using oEmbed endpoint (no API key needed)
   */
  static async fetchSoundCloudMetadata(trackUrl: string): Promise<TrackMetadata> {
    // Check cache first
    const cached = this.trackMetadataCache.get(trackUrl);
    if (cached) {
      console.log(`[Archivist] Using cached SoundCloud metadata for: ${trackUrl}`);
      return cached;
    }

    try {
      const oembedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(trackUrl)}&format=json`;
      const response = await fetch(oembedUrl);

      if (!response.ok) {
        throw new Error(`SoundCloud oEmbed failed: ${response.status}`);
      }

      const data: SoundCloudOEmbedResponse = await response.json();

      const metadata: TrackMetadata = {
        sourceId: trackUrl,
        source: 'soundcloud',
        title: data.title,
        author: data.author_name,
        description: `By ${data.author_name}`,
        thumbnailUrl: data.thumbnail_url,
        tags: [],
      };

      // Cache the result
      this.trackMetadataCache.set(trackUrl, metadata);
      console.log(`[Archivist] Cached SoundCloud metadata for: ${trackUrl}`);

      return metadata;
    } catch (error) {
      console.error('[Archivist] Failed to fetch SoundCloud metadata:', error);
      return {
        sourceId: trackUrl,
        source: 'soundcloud',
        title: 'Unknown Track',
        description: undefined,
        tags: [],
      };
    }
  }

  /**
   * Unified metadata fetch - works for any supported source
   */
  static async fetchTrackMetadata(sourceId: string, source: AudioSource): Promise<TrackMetadata> {
    if (source === 'soundcloud') {
      return this.fetchSoundCloudMetadata(sourceId);
    }

    // Default to YouTube
    const ytMetadata = await this.fetchVideoMetadata(sourceId);
    return {
      sourceId,
      source: 'youtube',
      title: ytMetadata.title,
      description: ytMetadata.description,
      tags: ytMetadata.tags,
    };
  }

  /**
   * Generate museum-style notes using OpenAI
   */
  private static async generateWithOpenAI(metadata: VideoMetadata): Promise<string> {
    const config = this.config!;

    const prompt = this.buildPrompt(metadata);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: CURATOR_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API failed: ${response.status} ${response.statusText}`);
    }

    const data: OpenAIResponse = await response.json();
    return data.choices[0].message.content.trim();
  }

  /**
   * Generate museum-style notes using Anthropic
   */
  private static async generateWithAnthropic(metadata: VideoMetadata): Promise<string> {
    const config = this.config!;

    const prompt = this.buildPrompt(metadata);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        system: CURATOR_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API failed: ${response.status} ${response.statusText}`);
    }

    const data: AnthropicResponse = await response.json();
    return data.content[0].text.trim();
  }

  /**
   * Build prompt from video metadata
   */
  private static buildPrompt(metadata: VideoMetadata): string {
    const parts = [`Video: "${metadata.title || 'Unknown'}"`];

    if (metadata.description) {
      parts.push(`\nDescription: ${metadata.description}`);
    }

    if (metadata.tags && metadata.tags.length > 0) {
      parts.push(`\nTags: ${metadata.tags.join(', ')}`);
    }

    return parts.join('');
  }

  /**
   * Generate museum placard-style notes for audio content
   */
  static async generateNotes(metadata: VideoMetadata): Promise<string> {
    // Check if configured
    if (!this.isConfigured()) {
      console.warn('[Archivist] Not configured - cannot generate notes');
      return '// ARCHIVIST OFFLINE - CONFIGURE API KEY';
    }

    const config = this.config!;

    try {
      console.log(`[Archivist] Generating notes for: ${metadata.title}`);

      let notes: string;

      if (config.provider === 'openai') {
        notes = await this.generateWithOpenAI(metadata);
      } else if (config.provider === 'anthropic') {
        notes = await this.generateWithAnthropic(metadata);
      } else {
        throw new Error(`Unknown provider: ${config.provider}`);
      }

      console.log('[Archivist] Notes generated successfully');
      return notes;

    } catch (error) {
      console.error('[Archivist] Failed to generate notes:', error);
      return '// SIGNAL ANALYSIS FAILED';
    }
  }
}

export default ArchivistService;
