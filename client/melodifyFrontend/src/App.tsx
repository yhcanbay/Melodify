import { useEffect, useState } from 'react'
import './App.css'

type MusicItem = {
  fileName: string
  title: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/Melodify/api'

function App() {
  const [tracks, setTracks] = useState<MusicItem[]>([])
  const [selectedTrack, setSelectedTrack] = useState<MusicItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const buildStreamUrl = (fileName: string) => `${API_BASE_URL}/music/${encodeURIComponent(fileName)}`

  useEffect(() => {
    const fetchTracks = async () => {
      try {
        setIsLoading(true)
        setErrorMessage('')

        const response = await fetch(`${API_BASE_URL}/music`)

        if (!response.ok) {
          throw new Error(`Muzik listesi alinamadi. HTTP ${response.status}`)
        }

        const musicItems = (await response.json()) as MusicItem[]
        setTracks(musicItems)
        setSelectedTrack(musicItems[0] ?? null)
      } catch (error) {
        console.error(error)
        const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
        setErrorMessage(`Backend baglantisi kurulamadi. URL: ${API_BASE_URL}/music | Detay: ${message}`)
      } finally {
        setIsLoading(false)
      }
    }

    void fetchTracks()
  }, [])

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Melodify Desktop</p>
        <h1>Sec, gor, dinle.</h1>
        <p className="hero-copy">
          Sol taraftan bir parca sec. Sag tarafta secilen sarki adini gorecek ve
          asagidaki oynaticidan hemen calabileceksin.
        </p>
        <div className="status-row">
          <span className="status-pill">{tracks.length} parca bulundu</span>
          <span className="status-pill muted">{selectedTrack ? 'Hazir' : 'Parca bekleniyor'}</span>
        </div>
      </section>

      <section className="player-layout">
        <aside className="library-panel">
          <div className="panel-heading">
            <h2>Kitaplik</h2>
            <p>Muzik klasorundeki dosyalar</p>
          </div>

          {isLoading && <p className="feedback">Muzikler yukleniyor...</p>}
          {!isLoading && errorMessage && <p className="feedback error">{errorMessage}</p>}
          {!isLoading && !errorMessage && tracks.length === 0 && (
            <p className="feedback">Desteklenen bir muzik dosyasi bulunamadi.</p>
          )}

          <div className="track-list">
            {tracks.map((track) => {
              const isActive = selectedTrack?.fileName === track.fileName

              return (
                <button
                  key={track.fileName}
                  type="button"
                  className={`track-card${isActive ? ' active' : ''}`}
                  onClick={() => setSelectedTrack(track)}
                >
                  <span className="track-title">{track.title}</span>
                  <span className="track-file">{track.fileName}</span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="now-playing-panel">
          <div className="album-light" />
          <div className="panel-heading">
            <h2>Simdi Calan</h2>
            <p>Secilen parcayi dogrudan backend stream endpoint'inden oynatir.</p>
          </div>

          <div className="record-shell">
            <div className="record" />
          </div>

          <div className="current-track">
            <p className="label">Secilen parca</p>
            <h3>{selectedTrack?.title ?? 'Henuz parca secilmedi'}</h3>
            <p>{selectedTrack?.fileName ?? 'Listeden bir muzik secerek oynaticiyi baslat.'}</p>
          </div>

          <audio
            key={selectedTrack?.fileName ?? 'empty-player'}
            className="audio-player"
            controls
            autoPlay
            src={selectedTrack ? buildStreamUrl(selectedTrack.fileName) : undefined}
          >
            Tarayici ses oynaticisini desteklemiyor.
          </audio>
        </section>
      </section>
    </main>
  )
}

export default App
