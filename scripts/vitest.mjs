// Runs Vitest from a working directory whose drive letter is upper case.
// On Windows a shell can start in "c:\…" (VS Code's terminal does); Vitest
// then loads its runner twice — once per drive-letter spelling — and every
// test file fails with "Vitest failed to find the current suite".
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const cwd = process.platform === 'win32' ? process.cwd().replace(/^[a-z]:/, d => d.toUpperCase()) : process.cwd()
const bin = resolve(cwd, 'node_modules/vitest/vitest.mjs')
const { status } = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { cwd, stdio: 'inherit' })
process.exit(status ?? 1)
