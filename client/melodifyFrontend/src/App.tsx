import { useEffect, useRef, useState, type FormEvent } from 'react'
import './App.css'
import type { DownloadResult, LibrarySnapshot, MusicTrack, SearchResult } from './shared/melodify'

const MIME_BY_EXTENSION: Record<string, string[]> = {
  aac: ['audio/aac', 'audio/aacp'],
  flac: ['audio/flac', 'audio/x-flac'],
  m4a: ['audio/mp4', 'audio/x-m4a'],
  m4b: ['audio/mp4'],
  mp3: ['audio/mpeg'],
  oga: ['audio/ogg'],
  ogg: ['audio/ogg'],
  opus: ['audio/ogg', 'audio/opus'],
  wav: ['audio/wav', 'audio/x-wav'],
  webm: ['audio/webm'],
}

type AppTab = 'library' | 'downloads'

function canPlayMime(mimeType: string) {
  if (typeof document === 'undefined') {
    return false
  }

  const audio = document.createElement('audio')
  return audio.canPlayType(mimeType) !== ''
}

function isTrackPlayable(track: MusicTrack) {
  const mimeTypes = MIME_BY_EXTENSION[track.extension] ?? []
  return mimeTypes.some((mimeType) => canPlayMime(mimeType))
}

function shuffleTracks<T>(items: T[]) {
  const next = [...items]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }

  return next
}

function moveTrack<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) {
    return items
  }

  if (fromIndex < 0 || fromIndex >= items.length) {
    return items
  }

  if (toIndex < 0 || toIndex >= items.length) {
    return items
  }

  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)

  return next
}

function formatFolderName(folderPath: string) {
  const segments = folderPath.split(/[/\\]/).filter(Boolean)
  return segments[segments.length - 1] ?? folderPath
}

