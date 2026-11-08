import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

await build({
  configFile: false,
  base: '/fixture/',
  root: fileURLToPath(new URL('./fixtures/mobile-ui/', import.meta.url)),
  plugins: [react()],
  build: { outDir: fileURLToPath(new URL('../.cache/mobile-ui-fixture/', import.meta.url)), emptyOutDir: true },
})

const require = createRequire(import.meta.url)
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(require('electron'), [fileURLToPath(new URL('./check-mobile-ui.cjs', import.meta.url))], {
  env, shell: false, windowsHide: true, stdio: 'inherit',
})
child.on('error', (error) => { console.error(error.message); process.exitCode = 1 })
child.on('exit', (code) => { process.exitCode = code ?? 1 })
