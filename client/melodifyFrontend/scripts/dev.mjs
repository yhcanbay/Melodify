import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'

const rendererPort = 5173
const rendererUrl = `http://localhost:${rendererPort}`
const distElectronMainPath = path.resolve('dist-electron/main.js')
const distElectronPreloadPath = path.resolve('dist-electron/preload.mjs')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const electronCommand = process.platform === 'win32' ? 'electron.cmd' : 'electron'
const buildStartTime = Date.now()

let rendererProcess
let electronProcess

function spawnProcess(command, args, options = {}) {
  return spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  })
}

function waitForHttp(url) {
  return new Promise((resolve) => {
    const tryRequest = () => {
      const request = http.get(url, (response) => {
        response.resume()
        resolve(undefined)
      })

      request.on('error', () => {
        setTimeout(tryRequest, 300)
      })
    }

    tryRequest()
  })
}

async function waitForFreshArtifact(filePath) {
  while (true) {
    try {
      const fileStat = await stat(filePath)

      if (fileStat.mtimeMs >= buildStartTime) {
        return
      }
    } catch {
      // Keep waiting until the fresh artifact is produced.
    }

    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

function cleanup(exitCode = 0) {
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill()
  }

  if (rendererProcess && !rendererProcess.killed) {
    rendererProcess.kill()
  }

  process.exit(exitCode)
}

rendererProcess = spawnProcess(npmCommand, ['run', 'dev:renderer'])

rendererProcess.on('exit', (code) => {
  if (code && code !== 0) {
    cleanup(code)
  }
})

await Promise.all([
  waitForHttp(rendererUrl),
  waitForFreshArtifact(distElectronMainPath),
  waitForFreshArtifact(distElectronPreloadPath),
])

electronProcess = spawnProcess(electronCommand, ['.'], {
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: rendererUrl,
  },
})

electronProcess.on('exit', (code) => {
  cleanup(code ?? 0)
})

process.on('SIGINT', () => cleanup(0))
process.on('SIGTERM', () => cleanup(0))