function normalizeComparablePath(folderPath: string) {
  return folderPath.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function isCookieChallengeError(message: string) {
  return /confirm you’re not a bot|confirm you're not a bot|sign in to confirm/i.test(message)
}

const COOKIE_BROWSER_OPTIONS = [
  { value: '', label: 'Yok' },
  { value: 'chrome', label: 'Chrome' },
  { value: 'chromium', label: 'Chromium' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'edge', label: 'Edge' },
  { value: 'brave', label: 'Brave' },
  { value: 'opera', label: 'Opera' },
]

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('library')
  const [libraryView, setLibraryView] = useState<'tracks' | 'queue'>('tracks')
  const [libraryFolder, setLibraryFolder] = useState('')
  const [libraryTracks, setLibraryTracks] = useState<MusicTrack[]>([])
  const [queue, setQueue] = useState<MusicTrack[]>([])
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isShuffled, setIsShuffled] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Bir klasör seçerek yerel müzik kitaplığını başlat.')
  const [errorMessage, setErrorMessage] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioSourceUrl, setAudioSourceUrl] = useState('')
  const [loadedTrackPath, setLoadedTrackPath] = useState('')
  const [downloadFolderPath, setDownloadFolderPath] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [downloadStatus, setDownloadStatus] = useState('Arama yapıp indirilebilir sonuçları görebilirsin.')
  const [activeDownloadUrls, setActiveDownloadUrls] = useState<Record<string, boolean>>({})
  const [cookiesFromBrowser, setCookiesFromBrowser] = useState('')
  const [isUpdatingYtDlp, setIsUpdatingYtDlp] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const autoPlayRequestedRef = useRef(false)
  const pendingBlobUrlRef = useRef('')

  const currentTrackIndex = queue.findIndex((track) => track.id === currentTrackId)
  const currentTrack = currentTrackIndex >= 0 ? queue[currentTrackIndex] : null
  const playableLibraryTracks = libraryTracks.filter(isTrackPlayable)
  const supportedTrackCount = playableLibraryTracks.length

  const syncSnapshot = (
    snapshot: LibrarySnapshot,
    options?: { preserveTrackId?: string | null; keepPlayback?: boolean },
  ) => {
    const previousTrackId = options?.preserveTrackId ?? null
    const preservePlayback = options?.keepPlayback ?? false
    const playableTracks = snapshot.tracks.filter(isTrackPlayable)
    const preservedTrack =
      playableTracks.find((track) => track.id === previousTrackId) ?? playableTracks[0] ?? null

    setLibraryFolder(snapshot.folderPath)
    setLibraryTracks(snapshot.tracks)
    setQueue(playableTracks)
    setCurrentTrackId(preservedTrack?.id ?? null)
    setIsShuffled(false)

    if (!preservePlayback) {
      setIsPlaying(false)
      setAudioSourceUrl('')
      setLoadedTrackPath('')
    }

    setErrorMessage('')

    if (snapshot.tracks.length === 0) {
      setStatusMessage(`${formatFolderName(snapshot.folderPath)} içinde desteklenen müzik dosyası bulunamadı.`)
      return
    }

    if (playableTracks.length > 0) {
      const unsupportedSuffix =
        snapshot.tracks.length > playableTracks.length
          ? `, ${snapshot.tracks.length - playableTracks.length} parça bu kurulumda desteklenmiyor`
          : ''

      setStatusMessage(
        `${playableTracks.length} oynatılabilir parça bulundu${unsupportedSuffix}. ${formatFolderName(
          snapshot.folderPath,
        )} klasörü hazır.`,
      )
      return
    }

    setStatusMessage(
      `${formatFolderName(snapshot.folderPath)} içinde bu kurulumda oynatılabilen bir ses dosyası bulunamadı.`,
    )
  }

  useEffect(() => {
    const savedCookiesBrowser = window.localStorage.getItem('melodify.cookiesFromBrowser')

    if (savedCookiesBrowser) {
      setCookiesFromBrowser(savedCookiesBrowser)
    }

    const loadInitialState = async () => {
      try {
        const [librarySnapshot, lastDownloadFolder] = await Promise.all([
          window.melodifyApi.loadLastLibrary(),
          window.melodifyApi.loadLastDownloadFolder(),
        ])

        if (librarySnapshot) {
          syncSnapshot(librarySnapshot)
          if (!lastDownloadFolder) {
            setDownloadFolderPath(librarySnapshot.folderPath)
          }
        }

        if (lastDownloadFolder) {
          setDownloadFolderPath(lastDownloadFolder)
        }
      } catch (error) {
        console.error(error)
        setErrorMessage('Başlangıç verileri yüklenemedi.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadInitialState()
  }, [])

  useEffect(() => {
    window.localStorage.setItem('melodify.cookiesFromBrowser', cookiesFromBrowser)
  }, [cookiesFromBrowser])

  useEffect(() => {
    const audio = audioRef.current

    if (!audio || !currentTrack) {
      const blobUrl = pendingBlobUrlRef.current

      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
        pendingBlobUrlRef.current = ''
      }

      setAudioSourceUrl('')
      setLoadedTrackPath('')
      return
    }

    let isActive = true

    const loadAudioSource = async () => {
      try {
        if (pendingBlobUrlRef.current) {
          URL.revokeObjectURL(pendingBlobUrlRef.current)
          pendingBlobUrlRef.current = ''
        }

        setAudioSourceUrl('')
        setLoadedTrackPath('')

        const payload = await window.melodifyApi.loadTrackPayload(currentTrack.filePath)

        if (!payload) {
          throw new Error('Dosya okunamadı.')
        }

        const blobUrl = URL.createObjectURL(new Blob([payload.data], { type: payload.mimeType }))
        pendingBlobUrlRef.current = blobUrl

        if (!isActive) {
          URL.revokeObjectURL(blobUrl)
          return
        }

        setAudioSourceUrl(blobUrl)
        setLoadedTrackPath(currentTrack.filePath)
        setErrorMessage('')
      } catch (error) {
        setIsPlaying(false)
        const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
        setErrorMessage(`Ses kaynağı yüklenemedi: ${message}`)
      }
    }

    void loadAudioSource()

    return () => {
      isActive = false
    }
  }, [currentTrack?.id, currentTrack?.filePath])

  useEffect(() => {
    const audio = audioRef.current

    if (
      !audio ||
      !currentTrack ||
      !audioSourceUrl ||
      loadedTrackPath !== currentTrack.filePath ||
      !autoPlayRequestedRef.current
    ) {
      return
    }

    autoPlayRequestedRef.current = false

    const playLoadedSource = async () => {
      try {
        await audio.play()
        setIsPlaying(true)
        setErrorMessage('')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
        setIsPlaying(false)
        setErrorMessage(`Parça başlatılamadı: ${message}`)
      }
    }

    void playLoadedSource()
  }, [currentTrack?.id, audioSourceUrl, loadedTrackPath])

  const openLibraryPicker = async () => {
    try {
      setIsLoading(true)
      setErrorMessage('')

      const result = await window.melodifyApi.pickLibrary()

      if (result.canceled) {
        setStatusMessage('Klasör seçimi iptal edildi.')
        return
      }

      syncSnapshot(result.snapshot)
    } catch (error) {
      console.error(error)
      setErrorMessage('Klasör seçilirken beklenmeyen bir hata oluştu.')
    } finally {
      setIsLoading(false)
    }
  }

  const chooseDownloadFolder = async () => {
    try {
      const result = await window.melodifyApi.pickDownloadFolder()

      if (result.canceled) {
        return
      }

      setDownloadFolderPath(result.folderPath)
      setDownloadStatus(`İndirme klasörü seçildi: ${result.folderPath}`)
      setSearchError('')
    } catch (error) {
      console.error(error)
      setSearchError('İndirme klasörü seçilemedi.')
    }
  }

  const startTrack = async (trackId: string) => {
    const selectedTrack = libraryTracks.find((track) => track.id === trackId)
    const audio = audioRef.current

    if (!selectedTrack) {
      return
    }

    if (!isTrackPlayable(selectedTrack)) {
      setCurrentTrackId(null)
      setIsPlaying(false)
      setStatusMessage('Seçilen dosya bu kurulumda desteklenmiyor.')
      setErrorMessage(
        'Bu parça tarayıcı/Electron codec desteği nedeniyle oynatılamıyor. MP3, WAV, OGG veya OPUS deneyebilirsin.',
      )
      return
    }

    if (currentTrackId === trackId && audio && audioSourceUrl) {
      try {
        await audio.play()
        setIsPlaying(true)
        setErrorMessage('')
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
        setErrorMessage(`Parça başlatılamadı: ${message}`)
        return
      }
    }

    autoPlayRequestedRef.current = true
    setCurrentTrackId(trackId)
  }

  const goToPreviousTrack = () => {
    if (!currentTrack || queue.length === 0) {
      return
    }

    const audio = audioRef.current

    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }

    const previousIndex = currentTrackIndex <= 0 ? queue.length - 1 : currentTrackIndex - 1
    autoPlayRequestedRef.current = true
    setCurrentTrackId(queue[previousIndex]?.id ?? null)
  }

  const goToNextTrack = () => {
    if (!currentTrack || queue.length === 0) {
      return
    }

    const nextIndex = currentTrackIndex >= queue.length - 1 ? 0 : currentTrackIndex + 1
    autoPlayRequestedRef.current = true
    setCurrentTrackId(queue[nextIndex]?.id ?? null)
  }

  const togglePlayPause = async () => {
    const audio = audioRef.current

    if (!audio || !currentTrack) {
      return
    }

    if (audio.paused) {
      try {
        await audio.play()
        setIsPlaying(true)
        setErrorMessage('')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
        setErrorMessage(`Parça başlatılamadı: ${message}`)
      }
      return
    }

    audio.pause()
    setIsPlaying(false)
  }

  const toggleShuffle = () => {
    if (playableLibraryTracks.length < 2) {
      setStatusMessage('Karışık çalma için en az iki oynatılabilir parça gerekli.')
      return
    }

    if (isShuffled) {
      setQueue(playableLibraryTracks)
      setIsShuffled(false)
      setCurrentTrackId((activeTrackId) => activeTrackId ?? playableLibraryTracks[0]?.id ?? null)
      setStatusMessage('Çalma sırası kitaplık düzenine geri döndü.')
      return
    }

    setQueue((previousQueue) => {
      if (previousQueue.length < 2) {
        return previousQueue
      }

      const activeTrack = previousQueue.find((track) => track.id === currentTrackId)
      const remainingTracks = previousQueue.filter((track) => track.id !== currentTrackId)
      const shuffledTracks = shuffleTracks(remainingTracks)

      return activeTrack ? [activeTrack, ...shuffledTracks] : shuffleTracks(previousQueue)
    })
    setCurrentTrackId((activeTrackId) => activeTrackId ?? playableLibraryTracks[0]?.id ?? null)
    setIsShuffled(true)
    setStatusMessage('Karışık çalma etkin.')
  }

  const moveCurrentTrack = (trackId: string, direction: -1 | 1) => {
    setQueue((previousQueue) => {
      const fromIndex = previousQueue.findIndex((track) => track.id === trackId)
      const toIndex = fromIndex + direction
      return moveTrack(previousQueue, fromIndex, toIndex)
    })
  }

  const runSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const query = searchQuery.trim()

    if (!query) {
      setSearchError('Aramak için bir şarkı adı yaz.')
      return
    }

    try {
      setIsSearching(true)
      setSearchError('')
      setSearchResults([])
      setDownloadStatus('Arama yapılıyor...')

      const results = await window.melodifyApi.searchTracks({
        query,
        limit: 10,
      })

      setSearchResults(results)
      setDownloadStatus(
        results.length > 0 ? `${results.length} sonuç bulundu. İstediğini indirebilirsin.` : 'Sonuç bulunamadı.',
      )
      setActiveTab('downloads')
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
      setSearchError(`Arama başarısız: ${message}`)
      setDownloadStatus('Arama tamamlanamadı.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleDownload = async (result: SearchResult) => {
    if (!downloadFolderPath) {
      setSearchError('Önce indirme klasörü seç.')
      return
    }

    try {
      setSearchError('')
      setDownloadStatus(`${result.title} indiriliyor...`)
      setActiveDownloadUrls((current) => ({ ...current, [result.webpageUrl]: true }))

      const outcome: DownloadResult = await window.melodifyApi.downloadTrack({
        webpageUrl: result.webpageUrl,
        downloadFolderPath,
        cookiesFromBrowser: cookiesFromBrowser || null,
      })

      setDownloadStatus(`İndirme tamamlandı: ${outcome.fileName}`)

      if (
        libraryFolder &&
        normalizeComparablePath(downloadFolderPath) === normalizeComparablePath(libraryFolder)
      ) {
        const refreshed = await window.melodifyApi.loadLastLibrary()

        if (refreshed) {
          syncSnapshot(refreshed, {
            preserveTrackId: currentTrackId,
            keepPlayback: true,
          })
        }
      }
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
      if (isCookieChallengeError(message)) {
        setSearchError(
          'YouTube bot doğrulaması istedi. "Çerez kaynağı" seçip tarayıcı çerezleriyle tekrar dene.',
        )
      } else {
        setSearchError(`İndirme başarısız: ${message}`)
      }
      setDownloadStatus('İndirme tamamlanamadı.')
    } finally {
      setActiveDownloadUrls((current) => {
        const next = { ...current }
        delete next[result.webpageUrl]
        return next
      })
    }
  }

  const updateYtDlp = async () => {
    try {
      setIsUpdatingYtDlp(true)
      setSearchError('')
      setDownloadStatus('yt-dlp guncellemesi kontrol ediliyor...')

      const result = await window.melodifyApi.updateYtDlp()
      const versionMessage = result.updated
        ? `yt-dlp guncellendi: ${result.previousVersion} -> ${result.currentVersion}`
        : `yt-dlp zaten guncel: ${result.currentVersion}`

      setDownloadStatus(result.output ? `${versionMessage}\n${result.output}` : versionMessage)
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
      setSearchError(`yt-dlp guncellenemedi: ${message}`)
      setDownloadStatus('yt-dlp guncellemesi tamamlanamadi.')
    } finally {
      setIsUpdatingYtDlp(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header panel-surface">
        <div className="header-left">
          <p className="eyebrow">Melodify</p>
          <div className="header-actions">
            <button type="button" className="primary-button" onClick={openLibraryPicker}>
              Klasör seç
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={toggleShuffle}
              disabled={playableLibraryTracks.length < 2}
            >
              {isShuffled ? 'Karışığı kapat' : 'Karışık çal'}
            </button>
          </div>
        </div>

        <div className="header-stats">
          <span className="status-pill">{libraryTracks.length} parça</span>
          <span className="status-pill">{supportedTrackCount} oynatılabilir</span>
          <span className="status-pill">{downloadFolderPath ? formatFolderName(downloadFolderPath) : 'İndirme yok'}</span>
        </div>

        <p className="status-message">{statusMessage}</p>
        {errorMessage && <p className="error-message">{errorMessage}</p>}
      </header>

      <nav className="tab-strip panel-surface" aria-label="Ana bölümler">
        <button
          type="button"
          className={`tab-button${activeTab === 'library' ? ' active' : ''}`}
          onClick={() => setActiveTab('library')}
        >
          Kütüphane
        </button>
        <button
          type="button"
          className={`tab-button${activeTab === 'downloads' ? ' active' : ''}`}
          onClick={() => setActiveTab('downloads')}
        >
          Ara ve indir
        </button>
      </nav>

      <section className="content-shell panel-surface">
        {activeTab === 'library' ? (
          <div className="library-layout">
            <div className="section-toolbar">
              <div>
                <p className="section-kicker">Kitaplık</p>
                <h2>Müziklerin</h2>
              </div>
              <div className="segmented-control">
                <button
                  type="button"
                  className={`segment-button${libraryView === 'tracks' ? ' active' : ''}`}
                  onClick={() => setLibraryView('tracks')}
                >
                  Liste
                </button>
                <button
                  type="button"
                  className={`segment-button${libraryView === 'queue' ? ' active' : ''}`}
                  onClick={() => setLibraryView('queue')}
                >
                  Sıra
                </button>
              </div>
            </div>

            {libraryView === 'tracks' ? (
              <div className="panel-stack">
                {isLoading && <div className="info-card">Kütüphane yükleniyor...</div>}

                {!isLoading && libraryTracks.length === 0 && (
                  <div className="empty-card">
                    <h3>Henüz bir klasör seçilmedi</h3>
                    <p>Bir klasör seçtiğinde parçalar burada görünecek.</p>
                  </div>
                )}

                {libraryTracks.length > 0 && (
                  <div className="track-list">
                    {libraryTracks.map((track) => {
                      const isActive = currentTrack?.id === track.id
                      const playable = isTrackPlayable(track)

                      return (
                        <button
                          key={track.id}
                          type="button"
                          className={`track-card${isActive ? ' active' : ''}${playable ? '' : ' disabled'}`}
                          onClick={() => startTrack(track.id)}
                          disabled={!playable}
                        >
                          <div className="track-card-main">
                            <span className="track-title">{track.title}</span>
                            <span className="track-meta">{track.fileName}</span>
                          </div>
                          <span className={`track-chip${playable ? '' : ' muted'}`}>
                            {playable ? (isActive ? 'Çalıyor' : 'Çal') : 'Desteklenmiyor'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="panel-stack">
                <section className="subpanel">
                  <div className="subpanel-head">
                    <div>
                      <p className="section-kicker">Çalma sırası</p>
                      <h3>Kuyruk düzeni</h3>
                    </div>
                    <p className="subpanel-note">Yukarı / aşağı butonlarıyla sıralamayı değiştir.</p>
                  </div>

                  {queue.length === 0 ? (
                    <div className="info-card">Çalma sırası boş.</div>
                  ) : (
                    <div className="queue-list">
                      {queue.map((track, index) => {
                        const isActive = track.id === currentTrack?.id

                        return (
                          <article key={track.id} className={`queue-item${isActive ? ' active' : ''}`}>
                            <button type="button" className="queue-track" onClick={() => startTrack(track.id)}>
                              <span className="queue-index">{String(index + 1).padStart(2, '0')}</span>
                              <span className="queue-title-wrap">
                                <span className="track-title">{track.title}</span>
                                <span className="track-meta">{track.fileName}</span>
                              </span>
                            </button>

                            <div className="queue-actions">
                              <button
                                type="button"
                                className="mini-button"
                                onClick={() => moveCurrentTrack(track.id, -1)}
                                disabled={index === 0}
                              >
                                Yukarı
                              </button>
                              <button
                                type="button"
                                className="mini-button"
                                onClick={() => moveCurrentTrack(track.id, 1)}
                                disabled={index === queue.length - 1}
                              >
                                Aşağı
                              </button>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        ) : (
          <div className="downloads-layout">
            <div className="section-toolbar">
              <div>
                <p className="section-kicker">İndirme</p>
                <h2>Arama ve seçim</h2>
              </div>
            </div>

            <div className="downloads-grid">
              <form className="search-form panel-card" onSubmit={runSearch}>
                <label className="search-field">
                  <span>Şarkı ara</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="ör. artist - song name"
                  />
                </label>

                <button type="submit" className="primary-button" disabled={isSearching}>
                  {isSearching ? 'Aranıyor...' : 'Ara'}
                </button>
              </form>

              <div className="download-settings panel-card">
                <div className="setting-card">
                  <div>
                    <p className="section-kicker">Hedef klasör</p>
                    <p className="setting-value">{downloadFolderPath || 'Henüz seçilmedi'}</p>
                  </div>
                  <button type="button" className="ghost-button small-button" onClick={chooseDownloadFolder}>
                    Klasör seç
                  </button>
                </div>

                <label className="cookie-picker">
                  <span>Çerez kaynağı</span>
                  <select value={cookiesFromBrowser} onChange={(event) => setCookiesFromBrowser(event.target.value)}>
                    {COOKIE_BROWSER_OPTIONS.map((option) => (
                      <option key={option.value || 'none'} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="cookie-hint">
                  YouTube doğrulama isterse, oturum açık tarayıcını seçip yeniden deneyebilirsin.
                </p>

                <div className="setting-card">
                  <div>
                    <p className="section-kicker">yt-dlp</p>
                    <p className="setting-value">Surumu kontrol et ve stable/latest surume guncelle.</p>
                  </div>
                  <button
                    type="button"
                    className="ghost-button small-button"
                    onClick={() => {
                      void updateYtDlp()
                    }}
                    disabled={isUpdatingYtDlp}
                  >
                    {isUpdatingYtDlp ? 'Kontrol ediliyor...' : 'Surum kontrol'}
                  </button>
                </div>
              </div>
            </div>

            {searchError && <div className="error-card">{searchError}</div>}
            <div className="info-card">{downloadStatus}</div>

            <div className="search-results">
              {searchResults.length === 0 ? (
                <div className="empty-card compact">
                  <h3>Arama sonucu bekleniyor</h3>
                  <p>Bir şarkı ara ve sonuçlardan istediğini indir.</p>
                </div>
              ) : (
                searchResults.map((result) => {
                  const downloading = Boolean(activeDownloadUrls[result.webpageUrl])

                  return (
                    <article key={result.webpageUrl} className="search-result-card">
                      {result.thumbnailUrl ? (
                        <img className="search-thumb" src={result.thumbnailUrl} alt="" />
                      ) : (
                        <div className="search-thumb placeholder" />
                      )}

                      <div className="search-result-body">
                        <div className="search-result-title-row">
                          <h3>{result.title}</h3>
                          <span className="result-duration">{result.durationText}</span>
                        </div>
                        <p className="result-uploader">{result.uploader}</p>
                        <p className="result-url">{result.webpageUrl}</p>
                      </div>

                      <button
                        type="button"
                        className="primary-button result-download"
                        onClick={() => {
                          void handleDownload(result)
                        }}
                        disabled={downloading || !downloadFolderPath}
                      >
                        {downloading ? 'İndiriliyor...' : 'İndir'}
                      </button>
                    </article>
                  )
                })
              )}
            </div>
          </div>
        )}
      </section>

      <footer className="player-dock panel-surface">
        <div className="dock-track-info">
          <p className="section-kicker">Şimdi çalıyor</p>
          <strong>{currentTrack?.title ?? 'Henüz parça seçilmedi'}</strong>
          <span>{currentTrack?.filePath ?? 'Çalmaya başlamak için soldan bir parça seç.'}</span>
        </div>

        <div className="dock-controls">
          <button type="button" className="control-button" onClick={goToPreviousTrack} disabled={!currentTrack}>
            Önceki
          </button>
          <button type="button" className="control-button primary" onClick={togglePlayPause} disabled={!currentTrack}>
            {isPlaying ? 'Duraklat' : 'Oynat'}
          </button>
          <button type="button" className="control-button" onClick={goToNextTrack} disabled={!currentTrack}>
            Sonraki
          </button>
        </div>

        <audio
          ref={audioRef}
          key={currentTrack?.id ?? 'empty-player'}
          className="audio-player"
          controls
          src={audioSourceUrl || undefined}
          onEnded={goToNextTrack}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={() => setErrorMessage('Bu ses dosyası oynatılamadı.')}
        >
          Tarayıcı ses oynatıcı desteği yok.
        </audio>
      </footer>
    </main>
  )
}

export default App
