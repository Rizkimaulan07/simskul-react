import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))

const api = spawn(
  process.execPath,
  ['--disable-warning=ExperimentalWarning', '--watch', 'server/index.ts'],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, PORT: process.env.PORT ?? '3001' },
  },
)

const web = spawn(process.execPath, [viteBin], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

const children = [api, web]
let stopping = false

function killTree(child) {
  if (!child.pid || child.killed) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    return
  }
  child.kill('SIGTERM')
}

function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) killTree(child)
  setTimeout(() => process.exit(code), 300).unref()
}

for (const child of children) {
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 0)
  })
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
