// Build a /login URL that preserves the user's current path so they
// land back where they were trying to go after authenticating.
//
// Usage from a client component bouncing an anon user:
//   import { loginPathForCurrent } from '@/lib/login-redirect'
//   if (!user) { router.push(loginPathForCurrent()); return }
//
// The receiving side at app/login/page.tsx already accepts a `?redirect=`
// query param and honors it after sign-in (with a safe-redirect guard
// that rejects open-redirect vectors like `//example.com` or `http://...`).
// This module is purely the sending side - encode-and-attach.
//
// Sign-out bounces deliberately skip this helper and go straight to
// '/login' - the user just logged out, they don't want to be sent back
// to the page they signed out from.

/**
 * Build the login URL for a given current pathname. If the pathname is
 * absent, the user is already at /login or /signup, or they're on the
 * dashboard ghost-map (which is also the post-login default), return
 * the bare '/login' - no point in a redirect=/ loop.
 */
export function loginPathFor(currentPathname: string | null | undefined): string {
  if (!currentPathname) return '/login'
  if (currentPathname === '/login') return '/login'
  if (currentPathname === '/signup') return '/login'
  if (currentPathname === '/') return '/login'
  return `/login?redirect=${encodeURIComponent(currentPathname)}`
}

/**
 * Read the current pathname from window.location and build the login
 * URL. Safe to call during SSR - returns the bare '/login' when
 * window is undefined. Use this from client components that don't
 * already have a usePathname() reference.
 */
export function loginPathForCurrent(): string {
  if (typeof window === 'undefined') return '/login'
  return loginPathFor(window.location.pathname)
}
