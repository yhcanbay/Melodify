import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(readFileSync(path.join(projectRoot, 'android-tools.json'), 'utf8'))
const outputRoot = path.join(projectRoot, '.cache', 'android-tools', 'generated')
const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.platform === 'win32' ? 'C:/Android/sdk' : '')
const ndkRoot = process.env.ANDROID_NDK_HOME || path.join(sdkRoot, 'ndk', manifest.ndk.version)
const hostTag = { win32: 'windows-x86_64', darwin: 'darwin-x86_64', linux: 'linux-x86_64' }[process.platform]
const triples = { 'arm64-v8a': 'aarch64-linux-android', 'armeabi-v7a': 'arm-linux-androideabi', x86_64: 'x86_64-linux-android' }

function sha256(data) { return createHash('sha256').update(data).digest('hex') }

async function prepareArtifact(name, expectedHash) {
  const relativeRoot = `io/github/junkfood02/youtubedl-android/${name}/${manifest.youtubedlAndroid}`
  const repositoryRoot = path.join(projectRoot, '.cache', 'android-tools', 'repository', relativeRoot)
  mkdirSync(repositoryRoot, { recursive: true })
  const artifactName = `${name}-${manifest.youtubedlAndroid}`
  const aarFile = path.join(repositoryRoot, `${artifactName}.aar`)
  if (!existsSync(aarFile) || sha256(readFileSync(aarFile)) !== expectedHash) {
    const auditedCopy = path.join(projectRoot, '.cache', 'android-engine-audit', `${artifactName}.aar`)
    let data = existsSync(auditedCopy) ? readFileSync(auditedCopy) : null
    if (!data || sha256(data) !== expectedHash) {
      const response = await fetch(`https://repo.maven.apache.org/maven2/${relativeRoot}/${artifactName}.aar`, { signal: AbortSignal.timeout(120_000) })
      if (!response.ok) throw new Error(`${artifactName} indirilemedi: HTTP ${response.status}`)
      data = Buffer.from(await response.arrayBuffer())
    }
    if (sha256(data) !== expectedHash) throw new Error(`${artifactName} AAR hash değeri uyuşmuyor.`)
    writeFileSync(aarFile, data)
  }
  for (const extension of ['pom', 'module']) {
    const metadataFile = path.join(repositoryRoot, `${artifactName}.${extension}`)
    if (!existsSync(metadataFile)) {
      const response = await fetch(`https://repo.maven.apache.org/maven2/${relativeRoot}/${artifactName}.${extension}`, { signal: AbortSignal.timeout(30_000) })
      if (!response.ok) throw new Error(`${artifactName} metadata indirilemedi: HTTP ${response.status}`)
      writeFileSync(metadataFile, Buffer.from(await response.arrayBuffer()))
    }
  }
}

