import { useState, useEffect, useRef, useCallback } from 'react'
import { Power, VolumeX, Minimize2, X } from 'lucide-react'

// YouTube IFrame API types
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string | HTMLElement,
        config: {
          videoId?: string
          playerVars?: Record<string, number | string>
          events?: {
            onReady?: (event: { target: YTPlayer }) => void
            onStateChange?: (event: { data: number }) => void
          }
        }
      ) => YTPlayer
      PlayerState: {
        PLAYING: number
        PAUSED: number
        BUFFERING: number
        ENDED: number
      }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void
  loadVideoById: (videoId: string, startSeconds?: number) => void
  mute: () => void
  unMute: () => void
  getPlayerState: () => number
  getCurrentTime: () => number
  destroy: () => void
}

interface RetroTVProps {
  videoId: string | null
  isPlaying: boolean
  isMuted: boolean
  currentTime: number
  isVisible: boolean
  onClose: () => void
}

interface Position {
  x: number
  y: number
}

const STORAGE_KEY = 'retro-tv-position'
const TV_WIDTH = 320
const TV_HEIGHT = 240
const MINIMIZED_SIZE = 48
const SYNC_THRESHOLD = 2 // seconds - seek if drift exceeds this

// Load YouTube IFrame API script once
let apiLoaded = false
let apiReady = false
const apiReadyCallbacks: (() => void)[] = []

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (apiReady) {
      resolve()
      return
    }

    apiReadyCallbacks.push(resolve)

    if (!apiLoaded) {
      apiLoaded = true
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

      window.onYouTubeIframeAPIReady = () => {
        apiReady = true
        apiReadyCallbacks.forEach((cb) => cb())
        apiReadyCallbacks.length = 0
      }
    }
  })
}

