/**
 * AI Archivist Service
 *
 * Generates museum placard-style notes for audio content using AI.
 * Supports OpenAI and Anthropic providers.
 */

interface ArchivistConfig {
  apiKey: string;
  provider: 'openai' | 'anthropic';
}

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

const CURATOR_SYSTEM_PROMPT = `You are a museum curator writing exhibit placards for an audio archive.
Your task is to write a 3-sentence museum-style description of the audio content.

Guidelines:
- First sentence: Describe the texture and sonic character (warm, abrasive, ethereal, lo-fi, etc.)
- Second sentence: Capture the mood and emotional landscape
- Third sentence: Place it in historical or cultural context

Style:
- Write like a museum placard: precise, evocative, scholarly but accessible
- Use sensory language for sound (textures, temperatures, spatial qualities)
- Be specific, not generic
- No superlatives or marketing language
- Present tense

Example output:
"Dense layers of tape-warped synthesizers create a subaquatic pressure, as if hearing through water. The piece sustains a mood of contemplative melancholy, unhurried and spacious. This work exemplifies the 2010s vaporwave movement's excavation of 80s commercial aesthetics, repurposed as ambient meditation."`;

export class ArchivistService {
  private static config: ArchivistConfig | null = null;

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
   */
  static async fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
    try {
      const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`YouTube oEmbed failed: ${response.status}`);
      }

      const data: YouTubeOEmbedResponse = await response.json();

      return {
        videoId,
        title: data.title,
        description: `By ${data.author_name}`,
        tags: [],
      };
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