function zipEntries(data) {
  let end = data.length - 22
  const lowerBound = Math.max(0, data.length - 65557)
  while (end >= lowerBound && data.readUInt32LE(end) !== 0x06054b50) end--
  if (end < lowerBound) throw new Error('yt-dlp dosyası geçerli bir zipimport paketi değil.')
  const entries = []
  // The official zipimport executable prepends a Python shebang before the ZIP.
  const directorySize = data.readUInt32LE(end + 12)
  let offset = end - directorySize
  const count = data.readUInt16LE(end + 10)
  for (let entry = 0; entry < count; entry++) {
    if (offset + 46 > data.length || data.readUInt32LE(offset) !== 0x02014b50) throw new Error('yt-dlp ZIP dizini geçersiz.')
    const nameLength = data.readUInt16LE(offset + 28)
    entries.push(data.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'))
    offset += 46 + nameLength + data.readUInt16LE(offset + 30) + data.readUInt16LE(offset + 32)
  }
  return entries
}

try {
  for (const [name, expectedHash] of Object.entries(manifest.auditedArtifacts)) await prepareArtifact(name, expectedHash)
  const ndkProperties = readFileSync(path.join(ndkRoot, 'source.properties'), 'utf8')
  if (!ndkProperties.includes(`Pkg.Revision = ${manifest.ndk.version}`)) throw new Error(`Android NDK ${manifest.ndk.version} gerekli.`)
  for (const [abi, triple] of Object.entries(triples)) {
    const runtime = path.join(ndkRoot, 'toolchains', 'llvm', 'prebuilt', hostTag, 'sysroot', 'usr', 'lib', triple, 'libc++_shared.so')
    if (sha256(readFileSync(runtime)) !== manifest.ndk.runtimeSha256[abi]) throw new Error(`NDK C++ çalışma zamanı hash değeri uyuşmuyor: ${abi}`)
    const directory = path.join(outputRoot, 'jniLibs', abi)
    mkdirSync(directory, { recursive: true })
    copyFileSync(runtime, path.join(directory, 'libc++_shared.so'))
  }
  const processSource = path.join(projectRoot, 'android', 'app', 'src', 'main', 'cpp', 'process_supervisor.c')
  const sourceHash = sha256(readFileSync(processSource))
  const buildStamp = path.join(outputRoot, 'native-build.json')
  const previousBuild = existsSync(buildStamp) ? JSON.parse(readFileSync(buildStamp, 'utf8')) : null
  const processLibraries = {}
  for (const [abi, triple] of Object.entries(triples)) {
    const libraryFile = path.join(outputRoot, 'jniLibs', abi, 'libmelodify_process.so')
    const validBuild = previousBuild?.sourceHash === sourceHash && previousBuild?.ndk === manifest.ndk.version && existsSync(libraryFile)
    if (!validBuild) {
      const compiler = path.join(ndkRoot, 'toolchains', 'llvm', 'prebuilt', hostTag, 'bin', process.platform === 'win32' ? 'clang.exe' : 'clang')
      const target = abi === 'armeabi-v7a' ? 'armv7a-linux-androideabi24' : `${triple}24`
      const result = spawnSync(compiler, [
        `--target=${target}`, '-shared', '-fPIC', '-std=c11', '-Wall', '-Wextra', '-Werror',
        '-Wl,-z,max-page-size=16384', '-Wl,-z,common-page-size=16384', '-Wl,-z,relro,-z,now',
        processSource, '-o', libraryFile,
      ], { stdio: 'inherit', shell: false, windowsHide: true })
      if (result.error) throw result.error
      if (result.status !== 0) throw new Error(`Native süreç denetleyicisi derlenemedi: ${abi}`)
    }
    processLibraries[abi] = sha256(readFileSync(libraryFile))
  }
  writeFileSync(buildStamp, `${JSON.stringify({ sourceHash, ndk: manifest.ndk.version }, null, 2)}\n`)
  const resourceRoot = path.join(outputRoot, 'res', 'raw')
  mkdirSync(resourceRoot, { recursive: true })
  const ytDlpFile = path.join(resourceRoot, 'ytdlp')
  let data = existsSync(ytDlpFile) ? readFileSync(ytDlpFile) : null
  if (!data || sha256(data) !== manifest.ytDlp.sha256) {
    const response = await fetch(manifest.ytDlp.url, { signal: AbortSignal.timeout(120_000) })
    if (!response.ok) throw new Error(`yt-dlp paketi indirilemedi: HTTP ${response.status}`)
    data = Buffer.from(await response.arrayBuffer())
    if (sha256(data) !== manifest.ytDlp.sha256) throw new Error('İndirilen yt-dlp paketinin SHA-256 değeri uyuşmuyor.')
    writeFileSync(ytDlpFile, data)
  }
  const entries = zipEntries(data)
  if (!entries.some((entry) => entry.startsWith('yt_dlp_ejs/'))) throw new Error('Resmî yt-dlp paketinde EJS bileşenleri bulunamadı.')
  const assetRoot = path.join(outputRoot, 'assets', 'android-tools')
  mkdirSync(assetRoot, { recursive: true })
  writeFileSync(path.join(assetRoot, 'manifest.json'), `${JSON.stringify({ ...manifest, processSupervisor: { sourceHash, libraries: processLibraries } }, null, 2)}\n`)
  console.log(`Android araç adayı: yt-dlp ${manifest.ytDlp.version}, EJS doğrulandı, NDK ${manifest.ndk.version}, 3 ABI C++ çalışma zamanı.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
