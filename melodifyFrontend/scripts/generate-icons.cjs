// Regenerate Windows assets from the repo-native Melodify mark and media glyphs.
const path = require('node:path')
const fs = require('node:fs/promises')
const { spawnSync } = require('node:child_process')
const electron = require('electron')

if (typeof electron === 'string') {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const result = spawnSync(electron, [__filename], { env, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} else {
  const { app, BrowserWindow } = electron
  const root = path.resolve(__dirname, '..')
  app.setPath('userData', path.join(root, 'node_modules', '.cache', 'melodify-icon-generator'))
  app.disableHardwareAcceleration()

  app.whenReady().then(async () => {
    const window = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } })
    await window.loadURL('data:text/html,<html><body></body></html>')
    const iconSvg = await fs.readFile(path.join(root, 'public', 'melodify-icon.svg'), 'utf8')
    const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256]
    const mediaPaths = {
      previous: '<path d="M6 5v14M18 5 8 12l10 7V5Z"/>',
      play: '<path d="m8 5 11 7-11 7V5Z"/>',
      pause: '<path d="M8 5v14M16 5v14"/>',
      next: '<path d="M18 5v14M6 5l10 7-10 7V5Z"/>',
    }
    const renderSvg = async (svg, size) => {
      const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
      const dataUrl = await window.webContents.executeJavaScript(`(async (source, size) => {
        const image = new Image()
        image.src = source
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = size
        canvas.getContext('2d').drawImage(image, 0, 0, size, size)
        return canvas.toDataURL('image/png')
      })(${JSON.stringify(source)}, ${size})`)
      return Buffer.from(dataUrl.split(',')[1], 'base64')
    }
    const images = []
    for (const size of sizes) images.push(await renderSvg(iconSvg, size))
    const header = Buffer.alloc(6 + sizes.length * 16)
    header.writeUInt16LE(1, 2)
    header.writeUInt16LE(sizes.length, 4)
    let offset = header.length
    sizes.forEach((size, index) => {
      const entry = 6 + index * 16
      header[entry] = header[entry + 1] = size === 256 ? 0 : size
      header.writeUInt16LE(1, entry + 4)
      header.writeUInt16LE(32, entry + 6)
      header.writeUInt32LE(images[index].length, entry + 8)
      header.writeUInt32LE(offset, entry + 12)
      offset += images[index].length
    })
    const ico = Buffer.concat([header, ...images])
    const png = await renderSvg(iconSvg, 512)
    await fs.mkdir(path.join(root, 'build'), { recursive: true })
    for (const [directory, name] of [['public', 'melodify-icon'], ['build', 'icon']]) {
      await fs.writeFile(path.join(root, directory, `${name}.ico`), ico)
      await fs.writeFile(path.join(root, directory, `${name}.png`), png)
    }
    for (const [name, glyph] of Object.entries(mediaPaths)) {
      for (const [suffix, color] of [['', '#33303b'], ['-light', '#fff8ef']]) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>`
        await fs.writeFile(path.join(root, 'public', `thumbar-${name}${suffix}.png`), await renderSvg(svg, 32))
      }
    }
    console.log('Melodify simgeleri üretildi: PNG, 9 boyutlu ICO ve açık/koyu Windows temaları için 8 medya simgesi.')
    app.exit(0)
  }).catch(error => { console.error(error); app.exit(1) })
}
