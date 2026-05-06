'use client'
// /account — player account management. Distinct from character
// management (which lives at /characters): this is the human behind
// the screen, not the character they're playing.
//
// Sections:
//   • Avatar — account-level icon, used in sidebar / Campfire / any
//     multi-user surface. Stored in the account-avatars storage
//     bucket; URL persisted to profiles.avatar_url.
//   • Identity — username (display), email (auth-managed), role
//     (read-only — set by Thriver moderation).
//   • Password — supabase auth.updateUser({ password }).
//   • Subscriptions — placeholder block; populated when Phase 5D
//     module monetization lands.
//
// Account avatars are PUBLIC (same as character portraits) — they
// show up next to usernames in chat, forums, war stories, LFG.
//
// Re-uses the shared resizeImage helper to keep avatar uploads sane.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../lib/supabase-browser'
import { getCachedAuth } from '../../lib/auth-cache'
import { resizeImage } from '../../lib/image-utils'

interface ProfileRow {
  id: string
  username: string
  email: string | null
  role: string | null
  avatar_url: string | null
}

export default function AccountPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [authEmail, setAuthEmail] = useState<string>('')

  // Avatar
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarMessage, setAvatarMessage] = useState<string>('')

  // Username
  const [usernameDraft, setUsernameDraft] = useState('')
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [usernameMessage, setUsernameMessage] = useState<string>('')

  // Email
  const [emailDraft, setEmailDraft] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMessage, setEmailMessage] = useState<string>('')

  // Password
  const [pwd, setPwd] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMessage, setPwdMessage] = useState<string>('')

  useEffect(() => {
    (async () => {
      const { user } = await getCachedAuth()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      setAuthEmail(user.email ?? '')
      setEmailDraft(user.email ?? '')
      const { data } = await supabase
        .from('profiles')
        .select('id, username, email, role, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
      if (data) {
        setProfile(data as ProfileRow)
        setUsernameDraft((data as ProfileRow).username ?? '')
      }
      setLoading(false)
    })()
  }, [router, supabase])

  async function handleAvatarUpload(file: File) {
    if (!userId || !file) return
    setAvatarUploading(true)
    setAvatarMessage('')
    try {
      // Resize to 256px max edge so avatars are tiny + load fast on
      // the sidebar. resizeImage returns a JPEG data URL; convert
      // to Blob for the storage upload.
      const dataUrl = await resizeImage(file, 256)
      const blob = await (await fetch(dataUrl)).blob()
      const path = `${userId}/avatar.jpg`
      const { error: upErr } = await supabase.storage
        .from('account-avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) {
        setAvatarMessage(`Upload failed: ${upErr.message}`)
        setAvatarUploading(false)
        return
      }
      const { data: pub } = supabase.storage.from('account-avatars').getPublicUrl(path)
      // Cache-bust so the new image displays immediately.
      const url = `${pub.publicUrl}?v=${Date.now()}`
      const { error: updErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
      if (updErr) {
        setAvatarMessage(`Saved file but profile update failed: ${updErr.message}`)
      } else {
        setProfile(p => p ? { ...p, avatar_url: url } : p)
        setAvatarMessage('Avatar updated.')
      }
    } catch (err: any) {
      setAvatarMessage(`Error: ${err?.message ?? 'unknown'}`)
    }
    setAvatarUploading(false)
  }

  async function handleAvatarRemove() {
    if (!userId) return
    if (!confirm('Remove your account avatar? You can upload a new one any time.')) return
    setAvatarUploading(true)
    setAvatarMessage('')
    // Best-effort cleanup of the storage object (we don't know the
    // extension for sure, so try both).
    await supabase.storage.from('account-avatars').remove([`${userId}/avatar.jpg`, `${userId}/avatar.png`])
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId)
    if (error) {
      setAvatarMessage(`Remove failed: ${error.message}`)
    } else {
      setProfile(p => p ? { ...p, avatar_url: null } : p)
      setAvatarMessage('Avatar removed.')
    }
    setAvatarUploading(false)
  }

  async function handleUsernameSave() {
    if (!userId) return
    const next = usernameDraft.trim()
    if (!next) { setUsernameMessage('Username cannot be empty.'); return }
    if (next === profile?.username) { setUsernameMessage('No change.'); return }
    setUsernameSaving(true)
    setUsernameMessage('')
    const { error } = await supabase.from('profiles').update({ username: next }).eq('id', userId)
    if (error) {
      setUsernameMessage(`Save failed: ${error.message}`)
    } else {
      setProfile(p => p ? { ...p, username: next } : p)
      setUsernameMessage('Username updated.')
    }
    setUsernameSaving(false)
  }

  async function handleEmailSave() {
    const next = emailDraft.trim().toLowerCase()
    if (!next) { setEmailMessage('Email cannot be empty.'); return }
    if (next === authEmail.toLowerCase()) { setEmailMessage('No change.'); return }
    setEmailSaving(true)
    setEmailMessage('')
    // Supabase emits a verification email to the new address; the
    // change doesn't take effect until the user clicks the link.
    const { error } = await supabase.auth.updateUser({ email: next })
    if (error) {
      setEmailMessage(`Save failed: ${error.message}`)
    } else {
      setEmailMessage('Confirmation email sent. Check your inbox at the new address to finalize the change.')
    }
    setEmailSaving(false)
  }

  async function handlePasswordSave() {
    if (pwd.length < 8) { setPwdMessage('Password must be at least 8 characters.'); return }
    if (pwd !== pwdConfirm) { setPwdMessage('Passwords do not match.'); return }
    setPwdSaving(true)
    setPwdMessage('')
    const { error } = await supabase.auth.updateUser({ password: pwd })
    if (error) {
      setPwdMessage(`Save failed: ${error.message}`)
    } else {
      setPwdMessage('Password updated.')
      setPwd('')
      setPwdConfirm('')
    }
    setPwdSaving(false)
  }

  if (loading) {
    return (
      <div style={{ flex: 1, padding: '60px 20px', textAlign: 'center', color: '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>
        Loading account…
      </div>
    )
  }

  // Shared visual primitives.
  const card: React.CSSProperties = {
    background: '#161616',
    border: '1px solid #2e2e2e',
    borderRadius: '4px',
    padding: '20px 22px',
    marginBottom: '14px',
  }
  const cardTitle: React.CSSProperties = {
    fontFamily: 'Carlito, sans-serif', fontSize: '15px', fontWeight: 700, letterSpacing: '.12em',
    textTransform: 'uppercase', color: '#c0392b', marginBottom: '10px',
  }
  const cardBody: React.CSSProperties = {
    fontSize: '14px', color: '#d4cfc9', lineHeight: 1.5,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif',
    letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '4px', display: 'block',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a',
    borderRadius: '3px', color: '#f5f2ee', fontSize: '14px',
    fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box',
  }
  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '8px 18px', background: disabled ? '#242424' : '#2a1a3e',
    border: `1px solid ${disabled ? '#3a3a3a' : '#5a2e5a'}`, borderRadius: '3px',
    color: disabled ? '#5a5550' : '#c4a7f0', fontSize: '13px',
    fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase',
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
  })
  const msgStyle = (kind: 'ok' | 'err'): React.CSSProperties => ({
    marginTop: '6px', fontSize: '13px',
    color: kind === 'ok' ? '#7fc458' : '#f5a89a',
    fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em',
  })

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#0f0f0f', color: '#d4cfc9' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>

        {/* Hero */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '6px' }}>
            Your Account
          </div>
          <div style={{ fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '32px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1.1, marginBottom: '6px' }}>
            {profile?.username ?? 'Account'}
          </div>
          <div style={{ fontSize: '14px', color: '#cce0f5', lineHeight: 1.5 }}>
            This is YOU — separate from any character. Manage your avatar, identity, and security here.{' '}
            <Link href="/characters" style={{ color: '#c4a7f0' }}>Characters</Link> are managed elsewhere.
          </div>
        </div>

        {/* Avatar */}
        <div style={card}>
          <div style={cardTitle}>Account Avatar</div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{
              width: '96px', height: '96px', borderRadius: '50%',
              background: profile?.avatar_url ? `url(${profile.avatar_url}) center/cover` : '#1a1a1a',
              border: '2px solid #5a2e5a', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif',
              letterSpacing: '.06em', textTransform: 'uppercase',
            }}>
              {!profile?.avatar_url && 'No avatar'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={cardBody}>
                Shown next to your username on the Campfire, in messages, in forums. Square images crop to a circle. We resize uploads to 256×256 to keep things snappy.
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={btnStyle(avatarUploading)}>
                  {avatarUploading ? 'Uploading…' : profile?.avatar_url ? 'Replace' : 'Upload'}
                  <input type="file" accept="image/*" disabled={avatarUploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f) }}
                    style={{ display: 'none' }} />
                </label>
                {profile?.avatar_url && (
                  <button onClick={handleAvatarRemove} disabled={avatarUploading}
                    style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Remove
                  </button>
                )}
              </div>
              {avatarMessage && (
                <div style={msgStyle(avatarMessage.toLowerCase().includes('fail') || avatarMessage.toLowerCase().includes('error') ? 'err' : 'ok')}>
                  {avatarMessage}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Identity */}
        <div style={card}>
          <div style={cardTitle}>Identity</div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Username</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={usernameDraft} onChange={e => setUsernameDraft(e.target.value)}
                style={inputStyle} disabled={usernameSaving} />
              <button onClick={handleUsernameSave} disabled={usernameSaving || !usernameDraft.trim() || usernameDraft.trim() === profile?.username}
                style={btnStyle(usernameSaving || !usernameDraft.trim() || usernameDraft.trim() === profile?.username)}>
                {usernameSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
            {usernameMessage && (
              <div style={msgStyle(usernameMessage.toLowerCase().includes('fail') || usernameMessage.toLowerCase().includes('cannot') ? 'err' : 'ok')}>
                {usernameMessage}
              </div>
            )}
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Email</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={emailDraft} onChange={e => setEmailDraft(e.target.value)} type="email"
                style={inputStyle} disabled={emailSaving} />
              <button onClick={handleEmailSave} disabled={emailSaving || !emailDraft.trim() || emailDraft.trim().toLowerCase() === authEmail.toLowerCase()}
                style={btnStyle(emailSaving || !emailDraft.trim() || emailDraft.trim().toLowerCase() === authEmail.toLowerCase())}>
                {emailSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
            <div style={{ marginTop: '4px', fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>
              Changing your email sends a confirmation link to the new address. The change finalizes when you click that link.
            </div>
            {emailMessage && (
              <div style={msgStyle(emailMessage.toLowerCase().includes('fail') || emailMessage.toLowerCase().includes('cannot') ? 'err' : 'ok')}>
                {emailMessage}
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>Role</label>
            <div style={{ ...inputStyle, color: '#cce0f5', background: '#1a1a1a', cursor: 'not-allowed' }}>
              {profile?.role ?? 'survivor'}
            </div>
            <div style={{ marginTop: '4px', fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>
              Roles are set by the moderation team. Reach out via the Campfire if you think this is wrong.
            </div>
          </div>
        </div>

        {/* Password */}
        <div style={card}>
          <div style={cardTitle}>Password</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <div>
              <label style={labelStyle}>New password</label>
              <input type="password" value={pwd} onChange={e => setPwd(e.target.value)}
                style={inputStyle} disabled={pwdSaving} autoComplete="new-password" />
            </div>
            <div>
              <label style={labelStyle}>Confirm</label>
              <input type="password" value={pwdConfirm} onChange={e => setPwdConfirm(e.target.value)}
                style={inputStyle} disabled={pwdSaving} autoComplete="new-password" />
            </div>
          </div>
          <button onClick={handlePasswordSave} disabled={pwdSaving || pwd.length < 8 || pwd !== pwdConfirm}
            style={btnStyle(pwdSaving || pwd.length < 8 || pwd !== pwdConfirm)}>
            {pwdSaving ? 'Saving…' : 'Update password'}
          </button>
          <div style={{ marginTop: '4px', fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>
            Minimum 8 characters. You won&apos;t be logged out — your current session keeps working.
          </div>
          {pwdMessage && (
            <div style={msgStyle(pwdMessage.toLowerCase().includes('fail') || pwdMessage.toLowerCase().includes('match') || pwdMessage.toLowerCase().includes('must') ? 'err' : 'ok')}>
              {pwdMessage}
            </div>
          )}
        </div>

        {/* Subscriptions placeholder. Phase 5D module monetization
            will wire this — for now it just declares the slot exists
            so users know where to expect it. */}
        <div style={card}>
          <div style={cardTitle}>Subscriptions</div>
          <div style={cardBody}>
            Coming soon. When paid modules launch, your active subscriptions, billing history, and payment methods will live here.
          </div>
        </div>

        {/* Danger zone — account deletion. GDPR-style data deletion:
            invokes the existing delete-user edge function (which now
            permits self-delete). Wipes the user's profile, characters,
            campaign memberships, owned campaigns, pins, notifications,
            funnel events, etc. — see the function for the full list.
            Requires typing the username to confirm. */}
        <DangerZone profile={profile} />

        {/* Privacy + terms link strip. Required for any platform that
            collects user data. Kept compact so the page doesn't end
            on a legal-feeling note. */}
        <div style={{ marginTop: '1rem', paddingTop: '12px', borderTop: '1px solid #2e2e2e', textAlign: 'center', fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em' }}>
          <Link href="/privacy" style={{ color: '#7ab3d4', textDecoration: 'none', marginRight: '14px' }}>Privacy Policy</Link>
          <Link href="/terms" style={{ color: '#7ab3d4', textDecoration: 'none' }}>Terms of Service</Link>
        </div>

        {/* Sign out — bottom of page, secondary action so it's not
            the dominant CTA. The sidebar Log Out is the everyday
            path; this duplicate is for users who landed here. */}
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ padding: '10px 24px', background: 'transparent', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Danger Zone ──────────────────────────────────────────────────
// Account self-deletion. The button starts collapsed; expanding
// surfaces a confirm-typing field so a misclick doesn't nuke a real
// account. The actual delete invokes the delete-user edge function
// (which now allows self-delete). On success, sign out + redirect
// to /login.

interface DangerZoneProps {
  profile: ProfileRow | null
}

function DangerZone({ profile }: DangerZoneProps) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string>('')

  if (!profile) return null

  const expectedConfirm = profile.username
  const matches = confirm.trim() === expectedConfirm

  async function handleDelete() {
    if (!matches || deleting || !profile) return
    setDeleting(true)
    setError('')
    try {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-user`
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: profile.id, caller_id: profile.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) {
        setError(json.error ?? `Delete failed (${res.status})`)
        setDeleting(false)
        return
      }
      // Sign out so the now-deleted session token isn't reused.
      await supabase.auth.signOut()
      router.push('/login?deleted=1')
    } catch (err: any) {
      setError(`Error: ${err?.message ?? 'unknown'}`)
      setDeleting(false)
    }
  }

  return (
    <div style={{
      background: '#1a1010', border: '1px solid #5a1f1f', borderLeft: '3px solid #c0392b',
      borderRadius: '4px', padding: '20px 22px', marginBottom: '14px',
    }}>
      <div style={{
        fontFamily: 'Carlito, sans-serif', fontSize: '15px', fontWeight: 700,
        letterSpacing: '.12em', textTransform: 'uppercase', color: '#f5a89a', marginBottom: '8px',
      }}>
        ⚠ Danger Zone
      </div>
      <div style={{ fontSize: '14px', color: '#d4cfc9', lineHeight: 1.5, marginBottom: '12px' }}>
        Delete your account and personally-identifying data. Characters, campaign memberships, pins, notifications, and funnel events are wiped. Campaigns you GM are deleted along with their content (warn your players first if this is shared).
        Content entangled with other users (forum posts, modules others have subscribed to) is anonymized rather than deleted, so the platform doesn&apos;t break for everyone else.
        <br /><br />
        <strong>This cannot be undone.</strong>
      </div>
      {!open ? (
        <button onClick={() => setOpen(true)}
          style={{
            padding: '8px 18px', background: 'transparent', border: '1px solid #c0392b',
            borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif',
            letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer',
          }}>
          Delete my account…
        </button>
      ) : (
        <div>
          <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>
            Type your username <strong style={{ color: '#f5f2ee' }}>{expectedConfirm}</strong> to confirm.
          </div>
          <input value={confirm} onChange={e => setConfirm(e.target.value)}
            disabled={deleting}
            placeholder={expectedConfirm}
            style={{
              width: '100%', padding: '8px 10px', background: '#241010', border: '1px solid #5a1f1f',
              borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif',
              boxSizing: 'border-box', marginBottom: '10px',
            }} />
          {error && (
            <div style={{ marginBottom: '8px', padding: '6px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', fontSize: '13px', color: '#f5a89a' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleDelete} disabled={!matches || deleting}
              style={{
                padding: '8px 18px',
                background: matches && !deleting ? '#c0392b' : '#241010',
                border: `1px solid ${matches && !deleting ? '#c0392b' : '#3a3a3a'}`,
                borderRadius: '3px',
                color: matches && !deleting ? '#fff' : '#5a5550',
                fontSize: '13px', fontFamily: 'Carlito, sans-serif',
                letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700,
                cursor: matches && !deleting ? 'pointer' : 'not-allowed',
              }}>
              {deleting ? 'Deleting…' : 'Permanently delete'}
            </button>
            <button onClick={() => { setOpen(false); setConfirm(''); setError('') }}
              disabled={deleting}
              style={{
                padding: '8px 14px', background: 'transparent', border: '1px solid #3a3a3a',
                borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif',
                letterSpacing: '.06em', textTransform: 'uppercase', cursor: deleting ? 'not-allowed' : 'pointer',
              }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
