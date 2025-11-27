# Aviram Radio

> CRT-era signal interceptor / YouTube audio player with retro hardware aesthetic

## Project Overview

Aviram Radio is a YouTube audio player styled as a vintage signal monitoring station. It features a CRT aesthetic with scanlines, amber-only accent colors, and hardware-style controls. Users can tune into YouTube videos, mark signal peaks (bookmarks), and get AI-generated "museum placard" notes about the content.

## Technical Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom design tokens
- **Font**: JetBrains Mono (monospace throughout)
- **Icons**: lucide-react (strokeWidth={1.5} standard)
- **State**: React hooks + localStorage persistence
- **YouTube**: YouTube IFrame API for playback, oEmbed for metadata

## Design System

See `styleguide.md` for comprehensive documentation. Key principles:

### Core Aesthetic
- **CRT/Hardware feel** - No smooth transitions, instant state changes
- **Amber is sacred** - Single accent color (#f59e0b), used sparingly
- **Monospace everything** - Technical, utilitarian typography
- **Scanlines overlay** - Applied globally via `.crt-overlay`

### Color Palette
- Background: Black (#000000)
- Panels/inputs: zinc-900 (#18181b)
- Borders: zinc-800 (#27272a)
- Text: zinc-400 (body), zinc-300 (primary)
- Accent: amber-500 (#f59e0b) - ONLY accent color

### Component Patterns
- Buttons: `.btn-hardware` class - no transitions, instant hover states
- Inputs: `.input-frequency` class - uppercase placeholders
- Status indicators: LED dots with amber glow when active
- Labels: 10px uppercase with letter-spacing (tracking-widest)

### Microcopy Terminology
Uses radio/signal interceptor language:
- "TRANSMITTING" / "HALTED" (not play/pause)
- "LOCK SIGNAL" (not bookmark/favorite)
- "MARK SIGNAL" (not add marker)
- "KILL AUDIO" (not mute)
- "ENTER FREQUENCY" (not enter URL)
- "NO SIGNAL" (not no video)

## Architecture Decisions

### RetroTV Component - YouTube Sync (Updated)
- **Decision**: Use YouTube IFrame API with `player.seekTo()` for smooth sync
- **Rationale**: Iframe reload approach caused jarring visual flicker on seeks
- **Evolution**: Started with iframe + key prop (simple but flickery) → switched to IFrame API (smooth)
- **Pattern**: API calls (`seekTo`, `playVideo`, `pauseVideo`) instead of iframe reload
- **Key insight**: User feedback "drift correction sucks bc it reloads the video" drove this change

### Seek Detection Algorithm
- **Decision**: Track `lastSyncedTime.current` and only sync on jumps > 2 seconds
- **Rationale**: Differentiates manual seeks from normal playback progression
- **Key insight**: Must update tracking ref on EVERY time change, not just syncs (caused reload loop bug)

### Behavior-Based Ranking ("What Fills Your Cup")
- **Decision**: Track listening sessions, not just explicit stars/bookmarks
- **Rationale**: For solo operators, stars don't mean much; actual behavior reveals what content matters
- **Categories**:
  - **Current Vibe**: Recent + frequent (last 7 days, recency-weighted)
  - **Heavy Rotation**: Most frequently played (play count)
  - **Deep Listens**: Longest total listen time
- **Session tracking**: Records duration on pause, video change, and page unload
- **Insight**: User asked "what does [stars] represent for a solo operator?" - led to behavior-based approach

### TikTok-Style Engagement Algorithm (v4)
- **Decision**: Unified engagement score that bubbles up favorites automatically
- **Rationale**: Research from ByteDance Monolith, benfred/implicit, and Metarank showed simple formulas work
- **Formula**:
  ```
  score = (0.3 × recency) + (0.7 × engagement)

  Where:
  - recency = 1 / (1 + hours_since_added / 168)  // Decays over 1 week
  - engagement = 1 + 40 × (stars - 0.3×skips + 0.5×completionRate×plays)
  ```
- **Signals tracked**:
  - **Stars** (weight: +1.0) - Explicit positive feedback
  - **Skips** (weight: -0.3) - Negative signal, position-aware (top 3 = 2x penalty)
  - **Completions** (weight: +0.5) - Strong implicit positive
- **Key insight**: Real-time updates, not batch processing - when you star, queue reorders immediately
- **Strategy doc**: `doc/dj-set-tracker-algorithm-strategy.md`

### Playback Position Persistence
- **Decision**: Save position every 5 seconds + on unload, restore on load
- **Rationale**: User expected to resume where they left off after refresh
- **Implementation**:
  - `StorageManager.getLastPosition()` / `setLastPosition()`
  - `loadVideo(videoId, startTime)` uses YouTube's `startSeconds` param
- **Critical bug fixed**: Effect must wait for `playerState.isReady` before loading video

### API Config Persistence
- **Decision**: Store API key and provider in localStorage via StorageManager
- **Rationale**: Survives page refresh, no need to re-enter credentials each session
- **Location**: `settings.apiConfig` in RadioData structure

### Video Title Fetch
- **Decision**: Always fetch via YouTube oEmbed, regardless of Archivist config
- **Rationale**: oEmbed doesn't require API key; title should always display
- **Fix**: Moved metadata fetch outside the "isConfigured" check

## Code Conventions

### File Organization
```
src/
  components/     # React components (PascalCase)
  services/       # Business logic (StorageManager, ArchivistService)
  hooks/          # Custom React hooks
  constants/      # Theme, microcopy, keyboard shortcuts
  types/          # TypeScript interfaces
```

### Component Structure
- Export from index.ts barrel file
- Props interface: `[ComponentName]Props`
- Use Tailwind classes, avoid inline styles
- Icons: lucide-react with `strokeWidth={1.5}`

### State Persistence
- All persistent state goes through `StorageManager`
- Uses single localStorage key: `aviram-radio-data`
- Versioned data structure with migration support

## Key Components

### RetroTV (`src/components/RetroTV.tsx`)
Floating draggable picture-in-picture monitor:
- Syncs with main player (video, play state, mute, seek position)
- CRT bezel design with decorative knobs
- Position persists in localStorage
- Status bar shows TRANSMITTING/STANDBY

### StorageManager (`src/services/StorageManager.ts`)
Handles all localStorage operations:
- Frequencies (saved videos)
- Stars (bookmarks within videos)
- Sessions (listening behavior tracking)
- Peaks (calculated from star density)
- Archivist notes cache
- Settings (volume, last video, last position, API config)
- Smart categories: `getHeavyRotation()`, `getDeepListens()`, `getCurrentVibe()`
- Data versioning with migrations (currently v3)

### ArchivistService (`src/services/ArchivistService.ts`)
AI-powered content analysis:
- Fetches video metadata via YouTube oEmbed (cached in-memory per session)
- Generates "museum placard" style notes via OpenAI/Anthropic
- Caches AI notes in StorageManager (persists across sessions)
- **Caching strategy**: oEmbed = session cache (Map), AI notes = localStorage

## Workflow Patterns

### What Works Well
- **Triage agent** for routing feature requests to appropriate specialist
- **Builder agent** for focused implementation with full design context
- **Parallel exploration** when understanding existing code patterns

### Common Issues & Fixes

#### YouTube Iframe Reload Loop
**Symptom**: Monitor keeps reloading every few seconds
**Cause**: Time tracking ref only updated when syncing, not during playback
**Fix**: Always update `lastSyncedTime.current = currentTime` on every effect run

#### Video Title Not Showing
**Symptom**: Shows "ID: xyz123" instead of video title
**Cause**: Title fetch was inside "isConfigured" check, skipped when no API key
**Fix**: Fetch title first (oEmbed needs no API), then check for AI notes

#### Video Not Loading on Refresh
**Symptom**: Page loads but video doesn't restore after refresh
**Cause**: Effect to load video runs before `playerState.isReady` is true
**Fix**: Add `playerState.isReady` to effect dependencies, use `hasLoadedInitialVideo` ref to prevent duplicate loads

#### Null Sessions Array Crash
**Symptom**: `Cannot read properties of undefined (reading 'length')` on load
**Cause**: Existing frequencies in localStorage don't have `sessions` array (pre-v3 data)
**Fix**: Add null checks (`f.sessions || []`) in all session-related methods + migration

## Session History

### 2025-11-24 - RetroTV Component (Session 1)
- Created floating draggable CRT-style monitor
- Implemented player sync (video, play state, mute, seek)
- Fixed reload loop bug (time tracking)
- Added API config persistence to localStorage
- Created styleguide.md documenting design system
- Fixed video title fetch (always use oEmbed)

### 2025-11-24 - Behavior-Based Ranking + Polish (Session 2)
- Implemented behavior-based frequency ranking (sessions, smart categories)
- Upgraded RetroTV from iframe reload to YouTube IFrame API for smooth seeking
- Added playback position persistence (save every 5s, restore on load)
- Fixed timing bug: wait for player ready before loading initial video
- Added API caching: oEmbed in-memory, AI notes in localStorage
- Key user feedback: "drift correction sucks bc it reloads the video" → smooth API approach

### 2025-11-25 - TikTok-Style Engagement Algorithm (Session 3)
- Researched ByteDance Monolith, benfred/implicit, Metarank for algorithm patterns
- Added engagement tracking fields: `skips`, `completions`, `duration` to Frequency
- Implemented v4 migration (initializes new fields for existing data)
- Added new methods:
  - `recordSkip(videoId, position)` - Position-aware negative signal
  - `recordCompletion(videoId)` - Strong positive signal
  - `calculateConfidence(frequency)` - Raw engagement score
  - `calculateEngagementScore(frequency)` - Final weighted score
  - `getEngagementRankedFrequencies()` - Queue sorted by engagement
  - `getEngagementStats(videoId)` - Debug/display stats
- Formula: `score = 0.3×recency + 0.7×engagement`
- Key insight: Dead-simple math from research (no ML needed, just weighted averages)
- Strategy doc created: `doc/dj-set-tracker-algorithm-strategy.md`

## Important Context

### YouTube Integration
- Main player uses custom `useYouTubePlayer` hook (IFrame API)
- RetroTV also uses IFrame API (upgraded from simple iframe for smooth sync)
- oEmbed endpoint for metadata (no API key required, cached per session)
- Video IDs extracted via regex from various YouTube URL formats
- `loadVideoById({ videoId, startSeconds })` for position restore

### Data Model (v4)
```typescript
interface Frequency {
  videoId: string;
  title: string;
  addedAt: number;
  stars: Star[];
  sessions: Session[];  // v3: behavior tracking
  archivistNotes?: string;
  lastPlayedAt?: number;
  // v4: Engagement algorithm
  skips: number;        // Times user skipped
  completions: number;  // Times played to end
  duration?: number;    // Video duration (for completion rate)
}

interface Session {
  startedAt: number;
  duration: number;  // seconds
}
```

### localStorage Keys
- `aviram-radio-data` - Main data store (frequencies, settings, cache)
- `retro-tv-position` - RetroTV window position

### External APIs
- YouTube oEmbed: `https://www.youtube.com/oembed?url=...&format=json`
- OpenAI: `https://api.openai.com/v1/chat/completions`
- Anthropic: `https://api.anthropic.com/v1/messages`
