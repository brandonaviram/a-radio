# AVIRAM RADIO Style Guide

> Signal Interceptor Design System

## Design Philosophy

**Core Concept:** A CRT-era signal monitoring station. Hardware feel. Tactical. No decorative fluff.

**Principles:**
1. **Hardware over software** - Buttons should feel like physical switches
2. **No smooth transitions** - Instant state changes (like old hardware)
3. **Monospace everything** - Technical, utilitarian typography
4. **Amber is sacred** - Single accent color, use sparingly
5. **CRT authenticity** - Scanlines, glow, phosphor burn-in feel

---

## Color Palette

### Base Colors (Zinc Scale)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-black` | `#000000` | Background |
| `--color-zinc-900` | `#18181b` | Panels, inputs |
| `--color-zinc-800` | `#27272a` | Borders, dividers |
| `--color-zinc-700` | `#3f3f46` | Hover states |
| `--color-zinc-600` | `#52525b` | Disabled, muted |
| `--color-zinc-500` | `#71717a` | Secondary text |
| `--color-zinc-400` | `#a1a1aa` | Body text |
| `--color-zinc-300` | `#d4d4d8` | Primary text |

### Accent Colors (Amber Only)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-amber-500` | `#f59e0b` | Primary accent, active states, LEDs |
| `--color-amber-400` | `#fbbf24` | Highlights, glow effects |

**Rule:** Amber is the ONLY accent color. No blues, greens, or reds except for error states.

---

## Typography

### Font Stack

```css
font-family: 'JetBrains Mono', 'Share Tech Mono', monospace;
```

### Scale

| Class | Size | Usage |
|-------|------|-------|
| `text-xs` | 12px | Body text, frequencies |
| `text-sm` | 14px | Titles, important labels |
| `text-[10px]` | 10px | Status labels, hints |

### Text Treatments

```css
/* Labels - Hardware Display Style */
.label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em; /* tracking-widest */
  color: var(--color-zinc-600);
}

/* Active/Highlighted Text */
.text-active {
  color: var(--color-amber-500);
}
```

---

## Components

### Buttons (Hardware Switches)

```css
.btn-hardware {
  background: var(--color-zinc-900);
  border: 1px solid var(--color-zinc-700);
  color: var(--color-zinc-400);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: none; /* IMPORTANT: No smooth transitions */
}

.btn-hardware:hover {
  background: var(--color-zinc-800);
  border-color: var(--color-zinc-600);
}

.btn-hardware:active {
  background: var(--color-zinc-700);
}

.btn-hardware.active {
  border-color: var(--color-amber-500);
  color: var(--color-amber-500);
}
```

### Inputs (Frequency Tuner)

```css
.input-frequency {
  background: var(--color-zinc-900);
  border: 1px solid var(--color-zinc-700);
  color: var(--color-zinc-300);
  font-family: inherit;
  padding: 0.75rem 1rem;
}

.input-frequency:focus {
  border-color: var(--color-amber-500);
  outline: none;
}

.input-frequency::placeholder {
  color: var(--color-zinc-600);
  text-transform: uppercase;
}
```

### Status Indicators

```html
<!-- Status with LED -->
<div class="status-indicator">
  <span class="status-dot active"></span>
  <span class="text-amber-500">TRANSMITTING</span>
</div>
```

```css
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-zinc-600);
}

.status-dot.active {
  background: var(--color-amber-500);
  box-shadow: 0 0 6px var(--color-amber-500); /* LED glow */
}

.status-dot.error {
  background: #ef4444;
  box-shadow: 0 0 6px #ef4444;
}
```

### Panels (Equipment Housings)

```jsx
<section className="border border-zinc-800 p-4">
  <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">
    PANEL LABEL
  </div>
  {/* Content */}
</section>
```

---

## Effects

### CRT Scanlines

Applied globally via `.crt-overlay`:

```css
.crt-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.15),
    rgba(0, 0, 0, 0.15) 1px,
    transparent 1px,
    transparent 2px
  );
  z-index: 9999;
}
```

### Amber Glow (LEDs, Active Elements)

```css
/* Power LED glow */
.led-glow {
  background: var(--color-amber-500);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.8);
}

/* Screen glow when active */
.screen-active {
  background: rgba(245, 158, 11, 0.05);
}

/* Peak markers */
.peak-marker {
  background: var(--color-amber-500);
  box-shadow: 0 0 8px var(--color-amber-500);
}
```

### Animations

```css
/* Signal lock pulse - for active transmission */
@keyframes signal-lock {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.signal-locked {
  animation: signal-lock 1.5s ease-in-out infinite;
}

/* Scanning - for loading states */
@keyframes scanning {
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
}

.scanning {
  animation: scanning 1s ease-in-out infinite;
}
```

