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

### RetroTV Component - YouTube Sync
- **Decision**: Use iframe with URL params + key prop for syncing
- **Rationale**: YouTube IFrame API had race conditions in React; simpler approach more reliable
- **Pattern**: Change `key` prop to force iframe reload on significant seeks (>5 seconds)
- **Trade-off**: Brief reload flash vs complex API management

### Seek Detection Algorithm
- **Decision**: Track `lastSyncedTime.current` and only sync on jumps > 5 seconds
- **Rationale**: Differentiates manual seeks from normal playback progression
- **Key insight**: Must update tracking ref on EVERY time change, not just syncs (caused reload loop bug)

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
- Peaks (calculated from star density)
- Archivist notes cache
- Settings (volume, last video, API config)

### ArchivistService (`src/services/ArchivistService.ts`)
AI-powered content analysis:
- Fetches video metadata via YouTube oEmbed
- Generates "museum placard" style notes via OpenAI/Anthropic
- Caches results in StorageManager

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

## Session History

### 2025-11-24 - RetroTV Component
- Created floating draggable CRT-style monitor
- Implemented player sync (video, play state, mute, seek)
- Fixed reload loop bug (time tracking)
- Added API config persistence to localStorage
- Created styleguide.md documenting design system
- Fixed video title fetch (always use oEmbed)

## Important Context

### YouTube Integration
- Main player uses custom `useYouTubePlayer` hook
- RetroTV uses iframe embeds (simpler, fewer race conditions)
- oEmbed endpoint for metadata (no API key required)
- Video IDs extracted via regex from various YouTube URL formats

### localStorage Keys
- `aviram-radio-data` - Main data store (frequencies, settings, cache)
- `retro-tv-position` - RetroTV window position

### External APIs
- YouTube oEmbed: `https://www.youtube.com/oembed?url=...&format=json`
- OpenAI: `https://api.openai.com/v1/chat/completions`
- Anthropic: `https://api.anthropic.com/v1/messages`
