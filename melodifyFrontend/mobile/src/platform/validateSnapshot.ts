import { MOBILE_PROTOCOL_VERSION } from '../../../src/shared/mobile.ts'
import type { MobileSnapshot } from '../../../src/shared/mobile.ts'
import { MobilePlatformError } from './errors.ts'

type RecordValue = Record<string, unknown>

function check(condition: unknown): asserts condition {
  if (!condition) throw new MobilePlatformError('INVALID_SNAPSHOT', 'Uygulamadan geçersiz durum bilgisi alındı. Lütfen tekrar deneyin.')
}

function record(value: unknown): asserts value is RecordValue {
  check(value !== null && typeof value === 'object' && !Array.isArray(value))
}

function text(value: unknown): asserts value is string { check(typeof value === 'string') }
function nullableText(value: unknown) { if (value !== null) text(value) }
function number(value: unknown) { check(typeof value === 'number' && Number.isFinite(value) && value >= 0) }
function boolean(value: unknown) { check(typeof value === 'boolean') }
function array(value: unknown): asserts value is unknown[] { check(Array.isArray(value)) }
function choice(value: unknown, options: string[]) { check(typeof value === 'string' && options.includes(value)) }

function availability(value: unknown) {
  record(value)
  choice(value.state, ['available', 'not-implemented', 'unavailable'])
  text(value.message)
}

function folder(value: unknown) {
  if (value === null) return
  record(value)
  text(value.id)
  text(value.treeUri)
  text(value.name)
  check(value.id.length > 0 && value.treeUri.startsWith('content://'))
  choice(value.access, ['granted', 'revoked', 'missing', 'unmounted'])
}

function tracks(value: unknown) {
  array(value)
  for (const track of value) {
    record(track)
    for (const field of ['id', 'libraryId', 'contentUri', 'fileName', 'relativePath', 'title']) text(track[field])
    check(typeof track.contentUri === 'string' && track.contentUri.startsWith('content://'))
    check(track.id !== '' && track.libraryId !== '')
    nullableText(track.artist)
    nullableText(track.youtubeId)
    if (track.durationMs !== null) number(track.durationMs)
    choice(track.access, ['available', 'missing'])
    number(track.modifiedTimeMs)
    number(track.sizeBytes)
  }
}

export function assertMobileSnapshot(value: unknown): asserts value is MobileSnapshot {
  record(value)
  for (const feature of ['library', 'playback', 'downloads', 'playlists', 'settings']) {
    record(value[feature])
    availability(value[feature].availability)
  }
  const { library, playback, downloads, playlists, settings } = value as Record<string, RecordValue>
  if (settings.protocolVersion !== MOBILE_PROTOCOL_VERSION) {
    throw new MobilePlatformError('BRIDGE_VERSION_MISMATCH', 'Uygulama bileşenleri uyumsuz. Melodify güncellemesini yeniden yükleyin.')
  }
  folder(library.folder)
  tracks(library.tracks)
  boolean(library.scanning)
  nullableText(library.error)
  tracks(playback.queue)
  nullableText(playback.currentTrackId)
  boolean(playback.isPlaying)
  boolean(playback.shuffle)
  number(playback.volume)
  check((playback.volume as number) <= 1)
  nullableText(playback.error)
  boolean(playback.restoring)
  check(playback.repeatPass === 0 || playback.repeatPass === 1)
  number(playback.positionMs)
  number(playback.durationMs)
  choice(playback.repeat, ['off', 'once', 'one'])
  array(downloads.jobs)
  boolean(downloads.engineReady)
  nullableText(downloads.persistenceError)
  for (const job of downloads.jobs) {
    record(job)
    for (const field of ['id', 'sourceUrl', 'targetFolderId', 'title']) text(job[field])
    choice(job.stage, ['queued', 'preparing', 'downloading', 'converting', 'saving', 'canceling', 'completed', 'failed', 'canceled', 'interrupted'])
    if (job.progress !== null) { number(job.progress); check((job.progress as number) <= 100) }
    nullableText(job.error)
    nullableText(job.outputUri)
    if (job.validation !== null) {
      record(job.validation)
      text(job.validation.title)
      text(job.validation.artist)
      number(job.validation.durationMs)
      boolean(job.validation.hasEmbeddedJpeg)
      choice(job.validation.audioCodec, ['mp3'])
      check(typeof job.validation.sha256 === 'string' && /^[a-f0-9]{64}$/.test(job.validation.sha256))
    }
    if (job.stage === 'completed') {
      check(typeof job.outputUri === 'string' && job.outputUri.startsWith('content://'))
      check(job.validation !== null && typeof job.validation === 'object')
      check(job.validation.hasEmbeddedJpeg === true && typeof job.validation.durationMs === 'number' && job.validation.durationMs > 0)
    }
  }
  record(downloads.search)
  text(downloads.search.query)
  choice(downloads.search.state, ['idle', 'searching', 'completed', 'canceled', 'failed'])
  nullableText(downloads.search.error)
  array(downloads.search.results)
  for (const result of downloads.search.results) {
    record(result)
    for (const field of ['id', 'title', 'uploader', 'durationText', 'webpageUrl', 'thumbnailUrl']) text(result[field])
    check(typeof result.webpageUrl === 'string' && /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(result.webpageUrl))
  }
  record(downloads.probePlayback)
  nullableText(downloads.probePlayback.jobId)
  boolean(downloads.probePlayback.isPlaying)
  number(downloads.probePlayback.positionMs)
  number(downloads.probePlayback.durationMs)
  nullableText(downloads.probePlayback.error)
  array(playlists.playlists)
  for (const playlist of playlists.playlists) {
    record(playlist)
    for (const field of ['id', 'libraryId', 'name', 'description', 'createdAt', 'updatedAt']) text(playlist[field])
    array(playlist.trackIds)
    playlist.trackIds.forEach(text)
  }
  choice(settings.platform, ['android', 'web'])
  text(settings.appVersion)
  if (settings.androidApi !== null) number(settings.androidApi)
  array(settings.supportedAbis)
  settings.supportedAbis.forEach(text)
  folder(settings.downloadFolder)
  boolean(settings.cookiesImported)
  choice(settings.toolStatus, ['not-prepared', 'preparing', 'ready', 'failed'])
  nullableText(settings.toolError)
  array(settings.tools)
  for (const tool of settings.tools) {
    record(tool)
    choice(tool.name, ['python', 'yt-dlp', 'ffmpeg', 'ffprobe', 'quickjs'])
    nullableText(tool.version)
    nullableText(tool.sha256)
    boolean(tool.ready)
    if (tool.ready) {
      check(typeof tool.version === 'string' && tool.version.length > 0)
      check(typeof tool.sha256 === 'string' && /^[a-f0-9]{64}$/.test(tool.sha256))
    }
  }
}
