/**
 * Seed Frequencies - Pre-populated stations for first load
 *
 * These frequencies will be automatically added when the app
 * is loaded for the first time (empty localStorage).
 */

export interface SeedFrequency {
  videoId: string;
  title: string;
}

export const SEED_FREQUENCIES: SeedFrequency[] = [
  { videoId: 'w6H_OPzo9Gk', title: 'Greta Cozy Autumn Mix' },
  { videoId: 'jfKfPfyJRdk', title: 'Lofi HipHop Radio' },
  { videoId: 'fIWRqMLhWbI', title: 'Chris Luno Thailand' },
  { videoId: 'p4YOXmm839c', title: 'Sunrise House Mix' },
  { videoId: 'St7G1F4mu_4', title: 'Olivia Dean' },
  { videoId: 'W13Ydr_AcjI', title: 'Nikiri - Chill House' },
];
