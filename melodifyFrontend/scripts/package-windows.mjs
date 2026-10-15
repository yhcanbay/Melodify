import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const cacheRoot = process.env.ELECTRON_BUILDER_CACHE || path.join(projectRoot, 'node_modules', '.cache', 'electron-builder')
const signingTools = path.join(cacheRoot, 'winCodeSign', 'winCodeSign-2.6.0')

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('Windows x64 paketi Windows x64 üzerinde hazırlanmalıdır.')
}

// electron-builder 24's archive also contains macOS symlinks. Extract only the
// Windows-compatible files so building does not require administrator rights.
try {
  await access(path.join(signingTools, 'rcedit-x64.exe'))
} catch {
  const url = 'https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z'
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`Windows paketleme aracı indirilemedi: ${response.status}`)
  const archive = Buffer.from(await response.arrayBuffer())
  const checksum = createHash('sha256').update(archive).digest('hex')
  if (checksum !== 'cdaec7154dda7cc31f88d886e2489379a0625a737d610b5ae7f62a12f16743a4') {
    throw new Error('Windows paketleme aracının SHA-256 doğrulaması başarısız.')
  }
  await mkdir(signingTools, { recursive: true })
  const archivePath = path.join(cacheRoot, 'winCodeSign', 'winCodeSign-2.6.0.7z')
  await writeFile(archivePath, archive)
  const extraction = spawnSync(path.join(projectRoot, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe'), [
    'x', archivePath, `-o${signingTools}`, '-xr!darwin', '-y', '-bso0', '-bsp0',
  ], { stdio: 'inherit', windowsHide: true })
  if (extraction.error || extraction.status !== 0) {
    throw extraction.error ?? new Error('Windows paketleme aracı açılamadı.')
  }
}

const builder = spawnSync(process.execPath, [
  path.join(projectRoot, 'node_modules', 'electron-builder', 'cli.js'),
  '--win', ...process.argv.slice(2), '--x64', '--publish', 'never',
  '--config.electronDist=node_modules/electron/dist',
], {
  cwd: projectRoot,
  env: {
    ...process.env,
    ELECTRON_BUILDER_CACHE: cacheRoot,
    ELECTRON_BUILDER_COMPRESSION_LEVEL: process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL || '5',
  },
  stdio: 'inherit',
  windowsHide: true,
})
if (builder.error) throw builder.error
process.exitCode = builder.status ?? 1
