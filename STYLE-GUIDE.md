# AVIRAM RADIO — Style Guide

> Design system for military-grade audio extraction interfaces

---

## Brand Essence

**Voice:** Understated. Technical. Slightly mysterious.
**Feeling:** Vintage equipment manual meets modern minimalism.
**Metaphor:** You're operating classified radio equipment, not using an app.

### The Two Modes

**Equipment Interface** — The app itself. Cold. Functional. Military.

**Archivist Voice** — The AI-generated notes. Warm. Curious. NPR.

Think: The hardware is a Cold War-era receiver. The Archivist is the late-night radio host who knows every record in the archive.

### Terminology

| Don't Say | Say Instead |
|-----------|-------------|
| Video | Frequency |
| Play | Transmit |
| Pause | Halt |
| Stop | Kill |
| Save/Favorite | Lock Signal |
| Bookmark | Mark Signal |
| Audio | Signal |
| Loading | Scanning |
| Error | Signal Lost |
| Volume | VOL |
| Settings | Configuration |

---

## Color Palette

### Primary

```css
--black: #000000;        /* Background */
--amber-500: #f59e0b;    /* Primary accent — THE color */
--amber-400: #fbbf24;    /* Hover states */
--amber-300: #fcd34d;    /* Highlights (rare) */
```

### Neutrals (Zinc Scale)

```css
--zinc-950: #09090b;     /* Cards, elevated surfaces */
--zinc-900: #18181b;     /* Secondary backgrounds */
--zinc-800: #27272a;     /* Borders, dividers */
--zinc-700: #3f3f46;     /* Subtle borders, inactive */
--zinc-600: #52525b;     /* Disabled, tertiary text */
--zinc-500: #71717a;     /* Secondary text */
--zinc-400: #a1a1aa;     /* Body text */
--zinc-300: #d4d4d8;     /* Primary text */
--zinc-200: #e4e4e7;     /* Headlines */
--zinc-100: #f4f4f5;     /* Maximum contrast (rare) */
```

### Usage Rules

1. **Amber is sacred** — Use sparingly. Only for:
   - Active/transmitting states
   - Primary CTAs
   - Status indicators
   - The playhead
   - Stars/marks

2. **No other colors** — No red errors, no green success. Everything is amber or zinc.

3. **Glow effects** — Amber elements get `box-shadow: 0 0 Xpx var(--amber-500)`

---

## Typography

### Font Stack

```css
/* Primary — Everything */
font-family: 'JetBrains Mono', 'SF Mono', 'Consolas', monospace;

/* Headlines — Landing page only */
font-family: 'Instrument Serif', Georgia, serif;
font-style: italic;
```

### Scale

| Use | Size | Weight | Tracking | Transform |
|-----|------|--------|----------|-----------|
| Hero headline | 40-72px | 400 | -0.02em | None |
| Section headline | 36px | 400 | -0.02em | None |
| Card title | 11px | 500 | 0.15em | UPPERCASE |
| Body text | 14px | 400 | 0 | None |
| Labels | 10-11px | 400 | 0.1-0.15em | UPPERCASE |
| Micro text | 8-10px | 400 | 0.1em | UPPERCASE |

### Rules

1. **Monospace everywhere** in the app
2. **Serif italic only** for landing page headlines
3. **ALL CAPS** for labels, buttons, status text
4. **Letter-spacing increases** as size decreases
5. **No bold** — Use color/caps for emphasis instead

---

## Spacing

### Base Unit: 8px

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
--space-32: 128px;
```

### Application

| Element | Padding | Gap |
|---------|---------|-----|
| Page container | 24px horizontal | — |
| Section | 100px vertical | — |
| Card | 32px | — |
| Button | 14px 28px | 10px (icon) |
| Input | 12-16px | — |
| Feature grid | — | 24px |
| Inline elements | — | 8-16px |

---

## Components

### Buttons

```css
/* Base */
.btn {
  padding: 14px 28px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-radius: 6px;
  transition: all 0.2s;
}

/* Primary — Amber */
.btn-primary {
  background: var(--amber-500);
  color: var(--black);
  border: 1px solid var(--amber-500);
}

