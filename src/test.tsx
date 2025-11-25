import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { RetroTV } from './components/RetroTV'
import { useYouTubePlayer } from './hooks/useYouTubePlayer'
import { StorageManager } from './services/StorageManager'
import './index.css'

// Test video IDs
const TEST_VIDEOS = [
  { id: 'jfKfPfyJRdk', name: 'Lofi Girl' },
  { id: 'rUxyKA_-grg', name: 'Chillhop Radio' },
  { id: '5qap5aO4i9A', name: 'Lo-Fi Beats' },
]

function TestPage() {
  const [playerState, controls] = useYouTubePlayer()
  const [showTV, setShowTV] = useState(false)
  const [testResults, setTestResults] = useState<Array<{ name: string; status: 'pass' | 'fail' | 'pending'; message?: string }>>([])

  // Run tests on mount
  useEffect(() => {
    runTests()
  }, [])

  const runTests = async () => {
    const results: typeof testResults = []

    // Test 1: StorageManager
    try {
      StorageManager.setLastVideoId('test-video')
      const retrieved = StorageManager.getLastVideoId()
      results.push({
        name: 'StorageManager: save/load video ID',
        status: retrieved === 'test-video' ? 'pass' : 'fail',
        message: retrieved === 'test-video' ? undefined : `Expected 'test-video', got '${retrieved}'`
      })
    } catch (e) {
      results.push({ name: 'StorageManager: save/load video ID', status: 'fail', message: String(e) })
    }

    // Test 2: StorageManager position
    try {
      StorageManager.setLastPosition(123.45)
      const pos = StorageManager.getLastPosition()
      results.push({
        name: 'StorageManager: save/load position',
        status: Math.abs(pos - 123.45) < 0.01 ? 'pass' : 'fail',
        message: Math.abs(pos - 123.45) < 0.01 ? undefined : `Expected 123.45, got ${pos}`
      })
    } catch (e) {
      results.push({ name: 'StorageManager: save/load position', status: 'fail', message: String(e) })
    }

    // Test 3: StorageManager sessions null safety
    try {
      const heavy = StorageManager.getHeavyRotation()
      const deep = StorageManager.getDeepListens()
      const vibe = StorageManager.getCurrentVibe()
      results.push({
        name: 'StorageManager: smart categories (null safety)',
        status: 'pass',
        message: `Heavy: ${heavy.length}, Deep: ${deep.length}, Vibe: ${vibe.length}`
      })
    } catch (e) {
      results.push({ name: 'StorageManager: smart categories (null safety)', status: 'fail', message: String(e) })
    }

    // Test 4: YouTube API loaded
    results.push({
      name: 'YouTube IFrame API loaded',
      status: window.YT && window.YT.Player ? 'pass' : 'pending',
      message: window.YT && window.YT.Player ? 'API ready' : 'Waiting for API...'
    })

    // Test 5: Player state initialized
    results.push({
      name: 'Player hook initialized',
      status: playerState ? 'pass' : 'fail',
      message: `Ready: ${playerState.isReady}, Status: ${playerState.status}`
    })

    setTestResults(results)
  }

  const loadTestVideo = (videoId: string) => {
    controls.loadVideo(videoId)
  }

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-mono p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 border-b border-zinc-800 pb-4">
          <h1 className="text-2xl text-amber-500 tracking-wider">AVIRAM RADIO // TEST CONSOLE</h1>
          <p className="text-zinc-600 text-sm mt-2">System diagnostics and component testing</p>
        </div>

        {/* Test Results */}
        <section className="mb-8">
          <h2 className="text-xs text-zinc-600 uppercase tracking-widest mb-4">AUTOMATED TESTS</h2>
          <div className="space-y-2">
            {testResults.map((result, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800">
                <div className={`w-2 h-2 rounded-full ${
                  result.status === 'pass' ? 'bg-green-500' :
                  result.status === 'fail' ? 'bg-red-500' :
                  'bg-amber-500 animate-pulse'
                }`} />
                <span className="flex-1">{result.name}</span>
                <span className={`text-xs uppercase ${
                  result.status === 'pass' ? 'text-green-500' :
                  result.status === 'fail' ? 'text-red-500' :
                  'text-amber-500'
                }`}>{result.status}</span>
              </div>
            ))}
            {testResults.length > 0 && testResults.some(r => r.message) && (
              <div className="mt-4 p-3 bg-zinc-950 border border-zinc-800 text-xs">
                {testResults.filter(r => r.message).map((r, i) => (
                  <div key={i} className="text-zinc-500">
                    {r.name}: {r.message}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={runTests}
            className="mt-4 px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-amber-500 text-sm uppercase tracking-wider"
          >
            Re-run Tests
          </button>
        </section>

        {/* Player State */}
        <section className="mb-8">
          <h2 className="text-xs text-zinc-600 uppercase tracking-widest mb-4">PLAYER STATE</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-zinc-900 border border-zinc-800">
              <div className="text-xs text-zinc-600 uppercase">Status</div>
              <div className={`text-lg ${playerState.isPlaying ? 'text-amber-500' : 'text-zinc-400'}`}>
                {playerState.status.toUpperCase()}
              </div>
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800">
              <div className="text-xs text-zinc-600 uppercase">Ready</div>
              <div className={`text-lg ${playerState.isReady ? 'text-green-500' : 'text-zinc-600'}`}>
                {playerState.isReady ? 'YES' : 'NO'}
              </div>
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800">
              <div className="text-xs text-zinc-600 uppercase">Time</div>
              <div className="text-lg text-zinc-300">
                {Math.floor(playerState.currentTime)}s / {Math.floor(playerState.duration)}s
              </div>
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800">
              <div className="text-xs text-zinc-600 uppercase">Video ID</div>
              <div className="text-lg text-zinc-300 truncate">
                {playerState.videoId || '-'}
              </div>
            </div>
          </div>
        </section>

        {/* Video Controls */}
        <section className="mb-8">
          <h2 className="text-xs text-zinc-600 uppercase tracking-widest mb-4">VIDEO CONTROLS</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {TEST_VIDEOS.map((video) => (
              <button
                key={video.id}
                onClick={() => loadTestVideo(video.id)}
                className="px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-amber-500 text-sm"
              >
                Load {video.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={controls.togglePlayPause}
              disabled={!playerState.isReady || !playerState.videoId}
              className="px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-amber-500 text-sm disabled:opacity-50"
            >
              {playerState.isPlaying ? 'PAUSE' : 'PLAY'}
            </button>
            <button
              onClick={() => controls.seek(-10)}
              disabled={!playerState.isReady}
              className="px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-amber-500 text-sm disabled:opacity-50"
            >
              -10s
            </button>
            <button
              onClick={() => controls.seek(10)}
              disabled={!playerState.isReady}
              className="px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-amber-500 text-sm disabled:opacity-50"
            >
              +10s
            </button>
            <button
              onClick={controls.toggleMute}
              disabled={!playerState.isReady}
              className="px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-amber-500 text-sm disabled:opacity-50"
            >
              {playerState.isMuted ? 'UNMUTE' : 'MUTE'}
            </button>
          </div>
        </section>

        {/* RetroTV Controls */}
        <section className="mb-8">
          <h2 className="text-xs text-zinc-600 uppercase tracking-widest mb-4">RETRO TV MONITOR</h2>
          <button
            onClick={() => setShowTV(!showTV)}
            className={`px-4 py-2 border text-sm ${
              showTV
                ? 'bg-amber-500/20 border-amber-500 text-amber-500'
                : 'bg-zinc-900 border-zinc-700 hover:border-amber-500'
            }`}
          >
            {showTV ? 'HIDE MONITOR' : 'SHOW MONITOR'}
          </button>
          <p className="mt-2 text-xs text-zinc-600">
            Monitor syncs with main player. Drag to reposition. Always muted (main player handles audio).
          </p>
        </section>

        {/* Instructions */}
        <section className="mt-12 pt-8 border-t border-zinc-800">
          <h2 className="text-xs text-zinc-600 uppercase tracking-widest mb-4">TEST INSTRUCTIONS</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-500">
            <li>Load a test video using the buttons above</li>
            <li>Click PLAY to start playback</li>
            <li>Click SHOW MONITOR to open RetroTV</li>
            <li>Verify video appears in the monitor and syncs with controls</li>
            <li>Test seeking with -10s/+10s buttons - monitor should follow</li>
            <li>Drag the monitor to test repositioning</li>
            <li>Minimize and restore the monitor</li>
          </ol>
        </section>
      </div>

      {/* RetroTV */}
      <RetroTV
        videoId={playerState.videoId}
        isPlaying={playerState.isPlaying}
        isMuted={playerState.isMuted}
        currentTime={playerState.currentTime}
        isVisible={showTV}
        onClose={() => setShowTV(false)}
      />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TestPage />
  </React.StrictMode>,
)
