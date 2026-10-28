const electron = require('electron')
const { spawnSync, execFile } = require('node:child_process')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { promisify } = require('node:util')

const root = path.resolve(__dirname, '..')
if (typeof electron === 'string') {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const result = spawnSync(electron, [__filename], {
    cwd: root, env, stdio: 'inherit', windowsHide: true, timeout: 45000,
  })
  if (result.error) console.error(result.error)
  process.exit(result.status ?? 1)
}
if (process.platform !== 'win32') {
  console.log('SKIP: Windows taskbar regression check requires Windows')
  process.exit(0)
}

const { app, BrowserWindow, ipcMain, nativeTheme } = electron
const ts = require('typescript')
const cache = path.join(root, 'node_modules/.cache/melodify-taskbar-check')
fs.mkdirSync(cache, { recursive: true })
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'electron/taskbar.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
})
fs.writeFileSync(path.join(cache, 'taskbar.cjs'), compiled.outputText)
const { attachTaskbarMediaControls } = require(path.join(cache, 'taskbar.cjs'))
app.setPath('userData', path.join(cache, 'profile'))
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.disableHardwareAcceleration()
app.on('window-all-closed', () => {})

const tracks = ['Birinci Şarkı', 'İkinci Şarkı'].map((title, index) => ({
  id: `C:/Melodify test/${index}.wav`, filePath: `C:/Melodify test/${index}.wav`,
  fileName: `${title}.wav`, title, extension: 'wav', modifiedTimeMs: index,
}))
const wav = Buffer.alloc(44 + 8000 * 120 * 2)
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40)
ipcMain.handle('library:load-last', () => ({ folderPath: 'C:/Melodify test', tracks }))
ipcMain.handle('library:load-last-download-folder', () => null)
ipcMain.handle('library:load-track-payload', () => ({
  mimeType: 'audio/wav', data: wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength),
}))
ipcMain.handle('library:load-tracks-covers', () => ({}))
ipcMain.handle('playlists:load-all', () => [])

const run = promisify(execFile)
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(check, label) {
  const deadline = Date.now() + 7000
  while (Date.now() < deadline) {
    if (await check()) return
    await wait(30)
  }
  throw new Error(`Timed out: ${label}`)
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.yhcanbay.melodify.taskbar-regression')
  const assets = path.join(root, 'dist')
  const window = new BrowserWindow({
    show: false, opacity: 0, width: 1100, height: 760,
    icon: path.join(assets, 'melodify-icon.ico'), title: 'Melodify taskbar regression',
    webPreferences: {
      preload: path.join(root, 'dist-electron/preload.mjs'), contextIsolation: true, nodeIntegration: false,
    },
  })
  let buttons = [], accepted = false, calls = 0, readyNotifications = 0
  const hookMessage = window.hookWindowMessage.bind(window)
  window.hookWindowMessage = (message, callback) => hookMessage(message, (...args) => {
    readyNotifications++
    callback(...args)
  })
  const setButtons = window.setThumbarButtons.bind(window)
  window.setThumbarButtons = next => {
    assert.ok(readyNotifications > 0, 'must receive TaskbarButtonCreated before any native toolbar call')
    buttons = next
    calls++
    accepted = setButtons(next)
    return accepted
  }
  const previousListeners = new Set(nativeTheme.listeners('updated'))
  const controls = attachTaskbarMediaControls(window, assets)
  controls.update({ hasTrack: true, isPlaying: false, title: 'Pending startup track' })
  assert.equal(calls, 0, 'hidden window must not initialize the native toolbar')
  const listener = nativeTheme.listeners('updated').find(item => !previousListeners.has(item))
  ipcMain.on('media:state', (_event, state) => controls.update(state))
  const evaluate = fn => window.webContents.executeJavaScript(`(${fn.toString()})()`, true)
  // Deliver the actual Windows thumbnail notification to Electron's native
  // callback map. Calling the JS button.click function would miss rejected flags.
  const click = index => run('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', path.join(__dirname, 'taskbar-click.ps1'),
    '-WindowHandle', window.getNativeWindowHandle().readBigUInt64LE().toString(),
    '-AppProcessId', String(process.pid), '-ButtonIndex', String(index),
  ], { windowsHide: true, timeout: 10000 })

  window.showInactive()
  await window.loadFile(path.join(assets, 'index.html'))
  await until(() => evaluate(() => document.querySelector('audio')?.readyState >= 2), 'audio ready')
  await until(() => accepted && buttons[1].tooltip === 'Oynat', 'latest native registration accepted')
  assert.equal(buttons.length, 3)
  assert.ok(buttons.every(button => !button.flags?.includes('disabled')))
  console.log('PASS: Windows accepts the enabled toolbar after renderer playback state arrives')
  console.log('PASS: no native toolbar calls occur before the real TaskbarButtonCreated notification')

  window.minimize()
  await click(1)
  await until(() => evaluate(() => !document.querySelector('audio').paused), 'native play')
  await until(() => accepted && buttons[1].tooltip === 'Duraklat', 'native pause icon')
  await click(1)
  await until(() => evaluate(() => document.querySelector('audio').paused), 'native pause')
  await click(2)
  await until(() => evaluate(() => document.querySelector('.now-playing strong').textContent === 'İkinci Şarkı' && !document.querySelector('audio').paused), 'native next')
  await click(0)
  await until(() => evaluate(() => document.querySelector('.now-playing strong').textContent === 'Birinci Şarkı' && !document.querySelector('audio').paused), 'native previous')
  assert.equal(window.isMinimized(), true)
  console.log('PASS: native Windows play/pause/next/previous notifications control real audio while minimized')

  nativeTheme.themeSource = 'dark'
  await wait(150)
  assert.ok(accepted)
  await click(1)
  await until(() => evaluate(() => document.querySelector('audio').paused), 'native click after theme update')
  console.log('PASS: state and system theme updates preserve native click callbacks')
  window.hide()
  const hiddenCalls = calls
  const previousNotifications = readyNotifications
  controls.update({ hasTrack: true, isPlaying: false, title: 'Birinci Şarkı' })
  assert.equal(calls, hiddenCalls, 'playback updates while hidden must only cache state')
  window.showInactive()
  await until(() => readyNotifications > previousNotifications && accepted, 'taskbar button recreated after hide/show')
  await click(1)
  await until(() => evaluate(() => !document.querySelector('audio').paused), 'native play after taskbar recreation')
  console.log('PASS: hide/show waits for the new native taskbar button and reinstalls working controls')
  window.destroy()
  assert.ok(!nativeTheme.listeners('updated').includes(listener))
  const callsAfterClose = calls
  await wait(300)
  assert.equal(calls, callsAfterClose)
  console.log('PASS: closing removes listeners and registration timers')
  app.exit(0)
}).catch(error => { console.error(error); app.exit(1) })
setTimeout(() => { console.error('Taskbar check timed out'); app.exit(1) }, 40000)