.btn-primary:hover {
  background: var(--amber-400);
}

/* Secondary — Ghost */
.btn-secondary {
  background: transparent;
  color: var(--zinc-400);
  border: 1px solid var(--zinc-700);
}

.btn-secondary:hover {
  border-color: var(--zinc-500);
  color: var(--zinc-300);
}

/* Hardware — App buttons */
.btn-hardware {
  background: var(--zinc-900);
  border: 1px solid var(--zinc-700);
  color: var(--zinc-400);
  padding: 10px 16px;
  border-radius: 0; /* Sharp corners in app */
}

.btn-hardware.active {
  border-color: var(--amber-500);
  color: var(--amber-500);
}
```

### Cards

```css
.card {
  background: var(--zinc-950);
  border: 1px solid var(--zinc-800);
  padding: 32px;
}

.card:hover {
  border-color: var(--zinc-700);
}

/* No border-radius in app, 0-6px on landing */
```

### Inputs

```css
.input {
  background: var(--zinc-900);
  border: 1px solid var(--zinc-700);
  color: var(--zinc-300);
  padding: 12px 16px;
  font-family: inherit;
  font-size: 14px;
}

.input:focus {
  border-color: var(--amber-500);
  outline: none;
}

.input::placeholder {
  color: var(--zinc-600);
  text-transform: uppercase;
}
```

### Status Indicators

```css
/* Dot indicator */
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--zinc-600);
}

.status-dot.active {
  background: var(--amber-500);
  box-shadow: 0 0 6px var(--amber-500);
}

/* Pulsing animation */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.status-dot.transmitting {
  animation: pulse 2s ease-in-out infinite;
}
```

### Timeline/Visualizer

```css
.timeline {
  height: 32px;
  background: var(--zinc-800);
  position: relative;
}

.timeline-progress {
  background: var(--zinc-600);
  height: 100%;
}

.timeline-playhead {
  width: 2px;
  height: 100%;
  background: var(--amber-500);
}

.timeline-star {
  width: 3px;
  height: 12px;
  background: var(--amber-500);
  box-shadow: 0 0 6px var(--amber-500);
}
```

---

## Effects

### CRT Scanlines

```css
.scanlines {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.1),
    rgba(0, 0, 0, 0.1) 1px,
    transparent 1px,
    transparent 2px
  );
  z-index: 1000;
}
```

### Ambient Glow

```css
.glow {
  position: fixed;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(245, 158, 11, 0.08) 0%,
    transparent 70%
  );
  pointer-events: none;
}
```

### Card Shadow (Landing)

```css
.preview-frame {
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.03),
    0 20px 50px -20px rgba(0, 0, 0, 0.5),
    0 0 100px -50px rgba(245, 158, 11, 0.15);
}
```

### Selection

```css
::selection {
  background: var(--amber-500);
  color: var(--black);
}
```

---

## Layout

### Container

```css
.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 24px;
}
```

### Grid

```css
/* Features */
.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

/* 2-column for problem section */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
}

/* Responsive */
@media (max-width: 768px) {
  .features-grid,
  .two-col {
    grid-template-columns: 1fr;
  }
}
```

---

## Iconography

### Style

- **Stroke-based** — Not filled
- **Stroke width:** 1.5px
- **Size:** 16-20px typical, 40px for feature icons
- **Color:** Amber for active, zinc-500/600 for inactive

### Core Icons

| Function | Icon | Source |
|----------|------|--------|
| Radio/App | Circle + crosshairs | Custom |
| Transmit | Play triangle | Lucide |
| Halt | Pause bars | Lucide |
| Star/Mark | 5-point star | Lucide |
| Volume | Speaker waves | Lucide |
| Mute | Speaker X | Lucide |
| Settings | Gear | Lucide |
| Skip | Double arrows | Lucide |

---

## Motion

### Principles

1. **Instant over smooth** — State changes are immediate
2. **Pulse over bounce** — Subtle opacity, not elastic
3. **Functional only** — Animation serves feedback, not decoration

### Allowed Animations

```css
/* Status pulse */
animation: pulse 2s ease-in-out infinite;

