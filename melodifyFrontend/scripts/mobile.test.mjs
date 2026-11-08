import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initialNavigation, reduceNavigation } from '../mobile/src/app/navigation.ts'
import { createPreviewSnapshot } from '../mobile/src/platform/initialSnapshot.ts'
import { createSnapshotStore } from '../mobile/src/platform/snapshotStore.ts'
import { manageSubscriptions } from '../mobile/src/platform/subscriptions.ts'
import { assertMobileSnapshot } from '../mobile/src/platform/validateSnapshot.ts'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

test('Ayarlar ve oynatıcıdan geri dönüş, seçili ana sekmeyi korur', () => {
  const downloads = reduceNavigation(initialNavigation, { type: 'selectTab', tab: 'downloads' })
  for (const type of ['openSettings', 'openPlayer']) {
    assert.deepEqual(reduceNavigation(reduceNavigation(downloads, { type }), { type: 'back' }), downloads)
  }
  assert.deepEqual(reduceNavigation(downloads, { type: 'back' }), initialNavigation)
})

test('Ana sekme seçimi açık katmanı kapatır', () => {
  const settings = reduceNavigation(initialNavigation, { type: 'openSettings' })
  assert.deepEqual(reduceNavigation(settings, { type: 'selectTab', tab: 'playlists' }), { tab: 'playlists', overlay: null, playlistId: null })
})

test('Liste ayrıntısından Ayarlar ve oynatıcıya geçiş geri dönüş sırasını korur', () => {
  const detail = reduceNavigation(initialNavigation, { type: 'openPlaylist', playlistId: 'playlist-1' })
  for (const type of ['openSettings', 'openPlayer']) {
    assert.deepEqual(reduceNavigation(reduceNavigation(detail, { type }), { type: 'back' }), detail)
  }
  const list = reduceNavigation(detail, { type: 'back' })
  assert.deepEqual(list, { tab: 'playlists', overlay: null, playlistId: null })
  assert.deepEqual(reduceNavigation(list, { type: 'back' }), initialNavigation)
})

test('Tarayıcı durumu cihaz işlemlerini kullanılabilir göstermez ve değiştirilebilir ortak nesne paylaşmaz', () => {
  const first = createPreviewSnapshot()
  assertMobileSnapshot(first)
  assert.equal(first.settings.platform, 'web')
  for (const feature of Object.values(first)) assert.equal(feature.availability.state, 'unavailable')
  first.settings.tools[0].ready = true
  assert.equal(createPreviewSnapshot().settings.tools[0].ready, false)
})

test('Uyumsuz native protokol ve bozuk medya verisi reddedilir', () => {
  const invalidProtocol = createPreviewSnapshot()
  invalidProtocol.settings.protocolVersion = 99
  assert.throws(() => assertMobileSnapshot(invalidProtocol), { code: 'BRIDGE_VERSION_MISMATCH' })
  const invalidTrack = createPreviewSnapshot()
  invalidTrack.library.tracks = [{ id: 'track', contentUri: 'C:\\Music\\song.mp3' }]
  assert.throws(() => assertMobileSnapshot(invalidTrack), { code: 'INVALID_SNAPSHOT' })
  const invalidProgress = createPreviewSnapshot()
  invalidProgress.downloads.jobs = [{ id: 'job', sourceUrl: 'url', targetFolderId: 'folder', title: 'track', stage: 'downloading', progress: 150, error: null, outputUri: null }]
  assert.throws(() => assertMobileSnapshot(invalidProgress), { code: 'INVALID_SNAPSHOT' })
  const invalidTool = createPreviewSnapshot()
  invalidTool.settings.tools[0].ready = true
  assert.throws(() => assertMobileSnapshot(invalidTool), { code: 'INVALID_SNAPSHOT' })
})

test('Erişilemeyen kitaplık ve eksik parça son kimlikleriyle görüntülenebilir', () => {
  const snapshot = createPreviewSnapshot()
  snapshot.library.folder = { id: 'library', treeUri: 'content://test/tree/music', name: 'Müzik', access: 'unmounted' }
  snapshot.library.tracks = [{ id: 'stable-track', libraryId: 'library', contentUri: 'content://test/track/1', fileName: 'Parça.mp3', relativePath: 'Albüm/Parça.mp3', title: 'Parça', artist: null, durationMs: null, youtubeId: null, access: 'missing', modifiedTimeMs: 0, sizeBytes: 0 }]
  assertMobileSnapshot(snapshot)
  snapshot.library.folder.access = 'revoked'
  assertMobileSnapshot(snapshot)
  snapshot.library.tracks[0].access = 'granted'
  assert.throws(() => assertMobileSnapshot(snapshot), { code: 'INVALID_SNAPSHOT' })
})

