import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const outputDirectory = path.join(projectRoot, 'vendor', 'windows-x64')

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('Windows x64 paketi Windows x64 üzerinde hazırlanmalıdır.')
}

function run(executable, args) {
  const result = spawnSync(executable, args, { encoding: 'utf8', windowsHide: true, timeout: 60_000 })
  if (result.error || result.status !== 0) {
    throw new Error(`${executable}: ${result.error?.message ?? result.stderr}`)
  }
  return `${result.stdout}${result.stderr}`.trim()
}

async function findTool(fileName) {
  if (process.env.MELODIFY_TOOLS_DIR) {
    const explicitPath = path.resolve(process.env.MELODIFY_TOOLS_DIR, fileName)
    await readFile(explicitPath)
    return explicitPath
  }

  try {
    return run('where.exe', [fileName]).split(/\r?\n/)[0].trim()
  } catch {
    const cachedPath = path.join(outputDirectory, fileName)
    try {
      await readFile(cachedPath)
      return cachedPath
    } catch {
      throw new Error(`${fileName} bulunamadı. Derleme bilgisayarında PATH'e ekleyin veya MELODIFY_TOOLS_DIR belirtin.`)
    }
  }
}

async function saveLicense(fileName, url) {
  const target = path.join(outputDirectory, 'licenses', fileName)
  try {
    await readFile(target)
    return
  } catch {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) {
      throw new Error(`Lisans indirilemedi: ${url} (${response.status})`)
    }
    await writeFile(target, await response.text())
  }
}

await mkdir(path.join(outputDirectory, 'licenses'), { recursive: true })
const manifest = { platform: 'win32', arch: 'x64', tools: {} }

for (const fileName of ['yt-dlp.exe', 'ffmpeg.exe', 'ffprobe.exe', 'node.exe']) {
  const source = fileName === 'node.exe' ? process.execPath : await findTool(fileName)
  const data = await readFile(source)
  // Reject executables for another architecture before creating a broken package.
  const peOffset = data.readUInt32LE(0x3c)
  if (data.readUInt16LE(peOffset + 4) !== 0x8664) {
    throw new Error(`${fileName} Windows x64 olmalıdır.`)
  }
  const version = run(source, [fileName.startsWith('ff') ? '-version' : '--version']).split(/\r?\n/)[0]
  if (fileName === 'node.exe' && Number(version.replace(/^v/, '').split('.')[0]) < 22) {
    throw new Error('YouTube desteği için derleme bilgisayarında Node.js 22 veya üzeri gereklidir.')
  }
  const target = path.join(outputDirectory, fileName)
  if (path.resolve(source).toLowerCase() !== target.toLowerCase()) {
    await copyFile(source, target)
  }
  manifest.tools[fileName] = { version, sha256: createHash('sha256').update(data).digest('hex') }
  console.log(`${fileName}: ${version}`)
}

const ytDlpVersion = manifest.tools['yt-dlp.exe'].version
const nodeVersion = manifest.tools['node.exe'].version
await saveLicense(`node-${nodeVersion}.txt`, `https://raw.githubusercontent.com/nodejs/node/${nodeVersion}/LICENSE`)
await saveLicense(`yt-dlp-${ytDlpVersion}.txt`, `https://raw.githubusercontent.com/yt-dlp/yt-dlp/${ytDlpVersion}/LICENSE`)
await saveLicense(`yt-dlp-third-party-${ytDlpVersion}.txt`, `https://raw.githubusercontent.com/yt-dlp/yt-dlp/${ytDlpVersion}/THIRD_PARTY_LICENSES.txt`)
await writeFile(path.join(outputDirectory, 'licenses', 'ffmpeg.txt'), run(path.join(outputDirectory, 'ffmpeg.exe'), ['-L']))
await saveLicense('GPL-3.0.txt', 'https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/COPYING.GPLv3')
await writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
await writeFile(path.join(outputDirectory, 'licenses', 'SOURCES.txt'), [
  'yt-dlp: https://github.com/yt-dlp/yt-dlp',
  `yt-dlp source: https://github.com/yt-dlp/yt-dlp/archive/refs/tags/${ytDlpVersion}.zip`,
  'FFmpeg: https://ffmpeg.org/ ; Windows build and corresponding source: https://www.gyan.dev/ffmpeg/builds/',
  'FFmpeg version and build configuration: see ffmpeg.txt and ../manifest.json.',
  `Node.js source: https://nodejs.org/dist/${nodeVersion}/node-${nodeVersion}.tar.xz`,
  'Electron and Chromium notices are included in the application directory.',
  '',
].join('\n'))
console.log('Windows araçları paketlemeye hazır: vendor/windows-x64')
