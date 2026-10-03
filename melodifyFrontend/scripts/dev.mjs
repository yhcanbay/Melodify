import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const viteCliPath = path.resolve(projectRoot, 'node_modules/vite/bin/vite.js')
const childEnv = { ...process.env }

delete childEnv.ELECTRON_RUN_AS_NODE

let devProcess

function spawnProcess(command, args, { env, ...options } = {}) {
  return spawn(command, args, {
    cwd: projectRoot,
    env: {
      ...childEnv,
      ...env,
    },
    stdio: 'inherit',
    shell: false,
    ...options,
  })
}

function cleanup(exitCode = 0) {
  if (devProcess && !devProcess.killed) {
    devProcess.kill()
  }

  process.exit(exitCode)
}

devProcess = spawnProcess(process.execPath, [viteCliPath])

devProcess.on('exit', (code) => {
  cleanup(code ?? 0)
})

process.on('SIGINT', () => cleanup(0))
process.on('SIGTERM', () => cleanup(0))
