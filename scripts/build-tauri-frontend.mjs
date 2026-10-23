import { spawnSync } from 'node:child_process'
import { existsSync, renameSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiDirectory = path.join(projectRoot, 'app', 'api')
const parkedApiDirectory = path.join(projectRoot, '.tauri-api-build-backup')
if (existsSync(parkedApiDirectory)) {
  throw new Error(`وجد مجلد احتياطي سابق لمسار API: ${parkedApiDirectory}. أعده إلى app/api قبل البناء.`)
}

let apiWasParked = false

try {
  if (existsSync(apiDirectory)) {
    renameSync(apiDirectory, parkedApiDirectory)
    apiWasParked = true
  }

    const nextCli = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next')
    const result = spawnSync(process.execPath, [nextCli, 'build'], {
    cwd: projectRoot,
    env: { ...process.env, MOCHA_TAURI_BUILD: '1' },
    stdio: 'inherit',
  })

  if (result.error) throw result.error
  if (result.status !== 0) process.exitCode = result.status ?? 1
} finally {
  if (apiWasParked && existsSync(parkedApiDirectory)) {
    renameSync(parkedApiDirectory, apiDirectory)
  }
}
