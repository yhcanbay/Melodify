import { nativeImage, nativeTheme, type BrowserWindow, type ThumbarButton } from 'electron'
import { load } from 'koffi'
import path from 'node:path'
import type { MediaCommand, MediaControlState } from '../src/shared/melodify'

export function attachTaskbarMediaControls(window: BrowserWindow, publicDirectory: string): { update(state: MediaControlState): void } {
  let state: MediaControlState = { hasTrack: false, isPlaying: false }
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let retries = 0
  let disposed = false
  let taskbarReady = false

  if (process.platform !== 'win32') return { update: () => {} }

  // ITaskbarList3 must not be used until Explorer creates THIS window's
  // taskbar button. Electron 30 marks a failed early ThumbBarAddButtons call
  // as initialized, so later successful updates can still leave no toolbar.
  const user32 = load('user32.dll')
  const registerMessage = user32.func('uint32_t __stdcall RegisterWindowMessageW(str16 name)')
  const taskbarButtonCreated = Number(registerMessage('TaskbarButtonCreated'))
  if (!taskbarButtonCreated) throw new Error('Windows görev çubuğu bildirimi kaydedilemedi.')
  // Explorer may run at a lower integrity level than an elevated app.
  const allowMessage = user32.func('bool __stdcall ChangeWindowMessageFilterEx(uintptr_t window, uint32_t message, uint32_t action, void *changeInfo)')
  const handle = window.getNativeWindowHandle()
  const nativeHandle = handle.length === 8 ? handle.readBigUInt64LE() : BigInt(handle.readUInt32LE())
  if (!allowMessage(nativeHandle, taskbarButtonCreated, 1, null)) {
    console.warn('Windows görev çubuğu hazır bildirimi için ileti filtresi açılamadı.')
  }

  const contents = window.webContents
  const loadIcons = (suffix: string) => ({
    previous: nativeImage.createFromPath(path.join(publicDirectory, `thumbar-previous${suffix}.png`)),
    play: nativeImage.createFromPath(path.join(publicDirectory, `thumbar-play${suffix}.png`)),
    pause: nativeImage.createFromPath(path.join(publicDirectory, `thumbar-pause${suffix}.png`)),
    next: nativeImage.createFromPath(path.join(publicDirectory, `thumbar-next${suffix}.png`)),
  })
  const iconThemes = { light: loadIcons(''), dark: loadIcons('-light') }
  const clearRetry = () => {
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = undefined
  }
  const send = (command: MediaCommand) => {
    if (disposed || !state.hasTrack || window.isDestroyed() || contents.isDestroyed()) return
    contents.send('media:command', command)
  }
  const render = () => {
    clearRetry()
    if (disposed || !taskbarReady || window.isDestroyed()) return

    const icons = nativeTheme.shouldUseDarkColors ? iconThemes.dark : iconThemes.light
    // Electron 30 rejects the literal 'enabled' flag and clears native click
    // callbacks. An empty flags array enables the buttons on Windows.
    const flags: ThumbarButton['flags'] = state.hasTrack ? [] : ['disabled']
    const added = window.setThumbarButtons([
      { tooltip: 'Önceki parça', icon: icons.previous, click: () => send('previous'), flags },
      { tooltip: state.isPlaying ? 'Duraklat' : 'Oynat', icon: state.isPlaying ? icons.pause : icons.play, click: () => send('play-pause'), flags },
      { tooltip: 'Sonraki parça', icon: icons.next, click: () => send('next'), flags },
    ])
    window.setThumbnailToolTip(state.hasTrack && state.title ? `${state.title} — Melodify` : 'Melodify')

    // Retry transient shell failures only after native taskbar readiness,
    // retaining the latest playback state without blocking the UI thread.
    if (!added && retries < 20) {
      retries += 1
      retryTimer = setTimeout(render, 250)
    }
  }
  const refresh = () => {
    clearRetry()
    retries = 0
    render()
  }
  const onTaskbarButtonCreated = () => {
    taskbarReady = true
    refresh()
  }
  const onHide = () => {
    taskbarReady = false
    clearRetry()
  }
  const dispose = () => {
    disposed = true
    clearRetry()
    window.removeListener('ready-to-show', refresh)
    window.removeListener('show', refresh)
    window.removeListener('restore', refresh)
    window.removeListener('hide', onHide)
    contents.removeListener('did-finish-load', refresh)
    nativeTheme.removeListener('updated', refresh)
  }

  window.hookWindowMessage(taskbarButtonCreated, onTaskbarButtonCreated)
  window.on('ready-to-show', refresh)
  window.on('show', refresh)
  window.on('restore', refresh)
  window.on('hide', onHide)
  contents.on('did-finish-load', refresh)
  nativeTheme.on('updated', refresh)
  window.once('closed', dispose)
  refresh()

  return {
    update(nextState: MediaControlState) {
      state = nextState
      refresh()
    },
  }
}
