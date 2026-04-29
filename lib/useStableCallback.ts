'use client'
import { useCallback, useRef } from 'react'

// Stable-identity callback that ALWAYS invokes the latest closure.
//
// Solves the React perf-vs-correctness tension: pure useCallback with
// proper deps re-creates the callback whenever any read state changes,
// defeating React.memo on the child. Pure useCallback with empty deps
// gives stable identity but captures stale state.
//
// useStableCallback returns a function whose identity is permanent for
// the lifetime of the component (so memo'd children skip re-renders
// when only this prop "changes"), but every invocation reads the
// LATEST version of the wrapped function via a ref. Stale-closure
// bugs are eliminated structurally — the wrapped function always
// has fresh closure state.
//
// Mirrors the proposed `useEvent` / `useEffectEvent` pattern from the
// React RFC, implemented with the stable hooks already in React 18.
//
// Usage:
//   const onClick = useStableCallback((id: string) => {
//     // reads the latest `someState` even though identity never changes
//     someStateSetter(someState + id)
//   })
//   return <Heavy onClick={onClick} />   // <Heavy> is React.memo'd; this prop is stable forever
//
// Caveats:
//   - DON'T use during render (no `useStableCallback(() => something)()` in render).
//   - DON'T pass to useEffect's deps array as if it were a "real" dep —
//     it'll never change, so the effect won't re-run. Effects that
//     genuinely need to re-run on the wrapped fn's logic should use
//     real useCallback or an explicit dep.
//   - Same arity / signature semantics as the wrapped function.

export function useStableCallback<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => TReturn,
): (...args: TArgs) => TReturn {
  const ref = useRef(fn)
  // Update on every render so the next invocation reads the latest fn.
  // Assignment in render body is fine — refs don't trigger re-renders.
  ref.current = fn
  // Stable wrapper, never re-created. Calls ref.current at call-time
  // so the latest fn (with current closure state) is what runs.
  return useCallback((...args: TArgs): TReturn => ref.current(...args), [])
}
