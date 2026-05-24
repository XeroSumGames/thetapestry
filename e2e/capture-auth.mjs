// Capture a Playwright storageState for one role by having a HUMAN log in.
// Passwords are never automated. Xero runs this, logs in in the window that
// opens, and the session JSON is saved (auto on reaching /dashboard, or press
// Enter in this terminal to save immediately).
//
//   node e2e/capture-auth.mjs gm       (logs in as Xero  - xerosumgames@gmail.com)
//   node e2e/capture-auth.mjs player   (logs in as MARV  - tony_bushell@hotmail.com)
//
// Output: e2e/.auth/<role>.json  (gitignored - it is live credentials).
// Supabase sessions expire; re-run when the console-sweep reports a /login
// bounce.

import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import readline from 'node:readline'

const role = process.argv[2]
if (role !== 'gm' && role !== 'player') {
  console.error('Usage: node e2e/capture-auth.mjs <gm|player>')
  process.exit(1)
}

const BASE = process.env.E2E_BASE_URL ?? 'https://thetapestry.distemperverse.com'
const outPath = join(process.cwd(), 'e2e', '.auth', `${role}.json`)
const who = role === 'gm' ? 'Xero (xerosumgames@gmail.com)' : 'MARV (tony_bushell@hotmail.com)'

mkdirSync(dirname(outPath), { recursive: true })

const browser = await chromium.launch({ headless: false })
const context = await browser.newContext()
const page = await context.newPage()
await page.goto(`${BASE}/login`)

console.log('\n=============================================================')
console.log(`  Log in as ${who} in the browser window that just opened.`)
console.log('  It saves automatically when you reach the dashboard,')
console.log('  or press ENTER here to save the current session now.')
console.log('=============================================================\n')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const onEnter = new Promise((resolve) => rl.once('line', () => resolve('enter')))
const onDashboard = page.waitForURL('**/dashboard', { timeout: 300_000 }).then(() => 'dashboard').catch(() => 'timeout')

const reason = await Promise.race([onEnter, onDashboard])
rl.close()

if (reason === 'timeout') {
  console.error('\nTimed out after 5 min with no login. Nothing saved.')
  await browser.close()
  process.exit(1)
}

// Settle a beat so any post-redirect cookie writes land before we snapshot.
await page.waitForTimeout(1500)
await context.storageState({ path: outPath })
console.log(`\nSaved ${role} session -> ${outPath}  (trigger: ${reason})`)
await browser.close()
process.exit(0)