/* Scanning/loading */
animation: scanning 1s ease-in-out infinite;

/* Typewriter (archivist notes) */
animation: typewriter 2s steps(40, end);

/* Cursor blink */
animation: blink 1s infinite;
```

### Transitions

```css
/* Hover states only */
transition: all 0.2s;

/* Or none at all */
transition: none;
```

---

## Copy Guidelines

### Tone

- **Technical** — Like a manual, not marketing
- **Understated** — State facts, don't hype
- **Dry humor** — Subtle, not cute
- **No emojis** — Ever
- **No exclamation marks** — Ever

### Headlines

```
✓ "Extract frequencies from the noise"
✓ "YouTube wasn't built for listening"
✓ "Field equipment specifications"

✗ "The BEST way to listen to YouTube!"
✗ "You'll LOVE this app!"
✗ "Amazing features 🎉"
```

### Microcopy

```
✓ "Transmitting"
✓ "Signal locked"
✓ "Awaiting signal"
✓ "Configuration"

✗ "Playing..."
✗ "Saved to favorites!"
✗ "Loading, please wait"
✗ "Settings"
```

### Error States

```
✓ "Signal lost"
✓ "Frequency not found"
✓ "Archivist offline"

✗ "Oops! Something went wrong"
✗ "Error 404"
✗ "Please try again later"
```

---

## File Structure

```
aviram-radio/
├── public/
│   ├── favicon.svg          # Radio icon
│   └── assets/
│       └── og-image.png     # Social preview
├── src/
│   ├── index.css            # Global styles + effects
│   ├── constants/
│   │   ├── theme.ts         # Color tokens
│   │   ├── microcopy.ts     # All UI text
│   │   └── keyboard.ts      # Shortcuts
│   └── components/
├── landing.html             # Marketing page
├── README.md                # Docs
└── STYLE-GUIDE.md           # This file
```

---

## Quick Reference

### The Rules

1. **Amber is the only accent color**
2. **Monospace everything**
3. **ALL CAPS for labels**
4. **No smooth transitions in app**
5. **Military terminology always**
6. **No emojis, no exclamation marks**
7. **Generous spacing, minimal density**
8. **Borders over shadows (in app)**
9. **Function over decoration**
10. **When in doubt, remove it**

### The Feeling

You're not using an app. You're operating equipment.

The interface doesn't try to delight you. It tries to disappear.

Every pixel serves the signal.

---

---

## Archivist Voice

The AI Archivist writes **NPR-style audio blurbs**, not museum placards.

### Reference Vibes

- **NPR Tiny Desk** — Artist introductions, warm context
- **RadioLab** — Curious, story-driven, finds the interesting angle
- **All Songs Considered** — Texture descriptions, emotional landscape
- **Late-night college radio DJ** — Knowledgeable but not pretentious

### Tone Spectrum

```
Museum Placard ←——————————————→ NPR Blurb
(cold, scholarly)              (warm, curious)
                    ↑
              Archivist lives here
```

### What It Should Feel Like

> "You know that moment at 2am when the DJ says something that makes you
> hear the song completely differently? That's the Archivist."

### Example Output

**Too Museum:**
> "This work exemplifies the 2010s vaporwave movement's excavation of 80s commercial aesthetics, repurposed as ambient meditation."

**Just Right (NPR):**
> "There's something about the way the synths sit just behind the beat — unhurried, like they know you're not going anywhere. Producer [X] built this from samples of forgotten department store muzak, and somehow it became the soundtrack to a million late-night coding sessions."

### Writing Guidelines

1. **Start with texture** — What does it *sound* like?
2. **Find the story** — Who made this? Why? What's interesting?
3. **Connect to feeling** — When/where would you listen?
4. **One surprising detail** — The thing that makes you lean in
5. **No academic jargon** — "Liminal" is banned

### Prompt Engineering Notes

The `ArchivistService.ts` system prompt should emphasize:
- Conversational, not scholarly
- Curious, not authoritative
- Specific sensory details over genre labels
- Human context (who listens to this, when, why)

---

*Style guide v1.0 — Aviram Radio*