test('Tamamlandı durumu doğrulanmış MP3, kapak ve gerçek çıktı URI gerektirir', () => {
  const snapshot = createPreviewSnapshot()
  const job = {
    id: 'job', sourceUrl: 'https://www.youtube.com/watch?v=BaW_jenozKc', targetFolderId: 'folder',
    title: 'Deneme', stage: 'completed', progress: 100, error: null, outputUri: 'content://test/audio/1',
    validation: { title: 'Deneme', artist: '', durationMs: 10000, hasEmbeddedJpeg: true, audioCodec: 'mp3', sha256: 'a'.repeat(64) },
  }
  snapshot.downloads.jobs = [job]
  assertMobileSnapshot(snapshot)
  job.outputUri = 'C:\\Music\\song.mp3'
  assert.throws(() => assertMobileSnapshot(snapshot), { code: 'INVALID_SNAPSHOT' })
  job.outputUri = 'content://test/audio/1'
  job.validation.hasEmbeddedJpeg = false
  assert.throws(() => assertMobileSnapshot(snapshot), { code: 'INVALID_SNAPSHOT' })
})

test('Oynatıcı kurtarması duraklatılmış konum ve tekrar sayacını doğrular', () => {
  const snapshot = createPreviewSnapshot()
  snapshot.playback.positionMs = 2400
  snapshot.playback.durationMs = 9936
  snapshot.playback.repeat = 'once'
  snapshot.playback.repeatPass = 1
  snapshot.playback.volume = 0.2
  assertMobileSnapshot(snapshot)
  snapshot.playback.volume = 1.5
  assert.throws(() => assertMobileSnapshot(snapshot), { code: 'INVALID_SNAPSHOT' })
  snapshot.playback.volume = 1
  snapshot.playback.repeatPass = 2
  assert.throws(() => assertMobileSnapshot(snapshot), { code: 'INVALID_SNAPSHOT' })
})

test('Öne dönüşte alınan yeni native durumu eski istek sonucuyla değişmez', async () => {
  const older = deferred()
  const newer = deferred()
  let reads = 0
  const store = createSnapshotStore(() => (++reads === 1 ? older.promise : newer.promise), String)
  const firstRefresh = store.refresh()
  const secondRefresh = store.refresh()
  const latest = createPreviewSnapshot()
  latest.playback.positionMs = 42000
  newer.resolve(latest)
  await secondRefresh
  older.resolve(createPreviewSnapshot())
  await firstRefresh
  assert.equal(store.getSnapshot().snapshot.playback.positionMs, 42000)
  store.dispose()
})

test('Yenileme hatası son durumu korur ve tekrar denemeyle düzelir', async () => {
  let fail = false
  const store = createSnapshotStore(async () => {
    if (fail) throw new Error('Bağlantı kesildi')
    return createPreviewSnapshot()
  }, (error) => error.message)
  await store.refresh()
  fail = true
  await store.refresh()
  assert.equal(store.getSnapshot().phase, 'error')
  assert.equal(store.getSnapshot().error, 'Bağlantı kesildi')
  assert.ok(store.getSnapshot().snapshot)
  fail = false
  await store.refresh()
  assert.equal(store.getSnapshot().phase, 'ready')
  assert.equal(store.getSnapshot().error, null)
  store.dispose()
})

test('Kapatılmış ekranın bekleyen isteği durum veya abonelik güncellemez', async () => {
  const request = deferred()
  const store = createSnapshotStore(() => request.promise, String)
  let changes = 0
  store.subscribe(() => changes++)
  const refresh = store.refresh()
  store.dispose()
  request.resolve(createPreviewSnapshot())
  await refresh
  assert.equal(changes, 1)
  assert.equal(store.getSnapshot().snapshot, null)
})

test('Geç kurulan native abonelik kapanıştan sonra yalnız bir kez temizlenir', async () => {
  const registration = deferred()
  let removed = 0
  const unsubscribe = manageSubscriptions([registration.promise], (error) => { throw error })
  unsubscribe()
  unsubscribe()
  registration.resolve({ remove: async () => { removed++ } })
  await registration.promise
  await Promise.resolve()
  assert.equal(removed, 1)
})

test('Aktif native abonelik temizlenir ve kayıt hatası bildirilir', async () => {
  let removed = 0
  const errors = []
  const unsubscribe = manageSubscriptions([
    Promise.resolve({ remove: async () => { removed++ } }),
    Promise.reject(new Error('Olay bağlantısı kurulamadı')),
  ], (error) => errors.push(error.message))
  await new Promise((resolve) => setImmediate(resolve))
  unsubscribe()
  await Promise.resolve()
  assert.equal(removed, 1)
  assert.deepEqual(errors, ['Olay bağlantısı kurulamadı'])
})
