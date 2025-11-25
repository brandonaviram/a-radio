import React, { useRef, useCallback } from 'react';

interface SignalVisualizerProps {
  currentTime: number;
  duration: number;
  peaks: number[];
  stars: { timestamp: number }[];
  onSeek: (timestamp: number) => void;
  onPrevPeak: () => void;
  onNextPeak: () => void;
}

/**
 * SignalVisualizer - Waveform-style timeline with peak markers
 *
 * Shows playback progress, star markers, and highlighted peak regions.
 * Click to seek, use brackets to navigate between peaks.
 */
export const SignalVisualizer: React.FC<SignalVisualizerProps> = ({
  currentTime,
  duration,
  peaks,
  stars,
  onSeek,
  onPrevPeak,
  onNextPeak,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle timeline click to seek
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration === 0) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = clickX / rect.width;
    const seekTime = clickPercent * duration;

    onSeek(Math.max(0, Math.min(duration, seekTime)));
  }, [duration, onSeek]);

  // Check if a timestamp is a peak
  const isPeak = useCallback((timestamp: number): boolean => {
    return peaks.some(peak => Math.abs(peak - timestamp) < 1);
  }, [peaks]);

  return (
    <div className="w-full bg-zinc-900 border border-zinc-800 p-3">
      {/* Peak Navigation Indicators */}
      {peaks.length > 0 && (
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={onPrevPeak}
            className="text-[10px] text-zinc-600 hover:text-amber-500 uppercase tracking-wider"
            title="Previous peak ([)"
          >
            [ PREV PEAK
          </button>
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider">
            {peaks.length} PEAK{peaks.length !== 1 ? 'S' : ''} DETECTED
          </div>
          <button
            onClick={onNextPeak}
            className="text-[10px] text-zinc-600 hover:text-amber-500 uppercase tracking-wider"
            title="Next peak (])"
          >
            NEXT PEAK ]
          </button>
        </div>
      )}

      {/* Timeline Container */}
      <div className="relative">
        {/* Timeline Track */}
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="relative h-8 bg-zinc-800 cursor-pointer"
        >
          {/* Progress Fill */}
          <div
            className="absolute top-0 left-0 h-full bg-zinc-600 transition-none"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Star Markers */}
          {stars.map((star) => {
            const position = duration > 0 ? (star.timestamp / duration) * 100 : 0;
            const isStarPeak = isPeak(star.timestamp);

            return (
              <div
                key={`star-${star.timestamp}`}
                className={`absolute top-1/2 -translate-y-1/2 ${
                  isStarPeak
                    ? 'w-1 h-3 peak-marker'
                    : 'w-0.5 h-2 bg-zinc-500'
                }`}
                style={{ left: `${position}%` }}
                title={`Star at ${formatTime(star.timestamp)}`}
              />
            );
          })}

          {/* Playhead */}
          <div
            className="absolute top-0 w-0.5 h-full bg-amber-500"
            style={{ left: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Time Display */}
      <div className="flex justify-between mt-2">
        <div className="text-[10px] text-zinc-600 uppercase tracking-wider">
          {formatTime(currentTime)}
        </div>
        <div className="text-[10px] text-zinc-600 uppercase tracking-wider">
          {formatTime(duration)}
        </div>
      </div>
    </div>
  );
};
