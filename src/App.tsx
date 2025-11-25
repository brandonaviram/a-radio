import { useState, useEffect, useCallback, useMemo } from 'react'
import { Radio, Volume2, VolumeX, Play, Pause, Star, SkipBack, SkipForward, Settings, Download, Upload, Tv } from 'lucide-react'
import { useYouTubePlayer, extractVideoId } from './hooks/useYouTubePlayer'
import { StorageManager } from './services/StorageManager'
import { ArchivistService } from './services/ArchivistService'
import { SignalVisualizer, ArchivistLog, RetroTV } from './components'
import { COPY } from './constants/microcopy'
import { KEYBOARD_SHORTCUTS, SEEK_AMOUNT } from './constants/keyboard'

type ViewMode = 'receiver' | 'settings'

function App() {
  const [playerState, controls] = useYouTubePlayer()
  const [inputUrl, setInputUrl] = useState('')
  const [frequencies, setFrequencies] = useState(StorageManager.getAllFrequencies())
  const [currentTitle, setCurrentTitle] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('receiver')

  // AI Archivist state
  const [archivistNotes, setArchivistNotes] = useState<string | null>(null)
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)

  // Settings state
  const [apiKey, setApiKey] = useState('')
  const [apiProvider, setApiProvider] = useState<'openai' | 'anthropic'>('anthropic')

  // RetroTV state
  const [showTV, setShowTV] = useState(false)

  // Check if current video is locked (favorited)
  const isLocked = playerState.videoId
    ? StorageManager.isFrequencyLocked(playerState.videoId)
    : false

  // Get stars and peaks for current video
  const currentStars = useMemo(() => {
    if (!playerState.videoId) return []
    return StorageManager.getStars(playerState.videoId)
  }, [playerState.videoId, frequencies])

  const currentPeaks = useMemo(() => {
    if (!playerState.videoId) return []
    return StorageManager.calculatePeaks(playerState.videoId)
  }, [playerState.videoId, frequencies])

  // Get status display text
  const getStatusText = () => {
    switch (playerState.status) {
      case 'transmitting': return COPY.TRANSMIT
      case 'halted': return COPY.HALT
      case 'scanning': return COPY.SCANNING
      case 'signal-lost': return COPY.SIGNAL_LOST
      default: return COPY.IDLE
    }
  }

  // Fetch video title and AI notes for current video
  const fetchArchivistNotes = useCallback(async (videoId: string) => {
    // Always fetch title first (oEmbed doesn't need API key)
    try {
      const metadata = await ArchivistService.fetchVideoMetadata(videoId)
      setCurrentTitle(metadata.title || null)
    } catch (error) {
      console.error('Failed to fetch video title:', error)
    }

    // Check cache for AI notes
    const cached = StorageManager.getArchivistNotes(videoId)
    if (cached) {
      setArchivistNotes(cached)
      return
    }

    // Only generate AI notes if configured
    if (!ArchivistService.isConfigured()) {
      setArchivistNotes('// ARCHIVIST OFFLINE - CONFIGURE API KEY')
      return
    }

    setIsLoadingNotes(true)
    setArchivistNotes(null)

    try {
      const metadata = await ArchivistService.fetchVideoMetadata(videoId)
      const notes = await ArchivistService.generateNotes(metadata)
      setArchivistNotes(notes)

      // Cache the notes
      if (!notes.startsWith('//')) {
        StorageManager.setArchivistNotes(videoId, notes)
      }
    } catch (error) {
      console.error('Failed to fetch archivist notes:', error)
      setArchivistNotes('// SIGNAL ANALYSIS FAILED')
    } finally {
      setIsLoadingNotes(false)
    }
  }, [])

  // Load a frequency
  const loadFrequency = useCallback((url: string) => {
    const videoId = extractVideoId(url)
    if (videoId) {
      controls.loadVideo(videoId)
      setCurrentTitle(null)
      setArchivistNotes(null)
      StorageManager.setLastVideoId(videoId)

      // Fetch title and notes
      fetchArchivistNotes(videoId)
    }
  }, [controls, fetchArchivistNotes])

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputUrl.trim()) {
      loadFrequency(inputUrl.trim())
      setInputUrl('')
    }
  }

  // Toggle signal lock (favorite)
  const toggleLock = useCallback(() => {
    if (!playerState.videoId) return

    if (isLocked) {
      StorageManager.removeFrequency(playerState.videoId)
    } else {
      StorageManager.addFrequency(playerState.videoId, currentTitle || `Frequency ${playerState.videoId}`)
    }
    setFrequencies(StorageManager.getAllFrequencies())
  }, [playerState.videoId, isLocked, currentTitle])

  // Mark signal (add star at current time)
  const markSignal = useCallback(() => {
    if (!playerState.videoId) return
    StorageManager.addStar(playerState.videoId, playerState.currentTime)
    setFrequencies(StorageManager.getAllFrequencies())
  }, [playerState.videoId, playerState.currentTime])

  // Peak navigation
  const navigateToPeak = useCallback((direction: 'prev' | 'next') => {
    if (currentPeaks.length === 0) return

    const currentTime = playerState.currentTime
    let targetPeak: number | undefined

    if (direction === 'next') {
      targetPeak = currentPeaks.find(peak => peak > currentTime + 1)
      if (!targetPeak) targetPeak = currentPeaks[0] // Loop to first
    } else {
      const reversedPeaks = [...currentPeaks].reverse()
      targetPeak = reversedPeaks.find(peak => peak < currentTime - 1)
      if (!targetPeak) targetPeak = currentPeaks[currentPeaks.length - 1] // Loop to last
    }

    if (targetPeak !== undefined) {
      controls.seekTo(targetPeak)
    }
  }, [currentPeaks, playerState.currentTime, controls])

  // Configure Archivist and persist to storage
  const configureArchivist = useCallback(() => {
    if (apiKey.trim()) {
      const config = {
        apiKey: apiKey.trim(),
        provider: apiProvider
      }
      ArchivistService.configure(config)
      StorageManager.setApiConfig(config) // Persist to localStorage
      setViewMode('receiver')

      // Re-fetch notes if we have a video
      if (playerState.videoId) {
        fetchArchivistNotes(playerState.videoId)
      }
    }
  }, [apiKey, apiProvider, playerState.videoId, fetchArchivistNotes])

  // Export data
  const handleExport = useCallback(() => {
    const data = StorageManager.exportData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'aviram-radio-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // Import data
  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const text = await file.text()
        if (StorageManager.importData(text)) {
          setFrequencies(StorageManager.getAllFrequencies())
          alert('Data imported successfully')
        } else {
          alert('Failed to import data')
        }
      }
    }
    input.click()
  }, [])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case KEYBOARD_SHORTCUTS.TOGGLE_TRANSMISSION:
          e.preventDefault()
          controls.togglePlayPause()
          break
        case KEYBOARD_SHORTCUTS.SEEK_BACK:
          e.preventDefault()
          controls.seek(-SEEK_AMOUNT)
          break
        case KEYBOARD_SHORTCUTS.SEEK_FORWARD:
          e.preventDefault()
          controls.seek(SEEK_AMOUNT)
          break
        case KEYBOARD_SHORTCUTS.PREV_PEAK:
          e.preventDefault()
          navigateToPeak('prev')
          break
        case KEYBOARD_SHORTCUTS.NEXT_PEAK:
          e.preventDefault()
          navigateToPeak('next')
          break
        case KEYBOARD_SHORTCUTS.MARK_SIGNAL:
          e.preventDefault()
          markSignal()
          break
        case KEYBOARD_SHORTCUTS.KILL_AUDIO:
          e.preventDefault()
          controls.toggleMute()
          break
        case KEYBOARD_SHORTCUTS.LOCK_SIGNAL:
          e.preventDefault()
          toggleLock()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [controls, markSignal, toggleLock, navigateToPeak])

  // Load last video on mount
  useEffect(() => {
    const lastVideoId = StorageManager.getLastVideoId()
    if (lastVideoId) {
      controls.loadVideo(lastVideoId)
      fetchArchivistNotes(lastVideoId)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize volume from storage
  useEffect(() => {
    const savedVolume = StorageManager.getVolume()
    controls.setVolume(savedVolume * 100)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load API config from storage on mount
  useEffect(() => {
    const savedConfig = StorageManager.getApiConfig()
    if (savedConfig) {
      setApiKey(savedConfig.apiKey)
      setApiProvider(savedConfig.provider)
      ArchivistService.configure(savedConfig)
      console.log('[App] Loaded API config from storage')
    }
  }, [])

  return (
    <div className="min-h-screen bg-black text-zinc-400 font-mono p-6 flex flex-col">
      {/* CRT Overlay */}
      <div className="crt-overlay" />

      {/* Retro TV Monitor - Synced with main player */}
      <RetroTV
        videoId={playerState.videoId}
        isPlaying={playerState.isPlaying}
        isMuted={playerState.isMuted}
        currentTime={playerState.currentTime}
        isVisible={showTV}
        onClose={() => setShowTV(false)}
      />

      {/* Header */}
      <header className="flex items-center justify-between mb-8 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Radio className="w-5 h-5 text-amber-500" strokeWidth={1.5} />
          <h1 className="text-xs uppercase tracking-[0.3em] text-zinc-300">
            AVIRAM RADIO
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="status-indicator">
            <span className={`status-dot ${playerState.status === 'transmitting' ? 'active' : playerState.status === 'signal-lost' ? 'error' : ''}`} />
            <span className={playerState.status === 'transmitting' ? 'text-amber-500' : ''}>
              {getStatusText()}
            </span>
          </div>
          <button
            onClick={() => setShowTV(!showTV)}
            className={`p-2 ${showTV ? 'text-amber-500' : 'text-zinc-600 hover:text-zinc-400'}`}
            title="Toggle Monitor"
          >
            <Tv className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'settings' ? 'receiver' : 'settings')}
            className={`p-2 ${viewMode === 'settings' ? 'text-amber-500' : 'text-zinc-600 hover:text-zinc-400'}`}
            title="Settings"
          >
            <Settings className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col gap-6">

        {viewMode === 'settings' ? (
          /* Settings Panel */
          <section className="border border-zinc-800 p-6">
            <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-4">
              ARCHIVIST CONFIGURATION
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-600 mb-2">
                  API Provider
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setApiProvider('anthropic')}
                    className={`btn-hardware ${apiProvider === 'anthropic' ? 'active' : ''}`}
                  >
                    Anthropic
                  </button>
                  <button
                    onClick={() => setApiProvider('openai')}
                    className={`btn-hardware ${apiProvider === 'openai' ? 'active' : ''}`}
                  >
                    OpenAI
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-600 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter API key..."
                  className="input-frequency"
                />
              </div>

              <button
                onClick={configureArchivist}
                className="btn-hardware active w-full"
                disabled={!apiKey.trim()}
              >
                CONFIGURE ARCHIVIST
              </button>

              <div className="border-t border-zinc-800 pt-4 mt-4">
                <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">
                  DATA OPERATIONS
                </div>
                <div className="flex gap-2">
                  <button onClick={handleExport} className="btn-hardware flex items-center gap-2">
                    <Download className="w-3 h-3" />
                    {COPY.DUMP_DATA}
                  </button>
                  <button onClick={handleImport} className="btn-hardware flex items-center gap-2">
                    <Upload className="w-3 h-3" />
                    {COPY.LOAD_DATA}
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Frequency Input */}
            <section>
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder={COPY.ENTER_FREQUENCY}
                  className="input-frequency flex-1"
                />
                <button type="submit" className="btn-hardware">
                  TUNE
                </button>
              </form>
            </section>

            {/* Now Playing */}
            {playerState.videoId && (
              <section className="border border-zinc-800 p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">
                      {COPY.RECEIVER}
                    </div>
                    <div className="text-sm text-zinc-300 font-medium">
                      {currentTitle || `ID: ${playerState.videoId}`}
                    </div>
                  </div>
                  <button
                    onClick={toggleLock}
                    className={`p-2 ${isLocked ? 'text-amber-500' : 'text-zinc-600 hover:text-zinc-400'}`}
                    title={isLocked ? COPY.UNLOCK_SIGNAL : COPY.LOCK_SIGNAL}
                  >
                    <Star className="w-4 h-4" fill={isLocked ? 'currentColor' : 'none'} strokeWidth={1.5} />
                  </button>
                </div>

                {/* Signal Visualizer */}
                <SignalVisualizer
                  currentTime={playerState.currentTime}
                  duration={playerState.duration}
                  peaks={currentPeaks}
                  stars={currentStars}
                  onSeek={(timestamp) => controls.seekTo(timestamp)}
                  onPrevPeak={() => navigateToPeak('prev')}
                  onNextPeak={() => navigateToPeak('next')}
                />

                {/* Controls */}
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => controls.seek(-SEEK_AMOUNT)}
                      className="btn-hardware p-2"
                      title="Seek back 10s"
                    >
                      <SkipBack className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={controls.togglePlayPause}
                      className={`btn-hardware p-3 ${playerState.isPlaying ? 'active' : ''}`}
                    >
                      {playerState.isPlaying ? (
                        <Pause className="w-5 h-5" strokeWidth={1.5} />
                      ) : (
                        <Play className="w-5 h-5" strokeWidth={1.5} />
                      )}
                    </button>
                    <button
                      onClick={() => controls.seek(SEEK_AMOUNT)}
                      className="btn-hardware p-2"
                      title="Seek forward 10s"
                    >
                      <SkipForward className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={markSignal}
                      className="btn-hardware text-[10px]"
                      title={COPY.MARK_SIGNAL}
                    >
                      {COPY.MARK_SIGNAL}
                    </button>
                    <button
                      onClick={controls.toggleMute}
                      className={`p-2 ${playerState.isMuted ? 'text-zinc-600' : 'text-zinc-400'}`}
                    >
                      {playerState.isMuted ? (
                        <VolumeX className="w-4 h-4" strokeWidth={1.5} />
                      ) : (
                        <Volume2 className="w-4 h-4" strokeWidth={1.5} />
                      )}
                    </button>
                    <div className="text-[10px] text-zinc-600 w-12 text-right">
                      {COPY.VOLUME} {Math.round(playerState.volume)}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Archivist Notes */}
            {playerState.videoId && (
              <ArchivistLog
                notes={archivistNotes}
                isLoading={isLoadingNotes}
                videoId={playerState.videoId}
              />
            )}

            {/* Saved Frequencies */}
            <section className="flex-1">
              <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">
                {COPY.SAVED_FREQUENCIES}
              </div>
              {frequencies.length === 0 ? (
                <div className="text-xs text-zinc-700 italic">
                  {COPY.NO_FREQUENCIES}
                </div>
              ) : (
                <div className="space-y-1">
                  {frequencies.map((freq) => (
                    <button
                      key={freq.videoId}
                      onClick={() => loadFrequency(freq.videoId)}
                      className={`w-full text-left p-3 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between group ${
                        playerState.videoId === freq.videoId ? 'border-amber-500/50 bg-amber-500/5' : ''
                      }`}
                    >
                      <span className="text-xs text-zinc-400 truncate flex-1 mr-4">
                        {freq.title}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                        {freq.stars.length > 0 && (
                          <span className="text-amber-500">{freq.stars.length} {COPY.PEAKS}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Footer - Keyboard hints */}
      <footer className="mt-6 pt-4 border-t border-zinc-800">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[10px] text-zinc-700 uppercase">
          <span>[SPACE] {COPY.TRANSMIT}/{COPY.HALT}</span>
          <span>[←/→] SEEK</span>
          <span>[S] {COPY.MARK_SIGNAL}</span>
          <span>[L] {COPY.LOCK_SIGNAL}</span>
          <span>[M] {COPY.KILL_AUDIO}</span>
          <span>[[/]] PEAKS</span>
        </div>
      </footer>
    </div>
  )
}

export default App
