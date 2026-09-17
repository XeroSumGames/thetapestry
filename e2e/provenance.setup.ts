import { test as setup } from '@playwright/test'
import { execFileSync } from 'node:child_process'

/**
 * WHICH BUILD DID WE JUST MEASURE?
 *
 * This lane reads app code from ITS OWN worktree and measures a server built
 * from a DIFFERENT one - the dev server on :3000 runs out of the main checkout,
 * which another lane commits to while a run is in flight. So a grep of this
 * tree answers a question about a different program, confidently and silently.
 *
 * That is not hypothetical (2026-09-16): a true report about the PINS rail was
 * RETRACTED because a re-measurement of the FIXED build was read as evidence
 * the defect never existed, while the local grep still showed the old markup.
 * Both observations were accurate; they were of different builds. The cost was
 * nearly a good commit reverted.
 *
 * So every run states, in its own output, exactly what it pointed at. It
 * asserts nothing and can never fail a suite - it exists so that any result can
 * be attributed to a commit after the fact, and so a target that moves mid-run
 * announces itself instead of being mistaken for a flaky test.
 */

const sh = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/** Resolve the directory a localhost dev server is actually running out of, via
 *  the listening PID's command line. Next runs from <root>/node_modules/next/...
 *  The command line holds TWO absolute paths - the node binary and the app - so
 *  this takes the LAST drive-rooted path preceding node_modules, not the first.
 *  Failures are REPORTED, never swallowed: a guard that quietly degrades to
 *  "unknown" is how the mis-attribution this file exists to prevent happens. */
function servedRoot(port: string): { root: string } | { error: string } {
  try {
    const pid = sh('powershell', ['-NoProfile', '-Command',
      `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess`])
    if (!pid) return { error: `nothing is listening on port ${port}` }

    const cmd = sh('powershell', ['-NoProfile', '-Command',
      `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`])
    if (!cmd) return { error: `PID ${pid} gave no command line` }

    // Deliberately NO regex. Windows paths are all separators, and every layer
    // between here and the file (tool call, shell, heredoc) eats backslashes at
    // a different rate - a character class that LOOKS like it holds one is the
    // exact bug this function already shipped once. Index arithmetic cannot be
    // silently de-escaped.
    const marker = cmd.toLowerCase().lastIndexOf('node_modules')
    if (marker <= 0) return { error: `PID ${pid} command line has no node_modules: ${cmd.slice(0, 120)}` }

    // Everything before node_modules still holds TWO absolute paths - the node
    // binary and the app. Keep the LAST one: walk back from its drive colon to
    // the space that starts it, so roots containing spaces survive intact.
    let root = cmd.slice(0, marker - 1)
    const colon = root.lastIndexOf(':')
    if (colon > 0) root = root.slice(root.lastIndexOf(' ', colon) + 1)
    return root ? { root } : { error: `could not isolate an app root from: ${cmd.slice(0, 120)}` }
  } catch (e) {
    return { error: (e as Error).message.split(/\r?\n/)[0] }
  }
}

const head = (dir: string) => {
  try { return sh('git', ['-C', dir, 'log', '--oneline', '-1']) } catch { return 'not a git tree' }
}

setup('record what this run measured', async () => {
  const base = process.env.E2E_BASE_URL ?? 'https://thetapestry.distemperverse.com'
  const lines = [`[provenance] target      ${base}`,
                 `[provenance] spec tree   ${process.cwd()} @ ${head(process.cwd())}`]

  let url: URL | null = null
  try { url = new URL(base) } catch { /* malformed - reported verbatim above */ }

  if (url && /^(localhost|127\.0\.0\.1)$/.test(url.hostname)) {
    const served = servedRoot(url.port || '80')
    if ('error' in served) {
      lines.push(`[provenance] SERVED TREE UNRESOLVED - ${served.error}`,
                 '[provenance]       Markup claims from this run are UNATTRIBUTED. Say so when reporting them.')
    } else {
      lines.push(`[provenance] SERVED TREE ${served.root} @ ${head(served.root)}`)
      if (served.root.toLowerCase() !== process.cwd().toLowerCase()) {
        lines.push('[provenance] NOTE: the server is NOT built from this worktree.',
                   '[provenance]       Anything asserted about rendered markup describes the tree above,',
                   '[provenance]       not the files in this checkout. Do not grep here to explain a result.')
      }
    }
  } else {
    lines.push('[provenance] SERVED TREE n/a - remote target, no local tree to attribute')
  }
  console.log('\n' + lines.join('\n') + '\n')
})

/**
 * ORIGIN-MISMATCH GUARD.
 *
 * Storage-state paths are keyed by target origin (e2e/_fixtures.ts), which makes
 * a prod/localhost collision structurally impossible rather than merely
 * unlikely. This asserts the property anyway, because the failure it prevents is
 * SILENT: a state file whose cookies belong to another origin does not error, it
 * just runs the whole suite logged out, and every assertion then "passes" by
 * measuring a guest. A wrong session must be a hard, early, loud failure - never
 * a pile of confusing reds three specs later, and never a green.
 *
 * Runs after the auth setup that mints the files, and only inspects cookie
 * DOMAINS - never names, values or tokens.
 */
setup('the captured sessions belong to the target origin', async () => {
  const base = process.env.E2E_BASE_URL ?? 'https://thetapestry.distemperverse.com'
  let host: string
  try { host = new URL(base).hostname } catch { setup.skip(true, `unparseable E2E_BASE_URL: ${base}`); return }

  const { readFileSync, existsSync } = await import('node:fs')
  const { AUTH } = await import('./_fixtures')

  const bad: string[] = []
  const checked: string[] = []

  for (const [key, file] of Object.entries(AUTH)) {
    if (!existsSync(file)) continue
    let domains: string[] = []
    try {
      const state = JSON.parse(readFileSync(file, 'utf8'))
      domains = [...new Set((state.cookies ?? []).map((c: { domain: string }) => c.domain.replace(/^\./, '')))] as string[]
    } catch (e) {
      bad.push(`${key}: unreadable state file (${(e as Error).message.split(/\r?\n/)[0]})`)
      continue
    }
    if (!domains.length) continue // no cookies captured - auth.setup's own problem, not an origin mismatch
    // A session is for this origin if ANY cookie is scoped to the host or a parent of it.
    const owns = domains.some(d => d === host || host.endsWith('.' + d))
    checked.push(`${key}=[${domains.join(', ')}]`)
    if (!owns) bad.push(`${key}: cookies are for [${domains.join(', ')}] but this run targets ${host} - file ${file}`)
  }

  if (bad.length) {
    throw new Error(
      'STORAGE STATE DOES NOT BELONG TO THE TARGET ORIGIN. The run would have executed LOGGED OUT ' +
      'and reported guest behaviour as passing tests.\n  ' + bad.join('\n  ') +
      '\nDelete e2e/.auth/<host>/ for this origin and let the setup project mint a fresh session.')
  }
  console.log(`[provenance] sessions    ${checked.length ? checked.join('  ') : 'none captured yet'} -> all scoped to ${host}`)
})
