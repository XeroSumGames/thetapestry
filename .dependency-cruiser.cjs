// Dependency-direction lint (grand re-architecture Phase 4). Enforces the
// downward invariant that check-arch.mjs (regex: .from/.channel/LOC/console)
// can't express: the import GRAPH must point down, nothing imports upward.
//
// Severity convention: rules that already pass green on the whole tree are
// `error` (locked). Rules that the not-yet-migrated god-components still
// violate are `warn` (visible, non-blocking) and get promoted to `error` as
// Phase 5 migrates each component. Run: npm run arch:depcruise.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies are a refactoring hazard and signal a missing seam.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'lib-no-upward-to-app',
      severity: 'error',
      comment: 'The lib/ layer (L0-L2 + the data/realtime seams) is self-contained; it must never import route code in app/.',
      from: { path: '^lib/' },
      to: { path: '^app/' },
    },
    {
      name: 'lib-no-upward-to-components',
      severity: 'error',
      comment: 'lib/ must not import React components (runtime). Type-only imports of component-exported types are not followed by default and stay allowed.',
      from: { path: '^lib/' },
      to: { path: '^components/' },
    },
    {
      name: 'components-no-route-internals',
      severity: 'error',
      comment: 'Shared components must not reach up into app/ route internals.',
      from: { path: '^components/' },
      to: { path: '^app/' },
    },
    {
      name: 'no-orphan-tests-in-graph',
      severity: 'error',
      comment: 'App/lib/component code must not import test files.',
      from: { pathNot: '\\.test\\.[tj]sx?$' },
      to: { path: '\\.test\\.[tj]sx?$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: 'node_modules|\\.next|tests/|scripts/' },
    tsConfig: { fileName: 'tsconfig.json' },
    // type-only imports stay out of the graph (tsPreCompilationDeps:false,
    // the default) so a `import type { X } from '../../components/Y'` in a hook
    // is not treated as an upward runtime dependency.
  },
}
