export const KEYBOARD_SHORTCUTS = {
  TOGGLE_TRANSMISSION: ' ', // Space
  SEEK_BACK: 'ArrowLeft',
  SEEK_FORWARD: 'ArrowRight',
  PREV_PEAK: '[',
  NEXT_PEAK: ']',
  MARK_SIGNAL: 's',
  KILL_AUDIO: 'm',
  LOCK_SIGNAL: 'l', // Add to favorites
  DUMP_DATA: 'd', // Export (with modifier)
} as const;

export const SEEK_AMOUNT = 10; // seconds
