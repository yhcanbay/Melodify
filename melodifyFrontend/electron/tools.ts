import { app } from 'electron'
import { constants, existsSync, promises as fs } from 'node:fs'
import path from 'node:path'

function getToolsDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'tools')
    : path.join(app.getAppPath(), 'vendor', 'windows-x64')
}

function getBundledTool(fileName: string) {
  const toolPath = path.join(getToolsDirectory(), fileName)

  if (existsSync(toolPath)) {
    return toolPath
  }

  if (app.isPackaged && process.platform === 'win32') {
    throw new Error(`Uygulama paketi eksik: ${fileName} bulunamadı. Melodify paketini yeniden indirin.`)
  }

  return null
}

let ytDlpPathPromise: Promise<string> | undefined

export function getYtDlpPath(): Promise<string> {
  if (!ytDlpPathPromise) {
    ytDlpPathPromise = prepareYtDlp().catch((error: unknown) => {
      ytDlpPathPromise = undefined
      throw error
    })
  }

  return ytDlpPathPromise
}

async function prepareYtDlp() {
  const bundledPath = getBundledTool('yt-dlp.exe')

  if (!bundledPath) {
    return 'yt-dlp'
  }

  // Keep updates in a writable location, including for installed and portable builds.
  const toolsDirectory = path.join(app.getPath('userData'), 'tools', app.getVersion())
  const toolPath = path.join(toolsDirectory, 'yt-dlp.exe')
  await fs.mkdir(toolsDirectory, { recursive: true })

  try {
    await fs.copyFile(bundledPath, toolPath, constants.COPYFILE_EXCL)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }

  return toolPath
}

export function getNodeRuntimeArg() {
  const bundledNode = getBundledTool('node.exe')
  return bundledNode ? `node:${bundledNode}` : 'node'
}

export function getFfmpegArgs() {
  const bundledFfmpeg = getBundledTool('ffmpeg.exe')

  if (!bundledFfmpeg) {
    return []
  }

  getBundledTool('ffprobe.exe')
  return ['--ffmpeg-location', path.dirname(bundledFfmpeg)]
}
