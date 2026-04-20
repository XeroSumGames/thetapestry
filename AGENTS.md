<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## UI conventions

- **Minimum inline fontSize is 12px.** Never write `fontSize: '9px'`, `'10px'`, or `'11px'` in `style={{ ... }}` props — even for badges, chips, or micro-labels. If something looks too big at 12, use color/weight/layout instead. Guardrail: `node scripts/check-font-sizes.mjs` reports offenders; `--fix` rewrites them to 12.
- **Popout routes never show the global sidebar.** `LayoutShell.tsx`'s `FULL_WIDTH_PATTERN` auto-hides the sidebar for any pathname ending in `-sheet` or `-popout`, or under `/popout/...`. Name new popout routes accordingly (e.g. `/foo-sheet`, `/foo-popout`) and they'll be sidebar-free with no further edits.
