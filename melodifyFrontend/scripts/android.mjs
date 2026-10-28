import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const androidRoot = path.join(projectRoot, 'android')
const cacheRoot = path.join(projectRoot, '.cache')
const command = process.argv[2] ?? 'doctor'
const executableSuffix = process.platform === 'win32' ? '.exe' : ''

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
    ...options,
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function javaVersion(javaHome) {
  const executable = javaHome ? path.join(javaHome, 'bin', `java${executableSuffix}`) : 'java'
  const result = spawnSync(executable, ['-XshowSettings:properties', '-version'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 10_000,
  })
  if (result.error || result.status !== 0) return null
  const output = `${result.stdout}${result.stderr}`
  return {
    major: Number(output.match(/java\.specification\.version\s*=\s*(\d+)/)?.[1]),
    home: output.match(/java\.home\s*=\s*(.+)/)?.[1].trim(),
  }
}

function findJavaHome() {
  if (process.env.JAVA_HOME) {
    const selected = javaVersion(process.env.JAVA_HOME)
    if (selected?.major !== 21 || !selected.home) {
      throw new Error('Bu Android projesi için JAVA_HOME bir JDK 21 klasörünü göstermeli.')
    }
    return selected.home
  }

  const candidates = []
  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
    for (const vendor of ['Java', 'Eclipse Adoptium', 'Microsoft']) {
      const vendorRoot = path.join(programFiles, vendor)
      if (!existsSync(vendorRoot)) continue
      for (const entry of readdirSync(vendorRoot, { withFileTypes: true })) {
        if (entry.isDirectory() && /^(jdk-?21|microsoft-jdk-21)/i.test(entry.name)) {
          candidates.push(path.join(vendorRoot, entry.name))
        }
      }
    }
    candidates.push(path.join(programFiles, 'Android', 'Android Studio', 'jbr'))
  }
  candidates.push(undefined)

  for (const candidate of candidates) {
    const detected = javaVersion(candidate)
    if (detected?.major === 21 && detected.home) return detected.home
  }
  throw new Error('JDK 21 bulunamadı. JDK 21 kurup JAVA_HOME ile konumunu belirtin.')
}

function findSdkRoot() {
  const localProperties = path.join(androidRoot, 'local.properties')
  const localSdk = existsSync(localProperties)
    ? readFileSync(localProperties, 'utf8').match(/^sdk\.dir=(.+)$/m)?.[1].trim().replace(/\\([\\: ])/g, '$1')
    : undefined
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    localSdk,
    process.platform === 'win32' && path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk'),
    process.platform === 'win32' && 'C:\\Android\\sdk',
    process.platform === 'darwin' && path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    process.platform === 'linux' && path.join(os.homedir(), 'Android', 'Sdk'),
  ]
  const sdkRoot = candidates.find((candidate) => candidate && existsSync(path.join(candidate, 'platform-tools')))
  if (!sdkRoot) throw new Error('Android SDK bulunamadı. ANDROID_HOME ile SDK klasörünü belirtin.')
  return path.resolve(sdkRoot)
}

try {
  if (!['doctor', 'sync', 'open', 'build', 'run'].includes(command)) {
    throw new Error('Kullanım: node scripts/android.mjs doctor|sync|open|build|run')
  }

  const javaHome = findJavaHome()
  const sdkRoot = findSdkRoot()
  const compileSdk = readFileSync(path.join(androidRoot, 'variables.gradle'), 'utf8')
    .match(/compileSdkVersion\s*=\s*(\d+)/)?.[1]
  const platformJar = path.join(sdkRoot, 'platforms', `android-${compileSdk}`, 'android.jar')
  if (!existsSync(platformJar)) {
    throw new Error(`Android SDK Platform ${compileSdk} eksik. Android Studio SDK Manager ile kurun.`)
  }
  const env = {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: sdkRoot,
    ANDROID_SDK_ROOT: sdkRoot,
    GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || path.join(cacheRoot, 'gradle'),
    ANDROID_USER_HOME: process.env.ANDROID_USER_HOME || path.join(cacheRoot, 'android'),
    PATH: [path.join(javaHome, 'bin'), path.join(sdkRoot, 'platform-tools'), process.env.PATH]
      .filter(Boolean).join(path.delimiter),
  }

  console.log(`JDK 21: ${javaHome}`)
  console.log(`Android SDK: ${sdkRoot}`)
  console.log(`Android platform: API ${compileSdk}`)
  console.log(`Gradle cache: ${env.GRADLE_USER_HOME}`)

  for (const directory of [env.GRADLE_USER_HOME, env.ANDROID_USER_HOME]) {
    mkdirSync(directory, { recursive: true })
  }

  if (command === 'doctor') {
    run(path.join(javaHome, 'bin', `java${executableSuffix}`), ['-version'], { env })
    run(path.join(sdkRoot, 'platform-tools', `adb${executableSuffix}`), ['version'], { env })
    const buildTools = path.join(sdkRoot, 'build-tools')
    if (!existsSync(path.join(buildTools, '35.0.0', `aapt2${executableSuffix}`))) {
      throw new Error('Android SDK Build-Tools 35.0.0 eksik. SDK Manager ile kurun.')
    }
    console.log(`Android Build-Tools: ${readdirSync(buildTools).join(', ')}`)
    console.log('Android geliştirme araçları hazır.')
    process.exit(0)
  }

  const localProperties = path.join(androidRoot, 'local.properties')
  if (!existsSync(localProperties)) {
    writeFileSync(localProperties, `sdk.dir=${sdkRoot.replace(/\\/g, '/')}\n`)
  }

  if (command === 'build') {
    run(path.join(javaHome, 'bin', `java${executableSuffix}`), [
      '-classpath', path.join(androidRoot, 'gradle', 'wrapper', 'gradle-wrapper.jar'),
      'org.gradle.wrapper.GradleWrapperMain',
      '--no-daemon', '--console=plain', 'assembleDebug',
    ], { cwd: androidRoot, env })
  } else {
    const args = command === 'run' ? ['run', 'android', '--no-sync'] : [command, 'android']
    run(process.execPath, [path.join(projectRoot, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), ...args], { env })
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
