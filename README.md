# AVIRAM RADIO

> Military-grade audio extraction without the military-grade data harvesting

A minimalist YouTube audio player with vintage equipment aesthetics. Strip away the recommendation algorithms, the autoplay anxiety, the visual noise. Just frequencies.

![Status](https://img.shields.io/badge/status-operational-amber)
![License](https://img.shields.io/badge/license-MIT-zinc)

---

## The Problem

YouTube's interface is a dopamine slot machine disguised as a video player. You wanted background audio. You got:
- Recommendation sidebars optimizing for engagement, not your focus
- Autoplay queues that drift from lo-fi beats to conspiracy content
- A UI designed to keep you watching, not listening

## The Solution

Aviram Radio treats YouTube videos as **frequencies** to tune into. No video. No recommendations. No surveillance theater. Just audio with timestamps you control.

---

## Features

### Core Operations
- **TRANSMIT/HALT** - Play/pause with spacebar
- **MARK SIGNAL** - Timestamp moments that matter (stars)
- **LOCK SIGNAL** - Save frequencies to your collection
- **Peak Detection** - Algorithm identifies high-density star regions

### Smart Categories (Behavior-Based)
Your listening habits surface naturally:
- **Current Vibe** - What you're into this week
- **Heavy Rotation** - Most frequently played
- **Deep Listens** - Longest total listen time

### AI Archivist
Optional museum placard-style notes for each frequency:
> "Dense layers of tape-warped synthesizers create a subaquatic pressure. The piece sustains contemplative melancholy, unhurried and spacious. This work exemplifies the 2010s vaporwave movement's excavation of 80s commercial aesthetics."

Supports OpenAI and Anthropic APIs.

### Retro Monitor
Draggable CRT TV overlay with scanlines. Syncs with main player. Because sometimes you want to see the static.

---

## Quick Start

```bash
# Clone
git clone https://github.com/aviram/a-radio.git
cd a-radio

# Install
npm install

# Transmit
npm run dev
```

Open `http://localhost:5173`

---

## Keyboard Controls

| Key | Operation |
|-----|-----------|
| `Space` | TRANSMIT / HALT |
| `←` / `→` | Seek ±10s |
| `[` / `]` | Navigate peaks |
| `S` | MARK SIGNAL (star) |
| `L` | LOCK SIGNAL (save) |
| `M` | KILL AUDIO (mute) |

---

## Configuration

### AI Archivist Setup
1. Click the gear icon (Settings)
2. Select provider (Anthropic or OpenAI)
3. Enter API key
4. Notes generate automatically for each frequency

### Data Operations
- **DUMP DATA** - Export all frequencies, stars, and notes as JSON
- **LOAD DATA** - Import from backup

All data stored locally. Nothing leaves your machine unless you configure AI.

---

## Tech Stack

- **React 18** + TypeScript
- **Vite** for builds
- **Tailwind CSS** for styling
- **YouTube IFrame API** for playback
- **localStorage** for persistence

No backend. No accounts. No tracking.

---

## Architecture

```
src/
├── App.tsx                 # Main orchestration
├── hooks/
│   └── useYouTubePlayer.ts # YouTube API integration
├── services/
│   ├── StorageManager.ts   # localStorage + smart categories
│   └── ArchivistService.ts # AI note generation
├── components/
│   ├── SignalVisualizer.tsx # Timeline with peaks
│   ├── ArchivistLog.tsx     # AI notes display
│   └── RetroTV.tsx          # Draggable monitor
├── constants/
│   ├── microcopy.ts        # UI terminology
│   ├── keyboard.ts         # Shortcut definitions
│   └── theme.ts            # Design tokens
└── types/
    └── player.ts           # TypeScript interfaces
```

---

## Design Language

- **Monospace everything** - JetBrains Mono
- **Amber on black** - Single accent color
- **CRT scanlines** - Subtle overlay effect
- **Military terminology** - Frequencies, signals, transmissions
- **No smooth transitions** - Instant state changes

---

## Development

```bash
# Dev server with HMR
npm run dev

# Type checking + build
npm run build

# Lint
npm run lint

# Preview production build
npm run preview
```

---

## Data Format

Frequencies stored in localStorage as `aviram-radio-data`:

```json
{
  "frequencies": [{
    "videoId": "jfKfPfyJRdk",
    "title": "lofi hip hop radio",
    "stars": [{ "timestamp": 1847, "createdAt": 1700000000000 }],
    "sessions": [{ "startedAt": 1700000000000, "duration": 3600 }]
  }],
  "settings": {
    "volume": 0.7,
    "lastVideoId": "jfKfPfyJRdk"
  },
  "version": 4
}
```

---

## License

MIT

---

## Status

OPERATIONAL

```
┌─────────────────────────────────────┐
│  ◉ PWR                              │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │      AWAITING SIGNAL        │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│  STANDBY                           │
└─────────────────────────────────────┘
```
