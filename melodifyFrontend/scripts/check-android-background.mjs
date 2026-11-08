import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serial = process.argv[2]
assert.ok(serial && /^[A-Za-z0-9._:-]+$/.test(serial), 'Telefon seri numarası gerekli.')
const appId = 'com.yhcanbay.melodify.debug'
const root = fileURLToPath(new URL('../', import.meta.url))
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || 'C:/Android/sdk'
const adb = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')
const reportRoot = path.join(root, '.cache', 'device-checks')
const preparation = JSON.parse(readFileSync(path.join(reportRoot, 'android-background-preparation.json'), 'utf8'))
const pid = preparation.processId
assert.match(pid, /^\d+$/)

function run(args) {
  const result = spawnSync(adb, ['-s', serial, ...args], { encoding: 'utf8', windowsHide: true, timeout: 15_000, maxBuffer: 4 * 1024 * 1024 })
  if (result.error) throw result.error
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result.stdout
}

// Read only this Melodify process's diagnostic tag. Never clear device logs.
assert.equal(run(['shell', 'pidof', appId]).trim(), pid, 'Deneme sırasında uygulama süreci değişti.')
const deadline = Date.now() + 50_000
let samples = []
while (Date.now() < deadline) {
  const output = run(['logcat', '-d', `--pid=${pid}`, '-v', 'raw', '-t', '2000', 'MelodifyPlayback:I', '*:S'])
  samples = output.split(/\r?\n/).flatMap((line) => { try { return [JSON.parse(line)] } catch { return [] } })
    .filter((record) => record.probeId === preparation.probeId && !record.interactive && record.isPlaying)
  const first = samples[0]
  const last = samples.at(-1)
  if (first && last && last.elapsedMs - first.elapsedMs >= 12_000 && last.transitions > first.transitions) break
  await new Promise((resolve) => setTimeout(resolve, 2000))
}
assert.ok(samples.length > 2, 'Ekran kapalıyken çalma örnekleri bulunamadı.')
const first = samples[0]
const last = samples.at(-1)
assert.ok(last.elapsedMs - first.elapsedMs >= 12_000, 'Ekran kapalı denemesi yeterince uzun sürmedi.')
assert.ok(last.transitions > first.transitions, 'Ekran kapalıyken otomatik tekrar gözlenmedi.')
const services = run(['shell', 'dumpsys', 'activity', 'services', appId])
assert.match(services, /isForeground=true/, 'Melodify medya servisi foreground durumunda değil.')
const report = { processId: pid, probeId: preparation.probeId, screenOffDurationMs: last.elapsedMs - first.elapsedMs, automaticTransitions: last.transitions - first.transitions, foregroundService: true, samples, thirtyMinuteAcceptance: false }
writeFileSync(path.join(reportRoot, 'android-background-playback.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(`Ekran kapalıyken ${report.screenOffDurationMs} ms çalma ve ${report.automaticTransitions} otomatik geçiş doğrulandı. Medya servisi foreground durumda.`)
console.log('Bu kısa doğrulama, 30 dakikalık release kabul testini tamamlamaz. Deneme üç dakika sonunda otomatik durur.')
