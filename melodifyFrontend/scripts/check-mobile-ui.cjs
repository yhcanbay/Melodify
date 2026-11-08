const { app, BrowserWindow } = require('electron')
const assert = require('node:assert/strict')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const outputRoot = path.join(projectRoot, 'dist-mobile')
app.setPath('userData', path.join(projectRoot, '.cache', 'mobile-ui-profile'))
app.commandLine.appendSwitch('disable-gpu')

let server
let window
let checks = 0
const consoleErrors = []

async function waitFor(expression) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (await window.webContents.executeJavaScript(expression)) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Mobil ekran beklenen duruma gelmedi: ${expression}`)
}

async function click(selector) {
  await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(selector)}).click()`)
}

async function fill(selector, value) {
  await window.webContents.executeJavaScript(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })) })()`)
}

async function expectHeading(text) {
  await waitFor(`document.querySelector('main h1')?.textContent === ${JSON.stringify(text)}`)
  checks++
}

async function run() {
  assert.ok(fs.existsSync(path.join(outputRoot, 'index.html')), 'Önce build:mobile çalıştırın.')
  server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    const selectedRoot = url.pathname.startsWith('/fixture/') ? path.join(projectRoot, '.cache', 'mobile-ui-fixture') : outputRoot
    const pathname = url.pathname.startsWith('/fixture/') ? url.pathname.slice('/fixture'.length) : url.pathname
    const file = path.resolve(selectedRoot, `.${decodeURIComponent(pathname === '/' ? '/index.html' : pathname)}`)
    if (!file.startsWith(`${selectedRoot}${path.sep}`) || !fs.existsSync(file)) {
      response.writeHead(404).end()
      return
    }
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
    response.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream')
    fs.createReadStream(file).pipe(response)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  window = new BrowserWindow({
    show: false, width: 393, height: 852,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  window.webContents.on('console-message', (_event, level, message) => {
    if (level >= 3 && !message.includes('Electron Security Warning')) consoleErrors.push(message)
  })
  await window.loadURL(`http://127.0.0.1:${server.address().port}`)
  await expectHeading('Kitaplığın')
  await waitFor(`document.querySelector('.mobile-mini-player')?.disabled === true`)
  checks++
  await window.loadURL(`http://127.0.0.1:${server.address().port}/fixture/`)
  await expectHeading('Kitaplığın')
  await waitFor(`document.querySelectorAll('[data-track-id]').length > 0 && document.querySelectorAll('[data-track-id]').length < 30`)
  assert.ok(await window.webContents.executeJavaScript('window.fixture.coverRequests < 30'))
  checks++
  await window.webContents.executeJavaScript(`(() => { const list = document.querySelector('.mobile-library-viewport'); list.scrollTop = list.scrollHeight; list.dispatchEvent(new Event('scroll')) })()`)
  await waitFor(`document.querySelector('[data-track-id="fixture-track-9999"]') !== null && document.querySelectorAll('[data-track-id]').length < 30`)
  checks++
  await window.webContents.executeJavaScript(`document.querySelector('.mobile-library-viewport').dispatchEvent(new KeyboardEvent('keydown', {key:'Home', bubbles:true}))`)
  await waitFor(`document.activeElement?.closest('[data-track-id]')?.dataset.trackId === 'fixture-track-0'`)
  await window.webContents.executeJavaScript(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key:'End', bubbles:true}))`)
  await waitFor(`document.activeElement?.closest('[data-track-id]')?.dataset.trackId === 'fixture-track-9999'`)
  checks++
  await window.webContents.executeJavaScript(`(() => { const input = document.querySelector('#library-query'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Parça 00001'); input.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await waitFor(`document.querySelectorAll('[data-track-id]').length === 1 && document.querySelector('[data-track-id="fixture-track-1"]') !== null`)
  checks++
  await click('[data-track-id] button')
  await waitFor(`document.querySelector('[aria-label="Mini oynatıcıdan duraklat"]') !== null`)
  await click('[aria-label="Mini oynatıcıdan duraklat"]')
  await waitFor(`document.querySelector('[aria-label="Mini oynatıcıdan oynat"]') !== null`)
  checks++
  await click('.mobile-mini-player')
  await expectHeading('Şimdi çalıyor')
  await waitFor(`document.querySelector('[aria-label="Parça konumu"]') !== null && document.documentElement.scrollWidth <= window.innerWidth`)
  checks++
  assert.deepEqual(consoleErrors, [], 'Büyük kitaplık/oynatıcı konsol hatası üretti.')
  checks++
  await click('[aria-label="Geri"]')
  await expectHeading('Kitaplığın')
  await window.webContents.executeJavaScript(`(() => { const input = document.querySelector('#library-query'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Parça 0000'); input.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await waitFor(`document.querySelectorAll('[data-track-id]').length >= 5`)
  await click('[data-track-id] button')
  await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.mobile-tabs button')).find(button => button.textContent === 'Sıra').click()`)
  await expectHeading('Çalma sırası')
  await waitFor(`document.querySelectorAll('[data-queue-index]').length === 10`)
  await click('[data-queue-index="0"] button[aria-label$="aşağı taşı"]')
  await waitFor(`document.querySelector('.mobile-queue-track')?.textContent === 'Parça 00001'`)
  await click('[data-queue-index="1"] button[aria-label$="yukarı taşı"]')
  await waitFor(`document.querySelector('.mobile-queue-track')?.textContent === 'Parça 00000'`)
  checks++
  const dragPoints = await window.webContents.executeJavaScript(`(() => { const handle = document.querySelector('.mobile-drag-handle').getBoundingClientRect(); const target = document.querySelector('[data-queue-index="1"]').getBoundingClientRect(); return { x: Math.round(handle.left + handle.width / 2), y: Math.round(handle.top + handle.height / 2), targetY: Math.round(target.bottom - 8) } })()`)
  window.webContents.debugger.attach('1.3')
  await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', x: dragPoints.x, y: dragPoints.y, button: 'left', buttons: 1, clickCount: 1 })
  await waitFor(`document.querySelector('.mobile-sr-only[role="status"]')?.textContent.includes('hedef sıra')`)
  await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dragPoints.x, y: dragPoints.targetY, buttons: 1 })
  await waitFor(`document.querySelector('.mobile-sr-only[role="status"]')?.textContent.includes('hedef sıra 3')`)
  await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dragPoints.x, y: dragPoints.targetY, button: 'left', buttons: 0, clickCount: 1 })
  window.webContents.debugger.detach()
  await waitFor(`document.querySelector('.mobile-queue-track')?.textContent === 'Parça 00001'`)
  checks++
  await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.mobile-tabs button')).find(button => button.textContent === 'Kitaplık').click()`)
  await expectHeading('Kitaplığın')
  await waitFor(`document.querySelectorAll('.mobile-tabs button').length === 4 && document.querySelector('.mobile-tabs button[aria-current="page"]')?.textContent === 'Kitaplık'`)
  checks++

  const tabs = [
    ['Ara ve indir', 'Ara ve indir'], ['Listeler', 'Listelerin'], ['Sıra', 'Çalma sırası'],
  ]
  for (const [label, heading] of tabs) {
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.mobile-tabs button')).find(button => button.textContent === ${JSON.stringify(label)}).click()`)
    await expectHeading(heading)
  }

  await click('[aria-label="Ayarları aç"]')
  await expectHeading('Ayarlar')
  await window.webContents.executeJavaScript(`(() => {
    const select = document.querySelectorAll('.mobile-settings-card select')[0]
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    setter.call(select, 'light')
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await waitFor(`document.documentElement.dataset.theme === 'light'`)
  checks++
  await click('[aria-label="Geri"]')
  await expectHeading('Çalma sırası')

  window.webContents.reload()
  await expectHeading('Kitaplığın')
  await waitFor(`document.documentElement.dataset.theme === 'light'`)
  checks++
  window.setSize(320, 640)
  await waitFor(`document.documentElement.scrollWidth <= window.innerWidth`)
  checks++
  await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.mobile-tabs button')).find(button => button.textContent === 'Listeler').click()`)
  await expectHeading('Listelerin')
  await click('.mobile-playlist-cards button')
  await expectHeading('Yol müzikleri')
  await click('[aria-label="Ayarları aç"]')
  await expectHeading('Ayarlar')
  await click('[aria-label="Geri"]')
  await expectHeading('Yol müzikleri')
  await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('main button')).find(button => button.textContent === 'Düzenle').click()`)
  await waitFor(`document.querySelector('dialog[open] input') === document.activeElement`)
  await fill('dialog input', 'Gece yolculuğu')
  await fill('dialog textarea', 'Türkçe açıklama')
  await window.webContents.executeJavaScript('window.fixture.failNextPlaylistCommand = true')
  await click('dialog button[type="submit"]')
  await waitFor(`document.querySelector('dialog [role="alert"]')?.textContent.includes('Test kaydetme hatası')`)
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('main h1').textContent`), 'Yol müzikleri')
  checks++
  await click('dialog button[type="submit"]')
  await waitFor(`document.querySelector('dialog[open]') === null`)
  await expectHeading('Gece yolculuğu')
  await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('main button')).find(button => button.textContent === 'Parça ekle').click()`)
  await fill('dialog input', 'Parça 00003')
  await waitFor(`document.querySelectorAll('dialog .mobile-picker-list li').length === 1`)
  await click('dialog .mobile-picker-list button')
  await waitFor(`document.querySelectorAll('[data-queue-index]').length === 4`)
  await click('dialog > button')
  checks++
  await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('main button')).find(button => button.textContent === 'Listeyi sil').click()`)
  await waitFor(`document.querySelector('dialog[open]') !== null`)
  await click('dialog > button:last-child')
  await expectHeading('Gece yolculuğu')
  checks++
  await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('main button')).find(button => button.textContent === 'Listeyi sil').click()`)
  await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('dialog button')).find(button => button.textContent === 'Listeyi silmeyi onayla').click()`)
  await waitFor(`document.querySelector('dialog[open]') === null`)
  await expectHeading('Liste bulunamadı')
  await click('[aria-label="Geri"]')
  await expectHeading('Listelerin')
  await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('main button')).find(button => button.textContent === 'Yeni liste').click()`)
  await fill('dialog input', 'Yeni seçki')
  await click('dialog button[type="submit"]')
  await waitFor(`document.querySelector('dialog[open]') === null && document.querySelector('.mobile-playlist-cards strong')?.textContent === 'Yeni seçki'`)
  checks++
  await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.mobile-tabs button')).find(button => button.textContent === 'Kitaplık').click(); document.documentElement.style.fontSize = '24px'`)
  await waitFor(`document.querySelector('[data-track-id]')?.getBoundingClientRect().height >= 144`)
  await waitFor(`document.documentElement.scrollWidth <= window.innerWidth && document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth`)
  const touchTargets = await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button, input, select')).filter(element => element.getClientRects().length > 0).every(element => element.getBoundingClientRect().height >= 48)`)
  assert.equal(touchTargets, true, 'Büyük yazıda dokunma hedefi 48 px altında.')
  checks++
  await fill('#library-query', 'Parça 00001')
  await waitFor(`document.querySelectorAll('[data-track-id]').length === 1`)
  await click('[data-track-id] button')
  await click('.mobile-mini-player')
  await expectHeading('Şimdi çalıyor')
  await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Parça konumu"]').scrollIntoView({block:'center'})`)
  const beforeSeek = await window.webContents.executeJavaScript('window.fixture.commands.length')
  await fill('[aria-label="Parça konumu"]', '40000')
  assert.equal(await window.webContents.executeJavaScript('window.fixture.commands.length'), beforeSeek, 'Sürükleme sırasında ara sarma komutu gönderildi.')
  await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Parça konumu"]').dispatchEvent(new KeyboardEvent('keyup', {key:'ArrowRight',bubbles:true}))`)
  await waitFor(`window.fixture.commands.at(-1)?.type === 'seek' && window.fixture.commands.at(-1)?.positionMs === 40000`)
  checks++
  await waitFor(`document.documentElement.scrollWidth <= window.innerWidth`)
  checks++
  assert.deepEqual(consoleErrors, [], 'Mobil arayüz konsol hatası üretti.')
  checks++
  console.log(`${checks} mobil arayüz kontrolü geçti: gezinme, geri dönüş, tema kalıcılığı, küçük ekran, konsol.`)
}

app.whenReady().then(run).then(() => {
  window?.destroy()
  server?.close()
  app.exit(0)
}).catch((error) => {
  console.error(error)
  if (window) {
    window.webContents.executeJavaScript(`JSON.stringify({ status: document.querySelector('.mobile-sr-only[role="status"]')?.textContent, rows: Array.from(document.querySelectorAll('[data-queue-index]')).slice(0, 2).map(row => ({ index:row.dataset.queueIndex, rect:row.getBoundingClientRect().toJSON(), handle:row.querySelector('.mobile-drag-handle')?.getBoundingClientRect().toJSON() })) })`).then((diagnostic) => console.error(diagnostic)).finally(() => { window?.destroy(); server?.close(); app.exit(1) })
    return
  }
  window?.destroy()
  server?.close()
  app.exit(1)
})
