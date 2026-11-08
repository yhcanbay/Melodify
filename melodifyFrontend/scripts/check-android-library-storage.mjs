import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const serial = process.argv[2]
assert.ok(serial && /^[A-Za-z0-9._:-]+$/.test(serial), 'Telefon seri numarası gerekli.')
const appId = 'com.yhcanbay.melodify.debug'
const root = fileURLToPath(new URL('../', import.meta.url))
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || 'C:/Android/sdk'
const adb = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')
const reportRoot = path.join(root, '.cache', 'device-checks')
const report = JSON.parse(readFileSync(path.join(reportRoot, 'android-library.json'), 'utf8'))
const copyRoot = path.join(reportRoot, `room-${Date.now()}`)
mkdirSync(copyRoot, { recursive: true })

function run(args, optional = false) {
  const result = spawnSync(adb, ['-s', serial, ...args], { windowsHide: true, timeout: 20_000, maxBuffer: 64 * 1024 * 1024 })
  if (result.error) throw result.error
  if (result.status !== 0 && !optional) throw new Error(result.stderr.toString('utf8') || 'ADB işlemi başarısız.')
  return result
}

let database
try {
  // Stop only Melodify so its SQLite/WAL files can be read consistently.
  // No phone database, grant, setting or user file is changed by this checker.
  run(['shell', 'am', 'force-stop', appId])
  for (const suffix of ['', '-wal', '-shm']) {
    const result = run(['exec-out', 'run-as', appId, 'cat', `databases/melodify-mobile.db${suffix}`], suffix !== '')
    if (result.status === 0) writeFileSync(path.join(copyRoot, `melodify-mobile.db${suffix}`), result.stdout)
  }
  database = new DatabaseSync(path.join(copyRoot, 'melodify-mobile.db'))
  assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check, 'ok')
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(({ name }) => name)
  for (const name of ['libraries', 'tracks', 'download_jobs', 'playback_recovery']) assert.ok(tables.includes(name))
  const selected = database.prepare('SELECT * FROM libraries WHERE selected = 1').all()
  assert.equal(selected.length, 1)
  assert.equal(selected[0].id, report.library.folder.id)
  assert.equal(selected[0].treeUri, report.library.folder.treeUri)
  const tracks = database.prepare('SELECT id, contentUri FROM tracks WHERE libraryId = ? ORDER BY id').all(selected[0].id)
  assert.deepEqual(tracks.map((row) => ({ ...row })), report.library.tracks.map(({ id, contentUri }) => ({ id, contentUri })).sort((a, b) => a.id.localeCompare(b.id)))
  const storageReport = { integrity: 'ok', tables, selectedLibraryId: selected[0].id, persistedTracks: tracks.length, phoneFilesReadOnly: true }
  writeFileSync(path.join(reportRoot, 'android-library-storage.json'), `${JSON.stringify(storageReport, null, 2)}\n`)
  console.log(`Room kalıcılığı doğrulandı: ${tracks.length} parça, tek seçili kitaplık, dört veri tablosu ve sağlam SQLite verisi.`)
} finally {
  database?.close()
  run(['shell', 'am', 'start', '-W', '-n', `${appId}/com.yhcanbay.melodify.MainActivity`])
}
