import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import './App.css'
import type { DownloadResult, ExportedTrack, ImportProgress, LibrarySnapshot, MediaCommand, MusicTrack, SearchResult } from './shared/melodify'

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

type AppTab = 'library' | 'queue' | 'search'
type LibrarySort = 'name-asc' | 'name-desc' | 'date-desc' | 'date-asc'
type IconName =
  | 'download'
  | 'heart'
  | 'library'
  | 'list'
  | 'music'
  | 'next'
  | 'pause'
  | 'play'
  | 'previous'
  | 'queue'
  | 'repeat'
  | 'search'
  | 'shuffle'
  | 'upload'
  | 'volume'

const COOKIE_BROWSER_OPTIONS = [
  { value: '', label: 'Yok' },
  { value: 'chrome', label: 'Chrome' },
  { value: 'chromium', label: 'Chromium' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'edge', label: 'Edge' },
  { value: 'brave', label: 'Brave' },
  { value: 'opera', label: 'Opera' },
]

function canPlayMime(mimeType: string) {
  if (typeof document === 'undefined') {
    return false
  }

  return document.createElement('audio').canPlayType(mimeType) !== ''
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

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
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
  return /confirm youre not a bot|confirm you're not a bot|sign in to confirm/i.test(message)
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00'
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, 'tr', { numeric: true, sensitivity: 'base' })
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, JSX.Element> = {
    download: (
      <>
        <path d="M12 3v11" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </>
    ),
    heart: <path d="M20.8 5.6c-1.7-1.8-4.5-1.8-6.2 0L12 8.2 9.4 5.6c-1.7-1.8-4.5-1.8-6.2 0-1.8 1.8-1.8 4.7 0 6.5L12 21l8.8-8.9c1.8-1.8 1.8-4.7 0-6.5Z" />,
    library: (
      <>
        <path d="M4 5h12v14H4z" />
        <path d="M8 5v14" />
        <path d="M18 7v12" />
      </>
    ),
    list: (
      <>
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V5l11-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="17" cy="16" r="3" />
      </>
    ),
    next: (
      <>
        <path d="m6 5 9 7-9 7V5Z" />
        <path d="M18 5v14" />
      </>
    ),
    pause: (
      <>
        <path d="M8 5v14" />
        <path d="M16 5v14" />
      </>
    ),
    play: <path d="m8 5 11 7-11 7V5Z" />,
    upload: (
      <>
        <path d="M12 17V3" />
        <path d="m7 8 5-5 5 5" />
        <path d="M5 21h14" />
      </>
    ),
    previous: (
      <>
        <path d="m18 19-9-7 9-7v14Z" />
        <path d="M6 5v14" />
      </>
    ),
    queue: (
      <>
        <path d="M4 6h16" />
        <path d="M4 12h10" />
        <path d="M4 18h7" />
        <path d="m15 16 3 3 3-3" />
      </>
    ),
    repeat: (
      <>
        <path d="m17 2 4 4-4 4" />
        <path d="M3 11V9a3 3 0 0 1 3-3h15" />
        <path d="m7 22-4-4 4-4" />
        <path d="M21 13v2a3 3 0 0 1-3 3H3" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    shuffle: (
      <>
        <path d="M16 3h5v5" />
        <path d="M4 20 21 3" />
        <path d="M21 16v5h-5" />
        <path d="M15 15l6 6" />
        <path d="M4 4l5 5" />
      </>
    ),
    volume: (
      <>
        <path d="M4 10v4h4l5 5V5l-5 5H4Z" />
        <path d="M16 9a5 5 0 0 1 0 6" />
        <path d="M19 6a9 9 0 0 1 0 12" />
      </>
    ),
  }

  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('library')
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
  const [librarySearchQuery, setLibrarySearchQuery] = useState('')
  const [librarySort, setLibrarySort] = useState<LibrarySort>('name-asc')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [downloadStatus, setDownloadStatus] = useState('Arama yapıp indirilebilir sonuçları görebilirsin.')
  const [activeDownloadUrls, setActiveDownloadUrls] = useState<Record<string, boolean>>({})
  const [cookiesFromBrowser, setCookiesFromBrowser] = useState('')
  const [isUpdatingYtDlp, setIsUpdatingYtDlp] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.7)
  const [draggedQueueTrackId, setDraggedQueueTrackId] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [importMissing, setImportMissing] = useState<ExportedTrack[] | null>(null)
  const [showSearchPrompt, setShowSearchPrompt] = useState(false)
  const [importSummary, setImportSummary] = useState('')
  const [isDownloadingImport, setIsDownloadingImport] = useState(false)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [importError, setImportError] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const autoPlayRequestedRef = useRef(false)
  const pendingBlobUrlRef = useRef('')

  const missingWithUrl = useMemo(
    () => (importMissing ?? []).filter((track) => Boolean(track.webpageUrl || track.youtubeId)),
    [importMissing],
  )
  const missingWithoutUrl = useMemo(
    () => (importMissing ?? []).filter((track) => !track.webpageUrl && !track.youtubeId),
    [importMissing],
  )

  const playableLibraryTracks = useMemo(() => libraryTracks.filter(isTrackPlayable), [libraryTracks])
  const visibleLibraryTracks = useMemo(() => {
    const query = librarySearchQuery.trim().toLowerCase()
    const filteredTracks = query
      ? libraryTracks.filter((track) =>
          `${track.title} ${track.fileName} ${track.filePath}`.toLowerCase().includes(query),
        )
      : libraryTracks

    return [...filteredTracks].sort((left, right) => {
      if (librarySort === 'name-desc') {
        return compareText(right.title, left.title)
      }

      if (librarySort === 'date-desc') {
        return right.modifiedTimeMs - left.modifiedTimeMs
      }

      if (librarySort === 'date-asc') {
        return left.modifiedTimeMs - right.modifiedTimeMs
      }

      return compareText(left.title, right.title)
    })
  }, [librarySearchQuery, librarySort, libraryTracks])
  const playableVisibleLibraryTracks = useMemo(
    () => visibleLibraryTracks.filter(isTrackPlayable),
    [visibleLibraryTracks],
  )
  const currentTrackIndex = queue.findIndex((track) => track.id === currentTrackId)
  const currentTrack = currentTrackIndex >= 0 ? queue[currentTrackIndex] : null
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0

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
    setErrorMessage('')

    if (!preservePlayback) {
      setIsPlaying(false)
      setAudioSourceUrl('')
      setLoadedTrackPath('')
    }

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
        )} klasor hazir.`,
      )
      return
    }

    setStatusMessage(`${formatFolderName(snapshot.folderPath)} içinde oynatılabilen ses dosyası bulunamadı.`)
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
    return window.melodifyApi.onImportProgress((progress) => {
      setImportProgress(progress)
    })
  }, [])

  useEffect(() => {
    const audio = audioRef.current

    if (audio) {
      audio.volume = volume
    }
  }, [volume, audioSourceUrl, currentTrack?.id])

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
      setCurrentTime(0)
      setDuration(0)
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
      setActiveTab('library')
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

  const startTrack = async (trackId: string, sourceTracks?: MusicTrack[]) => {
    const selectedTrack = libraryTracks.find((track) => track.id === trackId)
    const audio = audioRef.current

    if (!selectedTrack) {
      return
    }

    if (!isTrackPlayable(selectedTrack)) {
      setCurrentTrackId(null)
      setIsPlaying(false)
      setStatusMessage('Seçilen dosya bu kurulumda desteklenmiyor.')
      setErrorMessage('Bu parça codec desteği nedeniyle oynatılamıyor. MP3, WAV, OGG veya OPUS deneyebilirsin.')
      return
    }

    if (!isShuffled && sourceTracks) {
      setQueue(sourceTracks.filter(isTrackPlayable))
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
    const audio = audioRef.current

    if (!currentTrack || queue.length === 0) {
      return
    }

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

  const runSearch = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    const query = searchQuery.trim()

    if (!query) {
      setSearchError('Aramak için bir şarkı adı yaz.')
      setActiveTab('search')
      return
    }

    try {
      setActiveTab('search')
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
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
      setSearchError(`Arama başarısız: ${message}`)
      setDownloadStatus('Arama tamamlanamad.')
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

      if (libraryFolder && normalizeComparablePath(downloadFolderPath) === normalizeComparablePath(libraryFolder)) {
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
        setSearchError('YouTube bot doğrulaması istedi. Çerez kaynağı seçip tarayıcı çerezleriyle tekrar dene.')
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

  const handleExportLibrary = async () => {
    try {
      setIsExporting(true)
      setExportMessage('')
      setErrorMessage('')

      const result = await window.melodifyApi.exportLibrary()

      if (result.canceled) {
        setExportMessage('Dışa aktarma iptal edildi.')
        return
      }

      setExportMessage(`${result.trackCount} parça başarıyla dışa aktarıldı.`)
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
      setExportMessage(`Dışa aktarma başarısız: ${message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportAnalyze = async () => {
    try {
      setIsAnalyzing(true)
      setImportError('')
      setImportSummary('')
      setImportMissing(null)
      setShowSearchPrompt(false)
      setImportProgress(null)
      setExportMessage('')

      const analysis = await window.melodifyApi.importAnalyze()

      if (analysis.canceled) {
        setImportSummary('İçe aktarma iptal edildi.')
        return
      }

      if (analysis.missing.length === 0) {
        setImportSummary(`Tüm ${analysis.total} parça zaten kütüphanede mevcut. Eksik yok!`)
        return
      }

      setImportMissing(analysis.missing)
      setImportSummary(
        `${analysis.total} parçadan ${analysis.found} tanesi mevcut, ${analysis.missing.length} tanesi eksik.`,
      )
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
      setImportError(`İçe aktarma analizi başarısız: ${message}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const startImportDownload = async (
    tracksToDownload: ExportedTrack[],
    allowSearchForMissingUrl: boolean,
  ) => {
    setShowSearchPrompt(false)

    if (!tracksToDownload || tracksToDownload.length === 0) {
      return
    }

    try {
      setIsDownloadingImport(true)
      setImportError('')
      setImportProgress(null)

      const result = await window.melodifyApi.importDownloadMissing(
        tracksToDownload,
        cookiesFromBrowser || null,
        allowSearchForMissingUrl,
      )

      const parts: string[] = []

      if (result.downloaded > 0) {
        parts.push(`${result.downloaded} parça başarıyla indirildi`)
      }

      if (result.failed > 0) {
        parts.push(`${result.failed} parça indirilemedi`)
      }

      setImportSummary(parts.join(', ') + '.')
      setImportMissing(null)
      setImportProgress(null)

      if (result.errors.length > 0) {
        setImportError(result.errors.join('\n'))
      }

      // Refresh library
      const refreshed = await window.melodifyApi.loadLastLibrary()

      if (refreshed) {
        syncSnapshot(refreshed, {
          preserveTrackId: currentTrackId,
          keepPlayback: true,
        })
      }
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
      setImportError(`İçe aktarma başarısız: ${message}`)
    } finally {
      setIsDownloadingImport(false)
    }
  }

  const handleImportDownloadClick = () => {
    if (!importMissing || importMissing.length === 0) {
      return
    }

    // Önce URL'e sahip olup olmadığına bakılır
    const withoutUrl = importMissing.filter((t) => !t.webpageUrl && !t.youtubeId)

    if (withoutUrl.length > 0) {
      // URL'si bulunmayan parçalar varsa sadece bunlar için kullanıcıya teklif göster
      setShowSearchPrompt(true)
    } else {
      // Tüm parçaların URL'si mevcutsa teklif sormadan doğrudan indir
      void startImportDownload(importMissing, false)
    }
  }

  const dismissImport = () => {
    setImportMissing(null)
    setShowSearchPrompt(false)
    setImportSummary('')
    setImportError('')
    setImportProgress(null)
    setExportMessage('')
  }

  const updateYtDlp = async () => {
    try {
      setIsUpdatingYtDlp(true)
      setSearchError('')
      setDownloadStatus('yt-dlp güncellemesi kontrol ediliyor...')

      const result = await window.melodifyApi.updateYtDlp()
      const versionMessage = result.updated
        ? `yt-dlp güncellendi: ${result.previousVersion} -> ${result.currentVersion}`
        : `yt-dlp zaten güncel: ${result.currentVersion}`

      setDownloadStatus(result.output ? `${versionMessage}\n${result.output}` : versionMessage)
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
      setSearchError(`yt-dlp güncellenemedi: ${message}`)
      setDownloadStatus('yt-dlp güncellemesi tamamlanamadı.')
    } finally {
      setIsUpdatingYtDlp(false)
    }
  }

  const seekToPercent = (percent: number) => {
    const audio = audioRef.current

    if (!audio || !duration) {
      return
    }

    audio.currentTime = (duration * percent) / 100
    setCurrentTime(audio.currentTime)
  }

  const moveQueueTrack = (targetTrackId: string) => {
    if (!draggedQueueTrackId || draggedQueueTrackId === targetTrackId) {
      return
    }

    setQueue((currentQueue) => {
      const fromIndex = currentQueue.findIndex((track) => track.id === draggedQueueTrackId)
      const toIndex = currentQueue.findIndex((track) => track.id === targetTrackId)
      return moveItem(currentQueue, fromIndex, toIndex)
    })
  }

  useEffect(() => {
    window.melodifyApi.setMediaControlState({
      hasTrack: Boolean(currentTrack),
      isPlaying,
      title: currentTrack?.title,
    })
  }, [currentTrack, isPlaying])

  useEffect(() => {
    const handleMediaCommand = (command: MediaCommand) => {
      if (command === 'play-pause') {
        void togglePlayPause()
        return
      }

      if (command === 'previous') {
        goToPreviousTrack()
        return
      }

      goToNextTrack()
    }

    return window.melodifyApi.onMediaCommand(handleMediaCommand)
  }, [currentTrack, queue, audioSourceUrl, loadedTrackPath])

  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      return
    }

    navigator.mediaSession.metadata = currentTrack
      ? new MediaMetadata({
          title: currentTrack.title,
          artist: 'Melodify',
          album: libraryFolder ? formatFolderName(libraryFolder) : 'Yerel Müzikler',
        })
      : null
    navigator.mediaSession.playbackState = currentTrack ? (isPlaying ? 'playing' : 'paused') : 'none'

    const setActionHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null,
    ) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // Some platforms expose Media Session partially.
      }
    }

    setActionHandler('play', () => {
      if (!isPlaying) {
        void togglePlayPause()
      }
    })
    setActionHandler('pause', () => {
      if (isPlaying) {
        void togglePlayPause()
      }
    })
    setActionHandler('previoustrack', goToPreviousTrack)
    setActionHandler('nexttrack', goToNextTrack)
    setActionHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number' && audioRef.current) {
        audioRef.current.currentTime = details.seekTime
        setCurrentTime(details.seekTime)
      }
    })

    if (currentTrack && 'setPositionState' in navigator.mediaSession && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: 1,
          position: Math.min(currentTime, duration),
        })
      } catch {
        // Ignore invalid transient position values while audio metadata loads.
      }
    }

    return () => {
      setActionHandler('play', null)
      setActionHandler('pause', null)
      setActionHandler('previoustrack', null)
      setActionHandler('nexttrack', null)
      setActionHandler('seekto', null)
    }
  }, [currentTrack, currentTime, duration, isPlaying, libraryFolder])

  const renderTrackList = (compact = false) => {
    if (isLoading) {
      return <div className="spotify-empty">Kitaplık yükleniyor...</div>
    }

    if (libraryTracks.length === 0) {
      return (
        <div className="spotify-empty">
          <strong>Henüz bir klasör seçilmedi</strong>
          <span>Yerel müziklerini görmek için kitaplığını bağla.</span>
          <button type="button" className="spotify-primary" onClick={openLibraryPicker}>
            Klasör seç
          </button>
        </div>
      )
    }

    return (
      <div className={compact ? 'track-table compact' : 'track-table'}>
        {visibleLibraryTracks.length === 0 ? (
          <div className="spotify-empty">Bu arama ve sıralama için sonuç yok.</div>
        ) : visibleLibraryTracks.map((track, index) => {
          const playable = isTrackPlayable(track)
          const active = track.id === currentTrack?.id

          return (
            <button
              key={track.id}
              type="button"
              className={`track-row${active ? ' active' : ''}${playable ? '' : ' disabled'}`}
              onClick={() => startTrack(track.id, visibleLibraryTracks)}
              disabled={!playable}
            >
              <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="track-cover">
                <Icon name={active && isPlaying ? 'pause' : 'music'} />
              </span>
              <span className="track-copy">
                <strong>{track.title}</strong>
                <small>{track.fileName}</small>
              </span>
              <span className="track-format">{track.extension.toUpperCase()}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="spotify-shell">
      <main className="spotify-body">
        <aside className="sidebar">
          <button type="button" className="brand-button" onClick={() => setActiveTab('library')}>
            <span className="brand-mark">
              <Icon name="music" />
            </span>
            <span>Melodify</span>
          </button>

          <nav className="sidebar-nav" aria-label="Ana navigasyon">
            <button
              type="button"
              className={activeTab === 'library' ? 'active' : ''}
              onClick={() => setActiveTab('library')}
            >
              <span>
                <Icon name="list" />
              </span>
              Liste
            </button>
            <button
              type="button"
              className={activeTab === 'queue' ? 'active' : ''}
              onClick={() => setActiveTab('queue')}
            >
              <span>
                <Icon name="queue" />
              </span>
              Çalma Sırası
            </button>
            <button
              type="button"
              className={activeTab === 'search' ? 'active' : ''}
              onClick={() => setActiveTab('search')}
            >
              <span>
                <Icon name="download" />
              </span>
              İndirilenler
            </button>
          </nav>

          <div className="sidebar-status">
            <strong>{libraryTracks.length} parça</strong>
            <span>{playableLibraryTracks.length} oynatılabilir</span>
            <span>{downloadFolderPath ? formatFolderName(downloadFolderPath) : 'İndirme klasörü yok'}</span>
          </div>
        </aside>

        <section className="content-area">
          {activeTab === 'library' && (
            <section className="library-page">
              <div className="library-banner">
                <div className="large-cover">
                  <Icon name="music" />
                </div>
                <div>
                  <p className="eyebrow">Kitaplık</p>
                  <h1>{libraryFolder ? formatFolderName(libraryFolder) : 'Müziklerin'}</h1>
                  <p>{statusMessage}</p>
                  {errorMessage && <div className="inline-error">{errorMessage}</div>}
                  <div className="banner-actions">
                    <button
                      type="button"
                      className="round-play"
                      onClick={() =>
                        playableVisibleLibraryTracks[0] &&
                        startTrack(playableVisibleLibraryTracks[0].id, visibleLibraryTracks)
                      }
                    >
                      <Icon name="play" />
                    </button>
                    <button type="button" onClick={openLibraryPicker}>
                      Klasör seç
                    </button>
                    <button type="button" onClick={toggleShuffle} disabled={playableLibraryTracks.length < 2}>
                      {isShuffled ? 'Karışığı kapat' : 'Karışık çal'}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportLibrary}
                      disabled={isExporting || libraryTracks.length === 0}
                    >
                      <Icon name="upload" />
                      {isExporting ? 'Aktarılıyor...' : 'Dışa Aktar'}
                    </button>
                    <button
                      type="button"
                      onClick={handleImportAnalyze}
                      disabled={isAnalyzing || isDownloadingImport || !libraryFolder}
                    >
                      <Icon name="download" />
                      {isAnalyzing ? 'Analiz ediliyor...' : 'İçe Aktar'}
                    </button>
                  </div>
                </div>
              </div>

              {(exportMessage || importSummary || importError || importProgress) && (
                <div className="import-export-status">
                  {exportMessage && (
                    <div className="transfer-message success">
                      <span>{exportMessage}</span>
                      <button type="button" onClick={dismissImport}>✕</button>
                    </div>
                  )}

                  {importSummary && (
                    <div className="transfer-message info">
                      <span>{importSummary}</span>
                      {!isDownloadingImport && (
                        <button type="button" onClick={dismissImport}>✕</button>
                      )}
                    </div>
                  )}

                  {importMissing && importMissing.length > 0 && !isDownloadingImport && (
                    <div className="import-actions">
                      <div className="missing-header">
                        <span className="missing-count">
                          {importMissing.length} eksik parça bulundu
                        </span>
                        {missingWithoutUrl.length > 0 && (
                          <span className="missing-warning-tag">
                            ⚠️ {missingWithoutUrl.length} parçanın URL bağlantısı yok
                          </span>
                        )}
                      </div>

                      <div className="missing-list">
                        {importMissing.slice(0, 10).map((track, index) => {
                          const hasUrl = Boolean(track.webpageUrl || track.youtubeId)
                          return (
                            <span
                              key={`${track.fileName}-${index}`}
                              className={`missing-track ${hasUrl ? 'has-url' : 'no-url'}`}
                              title={hasUrl ? 'İndirme URL bağlantısı hazır' : 'Doğrudan URL yok (ad araması yapılabilir)'}
                            >
                              <span className="track-status-dot" />
                              <span className="track-title-text">{track.title}</span>
                              <span className="track-pill">{hasUrl ? 'URL Hazır' : 'URL Yok'}</span>
                            </span>
                          )
                        })}
                        {importMissing.length > 10 && (
                          <span className="missing-track more-count">
                            ...ve {importMissing.length - 10} parça daha
                          </span>
                        )}
                      </div>

                      {showSearchPrompt ? (
                        <div className="search-proposal-card">
                          <div className="proposal-title">
                            <Icon name="search" />
                            <strong>URL'si Bulunmayan Parçalar İçin İndirme Teklifi</strong>
                          </div>
                          <p className="proposal-description">
                            Aşağıdaki <strong>{missingWithoutUrl.length}</strong> parçanın doğrudan YouTube URL bağlantısı bulunmuyor:
                          </p>
                          <div className="proposal-track-tags">
                            {missingWithoutUrl.slice(0, 6).map((track, idx) => (
                              <span key={idx} className="proposal-track-tag">
                                {track.title}
                              </span>
                            ))}
                            {missingWithoutUrl.length > 6 && (
                              <span className="proposal-track-tag more">
                                +{missingWithoutUrl.length - 6} parça daha
                              </span>
                            )}
                          </div>
                          <p className="proposal-question">
                            Bu parçalar YouTube üzerinde <strong>şarkı adıyla aratılarak (ytsearch)</strong> ilk sıradaki sonuç indirilsin mi?
                            <br />
                            <small className="proposal-note">
                              * Bu arama işlemi yalnızca bağlantısı (URL) bulunmayan bu {missingWithoutUrl.length} dosya için uygulanır.
                            </small>
                          </p>
                          <div className="proposal-buttons">
                            <button
                              type="button"
                              className="spotify-primary"
                              onClick={() => void startImportDownload(importMissing, true)}
                            >
                              Evet, Ad Aramasıyla İndir (Tümünü İndir)
                            </button>
                            {missingWithUrl.length > 0 && (
                              <button
                                type="button"
                                className="proposal-secondary-btn"
                                onClick={() => void startImportDownload(missingWithUrl, false)}
                              >
                                Hayır, Yalnızca URL'si Olanları İndir ({missingWithUrl.length} parça)
                              </button>
                            )}
                            <button
                              type="button"
                              className="proposal-cancel-btn"
                              onClick={() => setShowSearchPrompt(false)}
                            >
                              Vazgeç
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="import-action-buttons">
                          <button
                            type="button"
                            className="spotify-primary"
                            onClick={handleImportDownloadClick}
                          >
                            Eksikleri İndir ({importMissing.length} parça)
                          </button>
                          <button type="button" onClick={dismissImport}>
                            Vazgeç
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {importProgress && isDownloadingImport && (
                    <div className="import-progress">
                      <div className="import-progress-header">
                        <strong>
                          {importProgress.current}/{importProgress.total}
                        </strong>
                        <span>
                          {importProgress.status === 'downloading' && `İndiriliyor: ${importProgress.currentTrack}`}
                          {importProgress.status === 'completed' && `✓ ${importProgress.currentTrack}`}
                          {importProgress.status === 'failed' && `✗ ${importProgress.currentTrack}`}
                        </span>
                      </div>
                      <div className="import-progress-bar">
                        <div
                          className="import-progress-fill"
                          style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {importError && <div className="inline-error">{importError}</div>}
                </div>
              )}

              <div className="library-tools">
                <label>
                  <span>Kitaplıkta ara</span>
                  <input
                    type="search"
                    value={librarySearchQuery}
                    onChange={(event) => setLibrarySearchQuery(event.target.value)}
                    placeholder="Şarkı, dosya veya klasör ara"
                  />
                </label>
                <label>
                  <span>Sırala</span>
                  <select value={librarySort} onChange={(event) => setLibrarySort(event.target.value as LibrarySort)}>
                    <option value="name-asc">Ada göre A-Z</option>
                    <option value="name-desc">Ada göre Z-A</option>
                    <option value="date-desc">Tarihe göre yeni</option>
                    <option value="date-asc">Tarihe göre eski</option>
                  </select>
                </label>
              </div>

              {renderTrackList()}
            </section>
          )}

          {activeTab === 'queue' && (
            <section className="library-page">
              <div className="section-head page-head">
                <div>
                  <p className="eyebrow">Sıra</p>
                  <h1>Çalma Sırası</h1>
                </div>
              </div>
              <div className="track-table">
                {queue.length === 0 ? (
                  <div className="spotify-empty">Çalma sırası boş.</div>
                ) : (
                  queue.map((track, index) => (
                    <button
                      key={track.id}
                      type="button"
                      className={`track-row queue-draggable${track.id === currentTrack?.id ? ' active' : ''}${
                        track.id === draggedQueueTrackId ? ' dragging' : ''
                      }`}
                      draggable
                      onClick={() => startTrack(track.id)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', track.id)
                        setDraggedQueueTrackId(track.id)
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        moveQueueTrack(track.id)
                        setDraggedQueueTrackId(null)
                      }}
                      onDragEnd={() => setDraggedQueueTrackId(null)}
                    >
                      <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
                      <span className="track-cover">
                        <Icon name="music" />
                      </span>
                      <span className="track-copy">
                        <strong>{track.title}</strong>
                        <small>{track.fileName}</small>
                      </span>
                      <span className="track-format">Sıra</span>
                    </button>
                  ))
                )}
              </div>
            </section>
          )}

          {activeTab === 'search' && (
            <section className="download-page">
              <div className="section-head page-head">
                <div>
                  <p className="eyebrow">İndirme</p>
                  <h1>Ara ve indir</h1>
                </div>
              </div>

              <div className="download-layout">
                <form className="download-search-card" onSubmit={runSearch}>
                  <label>
                    <span>Şarkı ara</span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="örn. sanatçı - şarkı adı"
                    />
                  </label>
                  <button type="submit" className="spotify-primary" disabled={isSearching}>
                    {isSearching ? 'Aranıyor...' : 'Ara'}
                  </button>
                </form>

                <div className="settings-card">
                  <div className="setting-row">
                    <div>
                      <strong>Hedef klasör</strong>
                      <span>{downloadFolderPath || 'Henüz seçilmedi'}</span>
                    </div>
                    <button type="button" onClick={chooseDownloadFolder}>
                      Klasör seç
                    </button>
                  </div>

                  <label className="select-row">
                    <span>Çerez kaynağı</span>
                    <select value={cookiesFromBrowser} onChange={(event) => setCookiesFromBrowser(event.target.value)}>
                      {COOKIE_BROWSER_OPTIONS.map((option) => (
                        <option key={option.value || 'none'} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="setting-row">
                    <div>
                      <strong>yt-dlp</strong>
                      <span>Sürümü kontrol et ve güncelle.</span>
                    </div>
                    <button type="button" onClick={updateYtDlp} disabled={isUpdatingYtDlp}>
                      {isUpdatingYtDlp ? 'Kontrol...' : 'Sürüm kontrol'}
                    </button>
                  </div>
                </div>
              </div>

              {searchError && <div className="inline-error">{searchError}</div>}
              <div className="download-status">{downloadStatus}</div>

              <div className="result-list">
                {searchResults.length === 0 ? (
                  <div className="spotify-empty">
                    <strong>Arama sonucu bekleniyor</strong>
                    <span>Bir şarkı ara ve sonuçlardan istediğini indir.</span>
                  </div>
                ) : (
                  searchResults.map((result) => {
                    const downloading = Boolean(activeDownloadUrls[result.webpageUrl])

                    return (
                      <article key={result.webpageUrl} className="result-card">
                        {result.thumbnailUrl ? (
                          <img src={result.thumbnailUrl} alt="" />
                        ) : (
                          <div className="result-placeholder">
                            <Icon name="music" />
                          </div>
                        )}
                        <div>
                          <h3>{result.title}</h3>
                          <p>{result.uploader}</p>
                          <span>{result.webpageUrl}</span>
                        </div>
                        <small>{result.durationText}</small>
                        <button
                          type="button"
                          className="spotify-primary"
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
            </section>
          )}
        </section>
      </main>

      <footer className="player-bar">
        <div className="now-playing">
          <div className="player-cover">
            <Icon name="music" />
          </div>
          <div>
            <strong>{currentTrack?.title ?? 'Çalan Şarkı'}</strong>
            <span>{currentTrack?.fileName ?? 'Calmaya baslamak icin bir parça sec.'}</span>
          </div>
          <button type="button" aria-label="Beğen">
            <Icon name="heart" />
          </button>
        </div>

        <div className="player-controls">
          <div className="player-buttons">
            <button type="button" className={isShuffled ? 'accent' : ''} onClick={toggleShuffle} disabled={playableLibraryTracks.length < 2}>
              <Icon name="shuffle" />
            </button>
            <button type="button" onClick={goToPreviousTrack} disabled={!currentTrack}>
              <Icon name="previous" />
            </button>
            <button type="button" className="play-button" onClick={togglePlayPause} disabled={!currentTrack}>
              <Icon name={isPlaying ? 'pause' : 'play'} />
            </button>
            <button type="button" onClick={goToNextTrack} disabled={!currentTrack}>
              <Icon name="next" />
            </button>
            <button type="button">
              <Icon name="repeat" />
            </button>
          </div>
          <div className="progress-line">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={progressPercent}
              onChange={(event) => seekToPercent(Number(event.target.value))}
              aria-label="İlerleme"
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="volume-controls">
          <button type="button" onClick={() => setActiveTab('library')}>
            <Icon name="queue" />
          </button>
          <span>
            <Icon name="volume" />
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Ses"
          />
        </div>

        <audio
          ref={audioRef}
          key={currentTrack?.id ?? 'empty-player'}
          src={audioSourceUrl || undefined}
          onEnded={goToNextTrack}
          onLoadedMetadata={(event) => {
            event.currentTarget.volume = volume
            setDuration(event.currentTarget.duration)
          }}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={() => setErrorMessage('Bu ses dosyası oynatılamadı.')}
        />
      </footer>
    </div>
  )
}

export default App