---

## Layout Patterns

### Page Structure

```jsx
<div className="min-h-screen bg-black text-zinc-400 font-mono p-6 flex flex-col">
  {/* CRT Overlay - Always present */}
  <div className="crt-overlay" />

  {/* Header - Fixed height */}
  <header className="flex items-center justify-between mb-8 border-b border-zinc-800 pb-4">
    {/* Logo + Status */}
  </header>

  {/* Main - Flexible */}
  <main className="flex-1 flex flex-col gap-6">
    {/* Content sections */}
  </main>

  {/* Footer - Keyboard hints */}
  <footer className="mt-6 pt-4 border-t border-zinc-800">
    {/* Hints */}
  </footer>
</div>
```

### Section Headers

```jsx
<div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">
  SECTION LABEL
</div>
```

---

## Icons

Using `lucide-react` with consistent styling:

```jsx
import { Radio, Play, Pause, Volume2, VolumeX, Star, Settings } from 'lucide-react'

// Standard icon
<Radio className="w-4 h-4" strokeWidth={1.5} />

// Amber accent icon
<Radio className="w-5 h-5 text-amber-500" strokeWidth={1.5} />

// Filled state (favorites)
<Star className="w-4 h-4" fill={isActive ? 'currentColor' : 'none'} strokeWidth={1.5} />
```

**Standard sizes:**
- Small: `w-3 h-3`
- Default: `w-4 h-4`
- Large: `w-5 h-5`

**Stroke weight:** Always `strokeWidth={1.5}` for consistency.

---

## Microcopy

### Tone
- **Technical, terse, uppercase**
- Radio/signal interceptor terminology
- No friendly language ("Click here", "Welcome!")

### Examples

| Instead of | Use |
|------------|-----|
| "Play/Pause" | "TRANSMIT / HALT" |
| "Bookmark" | "LOCK SIGNAL" |
| "Loading..." | "SCANNING..." |
| "Enter URL" | "ENTER FREQUENCY" |
| "Favorites" | "SAVED FREQUENCIES" |
| "Mute" | "KILL AUDIO" |
| "Add marker" | "MARK SIGNAL" |
| "Export" | "DUMP DATA" |
| "Import" | "LOAD DATA" |

### Status Messages

```
TRANSMITTING    // Playing
HALTED          // Paused
SCANNING...     // Loading
SIGNAL LOST     // Error
STANDING BY     // Idle
```

---

## Spacing

Using Tailwind spacing scale:

| Class | Pixels | Usage |
|-------|--------|-------|
| `p-3` | 12px | Component internal padding |
| `p-4` | 16px | Panel padding |
| `p-6` | 24px | Page padding |
| `gap-2` | 8px | Tight element spacing |
| `gap-3` | 12px | Default element spacing |
| `gap-6` | 24px | Section spacing |
| `mb-8` | 32px | Major section margins |

---

## Z-Index Scale

| Layer | Z-Index | Usage |
|-------|---------|-------|
| Base | 0 | Default content |
| Elevated | 10 | Dropdowns, tooltips |
| Modal | 100 | Modals, dialogs |
| Floating | 1000 | Floating UI (RetroTV) |
| Overlay | 9999 | CRT scanlines |

---

## Component Inventory

| Component | File | Purpose |
|-----------|------|---------|
| `SignalVisualizer` | `components/SignalVisualizer.tsx` | Playback timeline with peaks |
| `ArchivistLog` | `components/ArchivistLog.tsx` | AI-generated notes display |
| `RetroTV` | `components/RetroTV.tsx` | Floating picture-in-picture video |

---

## Don'ts

1. **Don't use smooth transitions** - Hardware doesn't fade
2. **Don't use colors outside the palette** - Amber only
3. **Don't use friendly/casual copy** - Keep it technical
4. **Don't remove scanlines** - Core to the aesthetic
5. **Don't use rounded corners** (except RetroTV bezel) - Sharp edges
6. **Don't use shadows** (except amber glow) - Flat hardware look
7. **Don't use gradients** (except scanlines) - Solid colors only

---

## Quick Reference

```jsx
// Panel with label
<section className="border border-zinc-800 p-4">
  <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">
    LABEL
  </div>
  {/* Content */}
</section>

// Hardware button
<button className="btn-hardware">ACTION</button>
<button className="btn-hardware active">ACTIVE</button>

// Status indicator
<div className="status-indicator">
  <span className="status-dot active" />
  <span className="text-amber-500">STATUS</span>
</div>

// Input field
<input className="input-frequency" placeholder="ENTER FREQUENCY" />

// Icon
<Icon className="w-4 h-4" strokeWidth={1.5} />
```

---

*AVIRAM RADIO // SIGNAL INTERCEPTOR // v1.0*