export function RetroTV({ videoId, isPlaying, isMuted, currentTime, isVisible, onClose }: RetroTVProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [position, setPosition] = useState<Position>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
    return {
      x: window.innerWidth - TV_WIDTH - 32,
      y: window.innerHeight - TV_HEIGHT - 32,
    }
  })
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 })

  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const lastSyncedTime = useRef<number>(0)

  // Initialize YouTube player
  useEffect(() => {
    if (!isVisible || isMinimized || !videoId) return

    let mounted = true

    loadYouTubeAPI().then(() => {
      if (!mounted || !playerContainerRef.current) return

      // Destroy existing player if any
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }

      playerRef.current = new window.YT.Player(playerContainerRef.current, {
        videoId,
        playerVars: {
          autoplay: isPlaying ? 1 : 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          playsinline: 1,
          start: Math.floor(currentTime),
        },
        events: {
          onReady: () => {
            if (!mounted) return
            setIsPlayerReady(true)
            // Always mute - main player handles audio
            playerRef.current?.mute()
            if (isPlaying) {
              playerRef.current?.playVideo()
            }
          },
        },
      })
    })

    return () => {
      mounted = false
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
        setIsPlayerReady(false)
      }
    }
  }, [isVisible, isMinimized, videoId]) // Recreate player when video changes

  // Sync play/pause state
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return

    if (isPlaying) {
      playerRef.current.playVideo()
    } else {
      playerRef.current.pauseVideo()
    }
  }, [isPlaying, isPlayerReady])

  // Sync playhead position - smooth seeking without reload
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return

    const timeDiff = Math.abs(currentTime - lastSyncedTime.current)

    // Seek if drift exceeds threshold (manual seek or significant drift)
    if (timeDiff > SYNC_THRESHOLD) {
      playerRef.current.seekTo(currentTime, true)
    }

    lastSyncedTime.current = currentTime
  }, [currentTime, isPlayerReady])

  // Persist position to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position))
  }, [position])

  // Constrain position within viewport bounds
  const constrainPosition = useCallback((pos: Position): Position => {
    const width = isMinimized ? MINIMIZED_SIZE : TV_WIDTH
    const height = isMinimized ? MINIMIZED_SIZE : TV_HEIGHT

    return {
      x: Math.max(0, Math.min(pos.x, window.innerWidth - width)),
      y: Math.max(0, Math.min(pos.y, window.innerHeight - height)),
    }
  }, [isMinimized])

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    setDragOffset({
      x: clientX - position.x,
      y: clientY - position.y,
    })
  }

  // Handle dragging via mouse/touch move
  useEffect(() => {
    if (!isDragging) return

    let animationFrameId: number

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

      // Use requestAnimationFrame for smooth dragging
      cancelAnimationFrame(animationFrameId)
      animationFrameId = requestAnimationFrame(() => {
        const newPos = constrainPosition({
          x: clientX - dragOffset.x,
          y: clientY - dragOffset.y,
        })
        setPosition(newPos)
      })
    }

    const handleEnd = () => {
      setIsDragging(false)
      cancelAnimationFrame(animationFrameId)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleEnd)
    window.addEventListener('touchmove', handleMove)
    window.addEventListener('touchend', handleEnd)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleEnd)
      cancelAnimationFrame(animationFrameId)
    }
  }, [isDragging, dragOffset, constrainPosition])

  // Re-constrain position on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => constrainPosition(prev))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [constrainPosition])

  // Toggle minimize
  const toggleMinimize = () => {
    setIsMinimized(!isMinimized)
    // Re-constrain after size change
    setTimeout(() => {
      setPosition(prev => constrainPosition(prev))
    }, 0)
  }

  if (!isVisible) return null

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isMinimized ? `${MINIMIZED_SIZE}px` : `${TV_WIDTH}px`,
        height: isMinimized ? `${MINIMIZED_SIZE}px` : `${TV_HEIGHT}px`,
        zIndex: 1000,
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: isMinimized ? 'width 0.2s, height 0.2s' : 'none',
      }}
      className="font-mono select-none"
    >
      {/* CRT TV Bezel */}
      <div
        className="relative w-full h-full bg-zinc-900 border-2 border-zinc-800 rounded-xl shadow-2xl"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        {!isMinimized ? (
          <>
            {/* Top label with "MONITOR" text */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-zinc-900 px-3 py-0.5 border border-zinc-800 rounded">
              <span className="text-[10px] text-zinc-600 uppercase tracking-[0.3em]">
                MONITOR
              </span>
            </div>

            {/* Power LED indicator (glows amber when playing) */}
            <div className="absolute top-2 right-2 flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  isPlaying
                    ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                    : 'bg-zinc-800'
                }`}
              />
              <span className="text-[8px] text-zinc-700 uppercase tracking-wider">PWR</span>
            </div>

            {/* CRT Screen with video */}
            <div className="absolute top-10 left-3 right-3 bottom-10 bg-black border border-zinc-800 overflow-hidden">
              {/* CRT Screen glow effect when playing */}
              {isPlaying && (
                <div className="absolute inset-0 bg-amber-500/5 pointer-events-none z-10" />
              )}

              {/* Scanlines overlay (CRT effect) */}
              <div
                className="absolute inset-0 pointer-events-none z-20"
                style={{
                  background: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.15) 1px, transparent 1px, transparent 2px)'
                }}
              />

              {/* Video content or No Signal */}
              {videoId ? (
                <div
                  ref={playerContainerRef}
                  className="w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[10px] text-zinc-700 uppercase tracking-widest">
                    NO SIGNAL
                  </span>
                </div>
              )}
            </div>

            {/* Faux hardware knobs on the side (decorative) */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-3">
              <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 shadow-inner flex items-center justify-center">
                <div className="w-0.5 h-2 bg-zinc-600" />
              </div>
              <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 shadow-inner flex items-center justify-center">
                <div className="w-0.5 h-2 bg-zinc-600" />
              </div>
            </div>

            {/* Status bar at bottom */}
            <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
              {/* Status indicator */}
              <div className="flex items-center gap-2">
                <span className={`text-[8px] uppercase tracking-wider ${isPlaying ? 'text-amber-500' : 'text-zinc-700'}`}>
                  {isPlaying ? 'TRANSMITTING' : 'STANDBY'}
                </span>
                {isMuted && (
                  <VolumeX className="w-3 h-3 text-zinc-600" strokeWidth={1.5} />
                )}
              </div>

              {/* Window controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleMinimize()
                  }}
                  className="p-1 bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-zinc-500 hover:text-amber-500"
                  title="Minimize"
                >
                  <Minimize2 className="w-2.5 h-2.5" strokeWidth={1.5} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose()
                  }}
                  className="p-1 bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-zinc-500 hover:text-red-500"
                  title="Close"
                >
                  <X className="w-2.5 h-2.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </>
        ) : (
          // Minimized state - just show power icon
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleMinimize()
            }}
            className="w-full h-full flex items-center justify-center bg-zinc-900 border-2 border-zinc-800 rounded-xl hover:border-zinc-700"
            title="Restore monitor"
          >
            <Power
              className={`w-6 h-6 ${isPlaying ? 'text-amber-500' : 'text-zinc-600'}`}
              strokeWidth={1.5}
            />
          </button>
        )}
      </div>
    </div>
  )
}
