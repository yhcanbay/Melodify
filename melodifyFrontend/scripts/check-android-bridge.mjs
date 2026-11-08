import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertMobileSnapshot } from '../mobile/src/platform/validateSnapshot.ts'

const serial = process.argv[2]
const initializeTools = process.argv.includes('--initialize-tools')
const verifyCancellation = process.argv.includes('--verify-cancellation')
const downloadTest = process.argv.includes('--download-test')
const playbackTest = process.argv.includes('--playback-test')
const libraryTest = process.argv.includes('--library-test')
const nativePlaybackTest = process.argv.includes('--native-playback-test')
const nativeRecoveryTest = process.argv.includes('--native-recovery-test')
const backgroundPrepare = process.argv.includes('--background-prepare')
const backgroundStop = process.argv.includes('--background-stop')
const phoneUiTest = process.argv.includes('--phone-ui-test')
const keyboardTest = process.argv.includes('--keyboard-test')
const cancelDownloadTest = process.argv.includes('--cancel-download-test')
const searchTest = process.argv.includes('--search-test') || downloadTest
const appId = 'com.yhcanbay.melodify.debug'
const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.platform === 'win32' ? 'C:/Android/sdk' : '')
const adb = path.join(sdkRoot, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')
let port
let socket
let sequence = 0
const pending = new Map()
const ownedProbeJobs = new Set()

function runAdb(args) {
  const result = spawnSync(adb, ['-s', serial, ...args], { encoding: 'utf8', shell: false, windowsHide: true, timeout: 15_000 })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || 'ADB işlemi başarısız.')
  return result.stdout.trim()
}

function command(method, params = {}, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Hata ayıklama zaman aşımı: ${method}`)) }, timeoutMs)
    pending.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression, timeoutMs) {
  const response = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }, timeoutMs)
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || 'WebView kontrolü başarısız.')
  return response.result.value
}

async function waitFor(expression) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return
    await new Promise((resolve) => setTimeout(resolve, 80))
  }
  throw new Error(`Telefon ekranı beklenen duruma gelmedi: ${expression}`)
}

try {
  await (async () => {
  assert.ok(serial && /^[A-Za-z0-9._:-]+$/.test(serial), 'Kullanım: npm run android:check-bridge -- <cihaz-seri-no>')
  assert.ok(process.argv.slice(3).every((argument) => ['--initialize-tools', '--verify-cancellation', '--search-test', '--download-test', '--playback-test', '--cancel-download-test', '--library-test', '--native-playback-test', '--native-recovery-test', '--background-prepare', '--background-stop', '--phone-ui-test', '--keyboard-test'].includes(argument)), 'Bilinmeyen kontrol seçeneği.')
  assert.equal(runAdb(['get-state']), 'device', 'Telefon hata ayıklamaya hazır değil.')
  const pid = runAdb(['shell', 'pidof', appId])
  assert.match(pid, /^\d+$/, 'Önce Melodify Dev uygulamasını açın.')
  // The socket belongs to this application's PID. No other app's WebView is inspected.
  port = runAdb(['forward', 'tcp:0', `localabstract:webview_devtools_remote_${pid}`])
  assert.match(port, /^\d+$/)
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const pages = targets.filter((target) => target.type === 'page' && new URL(target.url).hostname === 'localhost')
  assert.equal(pages.length, 1, 'Melodify WebView hedefi tekil değil.')
  socket = new WebSocket(pages[0].webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  socket.addEventListener('message', (event) => {
    const response = JSON.parse(event.data)
    const request = pending.get(response.id)
    if (!request) return
    clearTimeout(request.timer)
    pending.delete(response.id)
    if (response.error) request.reject(new Error(response.error.message))
    else request.resolve(response.result)
  })
  if (initializeTools) {
    console.log('Araç çalışma zamanı denemesi açıkça başlatıldı; uygulamaya özel çalışma dosyaları hazırlanıyor.')
    await evaluate('window.Capacitor.Plugins.MelodifySettings.initializeTools()', 180_000)
  }
  const snapshot = await evaluate(`(async () => {
    const plugins = window.Capacitor.Plugins
    return {
      library: await plugins.MelodifyLibrary.getSnapshot(),
      playback: await plugins.MelodifyPlayback.getSnapshot(),
      downloads: await plugins.MelodifyDownloads.getSnapshot(),
      playlists: await plugins.MelodifyPlaylists.getSnapshot(),
      settings: await plugins.MelodifySettings.getSnapshot(),
    }
  })()`)
  assertMobileSnapshot(snapshot)
  if (backgroundStop) {
    await evaluate(`window.Capacitor.Plugins.MelodifyPlayback.dispatch({type:'pause'})`)
    await evaluate(`window.Capacitor.Plugins.MelodifyPlayback.dispatch({type:'setRepeat',mode:'off'})`)
    console.log('Yalnız Melodify oynatımı duraklatıldı; telefon ekranına veya ayarlarına müdahale edilmedi.')
    return
  }
  assert.equal(snapshot.settings.platform, 'android')
  assert.ok(snapshot.settings.supportedAbis.includes('arm64-v8a'), 'Bu kabul kontrolü ARM64 telefon içindir.')
  let cancellationReport
  if (verifyCancellation) {
    console.log('Python, FFmpeg ve QuickJS aynı süreç grubunda başlatılıp iptal ediliyor.')
    cancellationReport = await evaluate('window.Capacitor.Plugins.MelodifyDownloads.verifyCancellation()', 35_000)
    assert.equal(cancellationReport.allProcessesStopped, true)
    assert.deepEqual(cancellationReport.processes, ['python', 'ffmpeg', 'quickjs'])
    console.log('Üç native sürecin birlikte çalıştığı ve iptal sonrası tamamının durduğu doğrulandı.')
  }
  await waitFor(`document.querySelector('main h1') !== null && document.querySelector('[role="alert"]') === null`)
  const tabs = [['Kitaplık', 'Kitaplığın'], ['Ara ve indir', 'Ara ve indir'], ['Listeler', 'Listelerin'], ['Sıra', 'Çalma sırası']]
  for (const [label, heading] of tabs) {
    await evaluate(`Array.from(document.querySelectorAll('.mobile-tabs button')).find(button => button.textContent === ${JSON.stringify(label)}).click()`)
    await waitFor(`document.querySelector('main h1')?.textContent === ${JSON.stringify(heading)}`)
  }
  await evaluate(`document.querySelector('[aria-label="Ayarları aç"]').click()`)
  await waitFor(`document.querySelector('main h1')?.textContent === 'Ayarlar'`)
  await evaluate(`document.querySelector('[aria-label="Geri"]').click()`)
  await waitFor(`document.querySelector('main h1')?.textContent === 'Çalma sırası'`)
  if (snapshot.downloads.availability.state === 'not-implemented') {
    const rejection = await evaluate(`window.Capacitor.Plugins.MelodifyDownloads.search({query: 'test'}).then(() => 'unexpected-success', error => error.code)`)
    assert.equal(rejection, 'NOT_IMPLEMENTED')
  }
  let searchReport
  if (searchTest) {
    console.log('Telefon üzerinde canlı YouTube arama denemesi başlatılıyor.')
    await evaluate(`Array.from(document.querySelectorAll('.mobile-tabs button')).find(button => button.textContent === 'Ara ve indir').click()`)
    await waitFor(`document.querySelector('#download-query') !== null`)
    await evaluate(`(() => {
      const input = document.querySelector('#download-query')
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'youtube-dl test video BaW_jenozKc')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })()`)
    await evaluate(`document.querySelector('.mobile-search-form').requestSubmit()`)
    const deadline = Date.now() + 90_000
    while (Date.now() < deadline) {
      searchReport = await evaluate('window.Capacitor.Plugins.MelodifyDownloads.getSnapshot()')
      if (['completed', 'failed', 'canceled'].includes(searchReport.search.state)) break
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    assert.equal(searchReport.search.state, 'completed', searchReport.search.error || 'Arama tamamlanmadı.')
    assert.ok(searchReport.search.results.length > 0, 'Arama sonuç döndürmedi.')
    await waitFor(`document.querySelectorAll('.mobile-search-results li').length > 0`)
    console.log(`Canlı arama ve sonuç ekranı doğrulandı: ${searchReport.search.results.length} sonuç.`)
  }
  let downloadReport
  if (downloadTest) {
    const settings = await evaluate('window.Capacitor.Plugins.MelodifySettings.getSnapshot()')
    assert.equal(settings.downloadFolder?.access, 'granted', 'Önce telefonda indirme klasörünü seçin.')
    const selected = searchReport.search.results.find((result) =>
      ['BaW_jenozKc', 'DTi8wZ1a1TA'].includes(result.id) && result.durationText === '0:10')
    assert.ok(selected, 'Bilinen 10 saniyelik deneme videosu arama sonucunda bulunamadı.')
    const previousIds = new Set(searchReport.jobs.map((job) => job.id))
    await evaluate(`(() => {
      const row = Array.from(document.querySelectorAll('.mobile-search-results li')).find(item => item.querySelector('strong')?.textContent === ${JSON.stringify(selected.title)})
      if (!row || row.querySelector('button').disabled) throw new Error('İndirme düğmesi hazır değil.')
      row.querySelector('button').click()
    })()`)
    const deadline = Date.now() + 300_000
    let lastStage
    while (Date.now() < deadline) {
      const state = await evaluate('window.Capacitor.Plugins.MelodifyDownloads.getSnapshot()')
      downloadReport = state.jobs.find((job) => !previousIds.has(job.id) && job.sourceUrl === selected.webpageUrl)
      if (downloadReport) ownedProbeJobs.add(downloadReport.id)
      if (downloadReport?.stage !== lastStage) {
        lastStage = downloadReport?.stage
        if (lastStage) console.log(`MP3 denemesi: ${lastStage}`)
      }
      if (downloadReport && ['completed', 'failed', 'canceled'].includes(downloadReport.stage)) break
      await new Promise((resolve) => setTimeout(resolve, 700))
    }
    assert.equal(downloadReport?.stage, 'completed', downloadReport?.error || 'MP3 indirme tamamlanmadı.')
    assert.equal(downloadReport.validation.audioCodec, 'mp3')
    assert.equal(downloadReport.validation.hasEmbeddedJpeg, true)
    assert.ok(downloadReport.validation.title && downloadReport.validation.durationMs > 0)
    assert.match(downloadReport.validation.sha256, /^[a-f0-9]{64}$/)
    assert.match(downloadReport.outputUri, /^content:\/\//)
    ownedProbeJobs.delete(downloadReport.id)
    console.log('MP3, gömülü JPG, başlık/süre ve seçilen klasördeki dosyanın SHA-256 eşleşmesi doğrulandı.')
  }
  let playbackReport
  if (playbackTest) {
    assert.equal(runAdb(['shell', 'settings', 'get', 'global', 'airplane_mode_on']), '1', 'Çevrimdışı kabul testi için önce uçak modunu telefondan kendiniz açın.')
    const wifiState = runAdb(['shell', 'settings', 'get', 'global', 'wifi_on'])
    // Android's WifiSettingsStore uses 3 for WIFI_DISABLED_AIRPLANE_ON.
    assert.ok(['0', '3'].includes(wifiState), 'Çevrimdışı kabul testi için Wi-Fi bağlantısını da telefondan kendiniz kapatın.')
    const state = await evaluate('window.Capacitor.Plugins.MelodifyDownloads.getSnapshot()')
    const job = [...state.jobs].reverse().find((item) => item.stage === 'completed')
    assert.ok(job, 'Oynatma için bu uygulama oturumunda tamamlanmış indirme yok.')
    await evaluate(`Array.from(document.querySelectorAll('.mobile-tabs button')).find(button => button.textContent === 'Ara ve indir').click()`)
    await waitFor(`document.querySelectorAll('.mobile-download-job').length > 0`)
    await evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('.mobile-download-job')).find(item => item.querySelector('strong')?.textContent === ${JSON.stringify(job.title)})
      card.querySelector('button').click()
    })()`)
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const current = await evaluate('window.Capacitor.Plugins.MelodifyDownloads.getSnapshot()')
      playbackReport = current.probePlayback
      if (playbackReport.error || (playbackReport.jobId === job.id && playbackReport.isPlaying && playbackReport.positionMs >= 1500)) break
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    assert.equal(playbackReport.error, null, playbackReport.error || '')
    assert.equal(playbackReport.jobId, job.id)
    assert.equal(playbackReport.isPlaying, true)
    assert.ok(playbackReport.positionMs >= 1500 && playbackReport.durationMs > 0)
    await evaluate('window.Capacitor.Plugins.MelodifyDownloads.pauseProbe()')
    await waitFor(`window.Capacitor.Plugins.MelodifyDownloads.getSnapshot().then(state => !state.probePlayback.isPlaying)`)
    console.log('Uçak modunda seçilen klasördeki content URI üzerinden oynatma ve duraklatma doğrulandı.')
  }
  const downloadCancellationReports = []
  if (cancelDownloadTest) {
    const uid = runAdb(['shell', 'run-as', appId, 'id', '-u'])
    assert.match(uid, /^\d+$/)
    function ownToolProcesses() {
      return runAdb(['shell', 'run-as', appId, 'ps', '-w', '-u', uid, '-o', 'PID,ARGS'])
        .split('\n').map((line) => line.trim().match(/^(\d+)\s+(\S+)/)).filter(Boolean)
        .map((match) => ({ pid: Number(match[1]), name: path.posix.basename(match[2]) }))
        .filter((process) => ['libpython.so', 'libffmpeg.so', 'libqjs.so'].includes(process.name))
    }
    const settings = await evaluate('window.Capacitor.Plugins.MelodifySettings.getSnapshot()')
    assert.equal(settings.downloadFolder?.access, 'granted', 'İptal denemesi için seçilmiş klasör gerekli.')
    await evaluate(`Array.from(document.querySelectorAll('.mobile-tabs button')).find(button => button.textContent === 'Ara ve indir').click()`)
    for (const phase of ['downloading', 'converting']) {
      assert.equal(ownToolProcesses().length, 0, 'Önceki denemeden çalışan araç süreci kaldı.')
      const result = await evaluate(`window.Capacitor.Plugins.MelodifyDownloads.enqueueCancellationProbe(${JSON.stringify({ phase, targetFolderId: settings.downloadFolder.id })})`)
      const jobId = result.jobId
      ownedProbeJobs.add(jobId)
      assert.match(jobId, /^[a-f0-9-]+$/)
      const deadline = Date.now() + 90_000
      let processes = []
      let activeJob
      while (Date.now() < deadline) {
        const state = await evaluate('window.Capacitor.Plugins.MelodifyDownloads.getSnapshot()')
        activeJob = state.jobs.find((job) => job.id === jobId)
        if (['failed', 'completed', 'canceled'].includes(activeJob?.stage)) break
        processes = ownToolProcesses()
        const required = phase === 'converting' ? 'libffmpeg.so' : 'libpython.so'
        if (activeJob?.stage === phase && processes.some((process) => process.name === required)) break
        await new Promise((resolve) => setTimeout(resolve, 150))
      }
      assert.equal(activeJob?.stage, phase, activeJob?.error || 'Beklenen indirme aşaması gözlenemedi.')
      assert.ok(processes.some((process) => process.name === (phase === 'converting' ? 'libffmpeg.so' : 'libpython.so')))
      await waitFor(`document.querySelector('[data-job-id="${jobId}"] button') !== null`)
      await evaluate(`document.querySelector('[data-job-id="${jobId}"] button').click()`)
      const stopDeadline = Date.now() + 12_000
      while (Date.now() < stopDeadline) {
        const state = await evaluate('window.Capacitor.Plugins.MelodifyDownloads.getSnapshot()')
        activeJob = state.jobs.find((job) => job.id === jobId)
        if (activeJob?.stage === 'canceled') break
        await new Promise((resolve) => setTimeout(resolve, 150))
      }
      assert.equal(activeJob?.stage, 'canceled', activeJob?.error || 'İndirme iptal edilmedi.')
      assert.equal(activeJob.outputUri, null, 'İptal edilen iş hedefe dosya kaydetmemeli.')
      assert.equal(ownToolProcesses().length, 0, 'İptal sonrası Melodify araç süreci kaldı.')
      downloadCancellationReports.push({ phase, jobId, observedProcesses: processes, allProcessesStopped: true, outputUri: null })
      ownedProbeJobs.delete(jobId)
      console.log(`Gerçek ${phase} aşamasında arayüzden iptal ve tüm araç süreçlerinin durması doğrulandı.`)
    }
  }
  for (const options of [{}, { enabled: 'true' }, { enabled: 1 }, { enabled: null }]) {
    const backValidation = await evaluate(`window.Capacitor.Plugins.MelodifySettings.setBackNavigation(${JSON.stringify(options)}).then(() => 'unexpected-success', error => error.code)`)
    assert.equal(backValidation, 'INVALID_ARGUMENT')
  }
  let nativePlaybackReport
  const playbackState = () => evaluate('window.Capacitor.Plugins.MelodifyPlayback.getSnapshot()')
  const dispatchPlayback = (command) => evaluate(`window.Capacitor.Plugins.MelodifyPlayback.dispatch(${JSON.stringify(command)})`, 30_000)
  async function waitPlayback(predicate, label, timeoutMs = 12_000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const state = await playbackState()
      assert.equal(state.error, null, state.error)
      if (predicate(state)) return state
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error(`Native oynatıcı beklenen duruma gelmedi: ${label}`)
  }
  if (nativePlaybackTest) {
    await evaluate(`Array.from(document.querySelectorAll('.mobile-tabs button')).find(button => button.textContent === 'Kitaplık').click()`)
    await waitFor(`document.querySelector('[data-track-id] button') !== null`)
    await evaluate(`document.querySelector('[data-track-id] button').click()`)
    const started = await waitPlayback((state) => state.isPlaying && state.positionMs > 600 && state.durationMs > 0, 'kitaplıktan oynatma')
    await dispatchPlayback({ type: 'pause' })
    await waitPlayback((state) => !state.isPlaying, 'duraklatma')
    await dispatchPlayback({ type: 'seek', positionMs: 4500 })
    await evaluate(`window.Capacitor.Plugins.MelodifyPlayback.debugSessionCommand({command:'previous'})`)
    await waitPlayback((state) => state.positionMs < 500, 'medya oturumundan önceki')
    await evaluate(`window.Capacitor.Plugins.MelodifyPlayback.debugSessionCommand({command:'play'})`)
    await waitPlayback((state) => state.isPlaying, 'medya oturumundan oynat')
    await evaluate(`window.Capacitor.Plugins.MelodifyPlayback.debugSessionCommand({command:'next'})`)
    await waitPlayback((state) => state.isPlaying && state.positionMs < 1500, 'medya oturumundan sonraki')
    await dispatchPlayback({ type: 'setVolume', volume: 0.2 })
    assert.ok(Math.abs((await playbackState()).volume - 0.2) < 0.01)
    await dispatchPlayback({ type: 'setRepeat', mode: 'once' })
    await dispatchPlayback({ type: 'seek', positionMs: started.durationMs - 600 })
    await waitPlayback((state) => state.isPlaying && state.repeatPass === 1 && state.positionMs < 2000, 'bir kez tekrarın ikinci çalması')
    await dispatchPlayback({ type: 'seek', positionMs: started.durationMs - 600 })
    await waitPlayback((state) => !state.isPlaying && state.positionMs > state.durationMs - 1000, 'ikinci çalmadan sonra otomatik durma')
    await dispatchPlayback({ type: 'setRepeat', mode: 'one' })
    await dispatchPlayback({ type: 'seek', positionMs: started.durationMs - 600 })
    await dispatchPlayback({ type: 'play' })
    await waitPlayback((state) => state.isPlaying && state.positionMs < 2000, 'sürekli tekrar')
    await dispatchPlayback({ type: 'setShuffle', enabled: true })
    await dispatchPlayback({ type: 'setShuffle', enabled: false })
    await dispatchPlayback({ type: 'setRepeat', mode: 'off' })
    await dispatchPlayback({ type: 'setVolume', volume: started.volume })
    await dispatchPlayback({ type: 'seek', positionMs: 2400 })
    await dispatchPlayback({ type: 'pause' })
    const saved = await waitPlayback((state) => !state.isPlaying && state.positionMs >= 2000, 'kurtarma konumu')
    for (const invalid of [{ type: 'seek', positionMs: -1 }, { type: 'setVolume', volume: 2 }, { type: 'setShuffle', enabled: 'true' }, { type: 'setRepeat', mode: 'all' }, { type: 'loadQueue', tracks: [{ id: 'bad', contentUri: 'file:///etc/passwd' }], startTrackId: 'bad' }]) {
      const rejection = await evaluate(`window.Capacitor.Plugins.MelodifyPlayback.dispatch(${JSON.stringify(invalid)}).then(() => 'unexpected-success', error => error.code)`)
      assert.equal(rejection, 'INVALID_ARGUMENT')
    }
    nativePlaybackReport = { processId: pid, started, saved, mediaSessionCommands: true, onceRepeat: true, continuousRepeat: true, appVolume: true, invalidCommandsRejected: true }
    console.log('Native Media3: gerçek URI oynatma, sarma, medya oturumu komutları, iki tekrar modu, ses ve girdi doğrulaması geçti.')
  }
  if (nativeRecoveryTest) {
    const prior = JSON.parse(readFileSync(path.join(projectRoot, '.cache', 'device-checks', 'android-native-playback.json'), 'utf8'))
    assert.notEqual(pid, prior.processId, 'Kurtarma testi için önce yalnız Melodify yeniden başlatılmalı.')
    const restored = await waitPlayback((state) => !state.restoring && state.queue.length > 0, 'Room kuyruk kurtarması')
    assert.equal(restored.isPlaying, false, 'Kurtarma otomatik ses başlatmamalı.')
    assert.deepEqual(restored.queue.map(({ id }) => id), prior.saved.queue.map(({ id }) => id))
    assert.equal(restored.currentTrackId, prior.saved.currentTrackId)
    assert.ok(Math.abs(restored.positionMs - prior.saved.positionMs) < 500, 'Son konum korunmadı.')
    await dispatchPlayback({ type: 'play' })
    await waitPlayback((state) => state.isPlaying && state.positionMs > restored.positionMs + 500, 'kurtarılan konumdan sürdürme')
    await dispatchPlayback({ type: 'pause' })
    nativePlaybackReport = { ...prior, restoredProcessId: pid, restored, recoveryVerified: true }
    console.log('Farklı uygulama sürecinde kuyruk/konum kurtarması ve kullanıcı komutuyla kaldığı yerden sürdürme doğrulandı.')
  }
  let keyboardReport
  if (keyboardTest) {
    await evaluate(`Array.from(document.querySelectorAll('.mobile-tabs button')).find(button => button.textContent === 'Kitaplık').click()`)
    await waitFor(`document.querySelector('#library-query') !== null`)
    const before = await evaluate(`({height:visualViewport.height,layoutHeight:innerHeight})`)
    const input = await evaluate(`(() => { const input = document.querySelector('#library-query'); input.scrollIntoView({block:'center'}); const rect = input.getBoundingClientRect(); return {x:rect.left + rect.width/2, y:rect.top + rect.height/2} })()`)
    await command('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[input]})
    await command('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]})
    await waitFor(`document.activeElement?.id === 'library-query' && visualViewport.height < ${before.height - 100}`)
    const after = await evaluate(`(() => { const input = document.querySelector('#library-query').getBoundingClientRect(); return {height:visualViewport.height,layoutHeight:innerHeight,inputTop:input.top,inputBottom:input.bottom,viewportTop:visualViewport.offsetTop} })()`)
    assert.ok(after.inputTop >= after.viewportTop && after.inputBottom <= after.height + after.viewportTop, 'Arama alanı klavyenin arkasında kaldı.')
    keyboardReport = {before,after,searchFieldVisible:true}
    await evaluate(`document.querySelector('#library-query').blur()`)
    console.log('Gerçek Android klavyesi açıldığında arama alanının görünür kaldığı doğrulandı.')
  }
  let phoneUiReport
  if (phoneUiTest) {
    await evaluate(`Array.from(document.querySelectorAll('.mobile-tabs button')).find(button => button.textContent === 'Kitaplık').click()`)
    await waitFor(`document.querySelector('.mobile-library-viewport [data-track-id] button') !== null`)
    await evaluate(`document.querySelector('[data-track-id] button').click()`)
    await waitPlayback((state) => state.isPlaying && state.positionMs > 300, 'telefon arayüzünden oynat')
    await waitFor(`document.querySelector('[aria-label="Mini oynatıcıdan duraklat"]') !== null`)
    await evaluate(`document.querySelector('[aria-label="Mini oynatıcıdan duraklat"]').click()`)
    await waitPlayback((state) => !state.isPlaying, 'mini oynatıcıdan duraklat')
    await evaluate(`document.querySelector('.mobile-mini-player').click()`)
    await waitFor(`document.querySelector('main h1')?.textContent === 'Şimdi çalıyor'`)
    await waitFor(`document.querySelector('.mobile-player-art img')?.naturalWidth > 0`)
    await evaluate(`(() => { const input = document.querySelector('[aria-label="Parça konumu"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '2400'); input.dispatchEvent(new Event('input', {bubbles:true})) })()`)
    await evaluate(`document.querySelector('[aria-label="Parça konumu"]').dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowRight',bubbles:true}))`)
    await waitPlayback((state) => !state.isPlaying && Math.abs(state.positionMs - 2400) < 400, 'sürgüden konum ayarı')
    await waitFor(`Math.abs(Number(document.querySelector('[aria-label="Parça konumu"]')?.value) - 2400) < 400 && document.querySelector('.mobile-player-controls label')?.textContent.includes('0:02')`)
    await command('Accessibility.enable')
    const accessibility = await command('Accessibility.getFullAXTree')
    assert.ok(accessibility.nodes.some((node) => node.role?.value === 'slider' && node.name?.value === 'Parça konumu'), 'Erişilebilir konum sürgüsü bulunamadı.')
    const controlsVisible = await evaluate(`(() => { const main = document.querySelector('main').getBoundingClientRect(); const controls = document.querySelector('.mobile-playback-buttons').getBoundingClientRect(); return controls.top >= main.top && controls.bottom <= main.bottom })()`)
    assert.equal(controlsVisible, true, 'Temel oynatma düğmeleri ilk ekranda görünmüyor.')
    const playerScreenshot = await command('Page.captureScreenshot', {format:'png'})
    mkdirSync(path.join(projectRoot, '.cache', 'device-checks'), {recursive:true})
    writeFileSync(path.join(projectRoot, '.cache', 'device-checks', 'mobile-player.png'), Buffer.from(playerScreenshot.data, 'base64'))
    await evaluate(`document.documentElement.style.fontSize = '24px'`)
    const layout = await evaluate(`(() => { const main = document.querySelector('main'); return { width: innerWidth, mainWidth:main.clientWidth, mainContentWidth:main.scrollWidth, pageWidth:document.documentElement.scrollWidth, minButtonHeight:Math.min(...Array.from(document.querySelectorAll('button')).filter(button => button.getClientRects().length).map(button => button.getBoundingClientRect().height)) } })()`)
    assert.ok(layout.pageWidth <= layout.width && layout.mainContentWidth <= layout.mainWidth, 'Büyük yazıda yatay taşma var.')
    assert.ok(layout.minButtonHeight >= 48, 'Dokunma hedefi 48 px altında.')
    await evaluate(`document.documentElement.style.removeProperty('font-size'); document.querySelector('[aria-label="Geri"]').click()`)
    await waitFor(`document.querySelector('main h1')?.textContent === 'Kitaplığın'`)
    await evaluate(`document.querySelector('[aria-label="Ayarları aç"]').click()`)
    await waitFor(`document.querySelector('main h1')?.textContent === 'Ayarlar'`)
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('main button')).filter(button => button.textContent.includes('klasörünü değiştir')).length`), 2)
    await evaluate(`window.Capacitor.Plugins.MelodifySettings.setBackNavigation({enabled:true})`)
    await evaluate(`window.Capacitor.Plugins.MelodifySettings.debugRequestBack()`)
    await waitFor(`document.querySelector('main h1')?.textContent === 'Kitaplığın'`)
    await evaluate(`Array.from(document.querySelectorAll('.mobile-tabs button')).find(button => button.textContent === 'Listeler').click()`)
    await waitFor(`document.querySelector('main h1')?.textContent === 'Listelerin'`)
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('main button')).some(button => button.textContent === 'Yeni liste')`), false, 'Hazır olmayan native liste işlemi görünmemeli.')
    phoneUiReport = { layout, realArtwork:true, miniPlayer:true, seekSlider:true, accessibleSlider:true, primaryControlsInitiallyVisible:controlsVisible, nativeBackDispatcher:true, folderControls:2, unimplementedPlaylistsHidden:true }
    console.log('Telefon arayüzü: gerçek kapak, mini/tam oynatıcı, konum sürgüsü, erişilebilirlik ağacı, büyük yazı ve native geri davranışı doğrulandı.')
  }
  let libraryReport
  if (libraryTest) {
    await evaluate(`Array.from(document.querySelectorAll('.mobile-tabs button')).find(button => button.textContent === 'Kitaplık').click()`)
    await waitFor(`document.querySelector('#library-query') !== null`)
    const before = await evaluate('window.Capacitor.Plugins.MelodifyLibrary.getSnapshot()')
    assert.equal(before.folder?.access, 'granted', 'Önce kullanıcı kitaplık klasörünü seçmeli.')
    assert.ok(before.tracks.length > 0, 'Kitaplıkta doğrulanacak ses dosyası bulunamadı.')
    const after = await evaluate('window.Capacitor.Plugins.MelodifyLibrary.scan()', 60_000)
    assert.equal(after.error, null)
    assert.equal(after.scanning, false)
    assert.equal(after.folder.id, before.folder.id)
    assert.deepEqual(after.tracks.map(({ id, contentUri }) => ({ id, contentUri })), before.tracks.map(({ id, contentUri }) => ({ id, contentUri })), 'Yeniden tarama parça kimliklerini değiştirdi.')
    const reportPath = path.join(projectRoot, '.cache', 'device-checks', 'android-library.json')
    let restartVerified = false
    if (existsSync(reportPath)) {
      const prior = JSON.parse(readFileSync(reportPath, 'utf8'))
      if (prior.library.folder.id === after.folder.id && prior.processId !== pid) {
        assert.deepEqual(after.tracks.map(({ id, contentUri }) => ({ id, contentUri })), prior.library.tracks.map(({ id, contentUri }) => ({ id, contentUri })), 'Süreç yeniden açılınca parça kimlikleri değişti.')
        restartVerified = true
      }
    }
    await waitFor(`document.querySelectorAll('[data-track-id]').length > 0`)
    await waitFor(`Array.from(document.querySelectorAll('.mobile-track-cover img')).some(img => img.complete && img.naturalWidth > 0)`)
    const cover = await evaluate(`(() => { const img = Array.from(document.querySelectorAll('.mobile-track-cover img')).find(img => img.naturalWidth > 0); return { width: img.naturalWidth, height: img.naturalHeight, uri: img.src } })()`)
    assert.ok(cover.width <= 384 && cover.height <= 384, 'Kapak boyutu sınırı aşıldı.')
    await evaluate(`(() => { const input = document.querySelector('#library-query'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '__melodify_no_match__'); input.dispatchEvent(new Event('input', { bubbles: true })) })()`)
    await waitFor(`document.querySelectorAll('[data-track-id]').length === 0`)
    await evaluate(`(() => { const input = document.querySelector('#library-query'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ''); input.dispatchEvent(new Event('input', { bubbles: true })) })()`)
    await waitFor(`document.querySelectorAll('[data-track-id]').length > 0`)
    const currentSettings = await evaluate('window.Capacitor.Plugins.MelodifySettings.getSnapshot()')
    assert.deepEqual(currentSettings.downloadFolder, snapshot.settings.downloadFolder, 'Kitaplık taraması indirme hedefini değiştirdi.')
    libraryReport = { processId: pid, restartVerified, library: after, cover, downloadFolder: currentSettings.downloadFolder }
    console.log(`Kitaplık: ${after.tracks.length} parça, kalıcı kimlikler, arama, JPEG kapak ve ayrı indirme hedefi doğrulandı. Süreç yeniden açılışı: ${restartVerified}.`)
  }
  // Return to the app's home screen; never change system settings or delete phone files.
  if (!searchTest && !playbackTest && !cancelDownloadTest) {
    await evaluate(`Array.from(document.querySelectorAll('.mobile-tabs button')).find(button => button.textContent === 'Kitaplık').click()`)
    await waitFor(`document.querySelector('main h1')?.textContent === 'Kitaplığın'`)
  }
  const screenshot = await command('Page.captureScreenshot', { format: 'png' })
  const reportRoot = path.join(projectRoot, '.cache', 'device-checks')
  mkdirSync(reportRoot, { recursive: true })
  const screenshotName = libraryTest ? 'mobile-library.png' : playbackTest ? 'mobile-offline-playback.png' : cancelDownloadTest ? 'mobile-download-cancellation.png' : searchTest ? 'mobile-download-search.png' : 'mobile-foundation.png'
  writeFileSync(path.join(reportRoot, screenshotName), Buffer.from(screenshot.data, 'base64'))
  if (libraryReport) writeFileSync(path.join(reportRoot, 'android-library.json'), `${JSON.stringify(libraryReport, null, 2)}\n`)
  if (nativePlaybackReport) writeFileSync(path.join(reportRoot, 'android-native-playback.json'), `${JSON.stringify(nativePlaybackReport, null, 2)}\n`)
  if (phoneUiReport) writeFileSync(path.join(reportRoot, 'android-phone-ui.json'), `${JSON.stringify(phoneUiReport, null, 2)}\n`)
  if (keyboardReport) writeFileSync(path.join(reportRoot, 'android-keyboard.json'), `${JSON.stringify(keyboardReport, null, 2)}\n`)
  if (backgroundPrepare) {
    const probe = await evaluate(`window.Capacitor.Plugins.MelodifyPlayback.debugStartBackgroundProbe({durationMs:180000})`)
    writeFileSync(path.join(reportRoot, 'android-background-preparation.json'), `${JSON.stringify({ ...probe, processId: pid }, null, 2)}\n`)
    console.log('Ekran kapalı denemesi başlatıldı; üç dakika sonunda kendiliğinden duracak. Ekranı kullanıcı kapatmalı.')
  }
  if (searchReport) writeFileSync(path.join(reportRoot, 'android-search.json'), `${JSON.stringify(searchReport.search, null, 2)}\n`)
  if (downloadReport) writeFileSync(path.join(reportRoot, 'android-download.json'), `${JSON.stringify(downloadReport, null, 2)}\n`)
  if (playbackReport) writeFileSync(path.join(reportRoot, 'android-offline-playback.json'), `${JSON.stringify(playbackReport, null, 2)}\n`)
  if (downloadCancellationReports.length) writeFileSync(path.join(reportRoot, 'android-download-cancellation.json'), `${JSON.stringify(downloadCancellationReports, null, 2)}\n`)
  if (cancellationReport) writeFileSync(path.join(reportRoot, 'android-cancellation.json'), `${JSON.stringify(cancellationReport, null, 2)}\n`)
  if (initializeTools) {
    assert.equal(snapshot.settings.toolStatus, 'ready')
    assert.equal(snapshot.settings.tools.length, 5)
    assert.ok(snapshot.settings.tools.every((tool) => tool.ready && tool.version && tool.sha256))
    writeFileSync(path.join(reportRoot, 'android-tools.json'), `${JSON.stringify(snapshot.settings, null, 2)}\n`)
    for (const tool of snapshot.settings.tools) console.log(`${tool.name}: ${tool.version} | SHA256 ${tool.sha256}`)
  }
  console.log(`ARM64 Android API ${snapshot.settings.androidApi}: 5 native köprü, 4 sekme, Ayarlar/geri dönüş ve hata sözleşmeleri doğrulandı.`)
  console.log(`Ekran görüntüsü: .cache/device-checks/${screenshotName}`)
  })()
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    if (nativePlaybackTest || nativeRecoveryTest || phoneUiTest) {
      try { await evaluate(`window.Capacitor.Plugins.MelodifyPlayback.dispatch({type:'pause'})`) } catch { /* Keep cleanup scoped to this app. */ }
    }
    if (phoneUiTest) { try { await evaluate(`document.documentElement.style.removeProperty('font-size')`) } catch { /* App WebView may be closed. */ } }
    if (keyboardTest) { try { await evaluate(`document.querySelector('#library-query')?.blur()`) } catch { /* App WebView may be closed. */ } }
    for (const jobId of ownedProbeJobs) {
      try { await evaluate(`window.Capacitor.Plugins.MelodifyDownloads.cancel(${JSON.stringify({ jobId })})`) } catch { /* Already finished or canceled. */ }
    }
  }
  socket?.close()
  for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Hata ayıklama bağlantısı kapandı.')) }
  pending.clear()
  if (port) {
    try { runAdb(['forward', '--remove', `tcp:${port}`]) } catch (error) { console.error(error.message); process.exitCode = 1 }
  }
}
