# Spec: Invite-Code Gate (Hybrid)

Spec for the hunt-and-peck lane. Ruling logged in `tasks/decisions.md` 2026-05-20: HYBRID invite-code gate. Optional code field on signup (empty = normal signup; filled = attribute + mark used) + a feature flag to flip the gate to REQUIRED when launch velocity needs capping.

**Lane:** hunt-and-peck executes.

**Status:** SPEC 2026-05-20. No code yet.

---

## 1. Current state

Signup flow at `app/signup/page.tsx`:
- Turnstile CAPTCHA check at L122-134 (`POST /api/auth/verify-turnstile`).
- `supabase.auth.signUp({ email, password, options: { data: { username } } })` at L144.
- Profile row created server-side by `handle_new_user()` trigger (SECURITY DEFINER).

No invite-code concept exists today. Anyone can sign up with email + password + passing the CAPTCHA.

---

## 2. Target state

- New `signup_invites` table holding codes + redemption state + attribution.
- Signup form gains an OPTIONAL "invite code" field.
  - Empty -> signup proceeds as today.
  - Filled + valid + unused -> signup proceeds, code marked used, attribution recorded.
  - Filled + invalid/used -> signup blocked with a clear message (only when the code field is non-empty).
- A feature flag (`INVITE_REQUIRED`) flips the gate: when on, the code field becomes REQUIRED and empty/invalid codes block signup. Default OFF (hybrid/optional).
- A `/moderate` section to mint + list + revoke codes (Thriver-only).

---

## 3. Schema changes

```sql
-- sql/signup-invites-2026-05-DD.sql (idempotent)
CREATE TABLE IF NOT EXISTS public.signup_invites (
  code         text PRIMARY KEY,
  issued_to    text,                       -- free-text: outlet name, reviewer handle, etc.
  issued_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at    timestamptz NOT NULL DEFAULT now(),
  used_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at      timestamptz,
  revoked_at   timestamptz,                -- set to disable a leaked code
  max_uses     int NOT NULL DEFAULT 1,     -- 1 = single-use; >1 = shared code (e.g. an outlet's batch)
  use_count    int NOT NULL DEFAULT 0
);

ALTER TABLE public.signup_invites ENABLE ROW LEVEL SECURITY;

-- Thrivers manage codes; nobody else reads them directly (redemption is via
-- a SECURITY DEFINER function so the anon signup flow can validate without
-- exposing the table).
DROP POLICY IF EXISTS "Thrivers manage invites" ON public.signup_invites;
CREATE POLICY "Thrivers manage invites"
  ON public.signup_invites FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver'));
```

### Redemption function (SECURITY DEFINER)

The anon signup flow can't read `signup_invites` directly (RLS blocks it). A SECURITY DEFINER function validates + redeems atomically:

```sql
CREATE OR REPLACE FUNCTION public.redeem_invite(p_code text, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_ok boolean;
BEGIN
  UPDATE public.signup_invites
    SET use_count = use_count + 1,
        used_by   = COALESCE(used_by, p_user_id),
        used_at   = COALESCE(used_at, now())
  WHERE code = p_code
    AND revoked_at IS NULL
    AND use_count < max_uses
  RETURNING true INTO v_ok;
  RETURN COALESCE(v_ok, false);
END;
$$;
```

A validate-only variant (`invite_is_valid(p_code)`) can check WITHOUT redeeming, for pre-submit form feedback.

---

## 4. Code changes

### 4a. Feature flag

Add `INVITE_REQUIRED` as an env var (Vercel) read at the signup boundary. Default unset = OFF (hybrid). When `INVITE_REQUIRED=true`, the gate enforces.

Recommend an `/api/auth/invite-config` route (or read it in the verify-turnstile sibling) so the client knows whether to mark the field required - OR just always render the field as optional and enforce server-side.

### 4b. Signup form field

`app/signup/page.tsx`: add an "Invite code (optional)" text input. Pass its value into the signup flow.

### 4c. Redemption at signup

After `supabase.auth.signUp` succeeds (L144-159) and a user id exists:
- If code field non-empty: call `supabase.rpc('redeem_invite', { p_code: code, p_user_id: userId })`.
  - Returns `false` -> the code was invalid/used/revoked. Behavior depends on the flag:
    - Hybrid (flag off): the signup already succeeded; log the failed redemption but don't block (the user just doesn't get attributed). OR decide to hard-fail even in hybrid if a code was ENTERED but invalid (cleaner UX: "that code isn't valid"). **Recommend: if a code is entered, it must be valid - block with a clear message; empty is the no-code path.**
  - Returns `true` -> attributed.
- If `INVITE_REQUIRED` and code empty -> block before `signUp` with "an invite code is required."

**Ordering subtlety:** redemption happens AFTER `signUp` (we need the user id). If redemption fails on a required-code deploy, you've created an auth user without a valid invite. Two mitigations:
- Validate the code (validate-only RPC) BEFORE `signUp` when the flag is on, so an invalid code blocks before account creation.
- Redeem AFTER signUp for attribution.

### 4d. Mint/manage UI

`/moderate` (or a new `/moderate/invites`) Thriver-only page:
- Generate N codes (random, e.g. `TAPESTRY-<6 alnum>`), optionally with an `issued_to` label + `max_uses`.
- List codes with redemption state (`use_count / max_uses`, `used_by`, `revoked_at`).
- Revoke button (sets `revoked_at`).

---

## 5. Migration phases

### IC1: schema + RPC (0.5 session)
Apply Section 3 SQL. Verify table + RLS + the two functions. Test `redeem_invite` manually in SQL editor (valid code redeems, used code returns false, revoked returns false).

### IC2: mint UI (0.5 session)
`/moderate/invites` page: generate + list + revoke. Verify a Thriver can mint a code + see it; a non-Thriver gets RLS-denied.

### IC3: signup form + redemption (1 session)
Add the optional field + wire redemption. Ship with `INVITE_REQUIRED` OFF (hybrid). Verify:
- Signup with no code -> works (normal path).
- Signup with a valid code -> works + code marked used + attributed.
- Signup with an invalid code -> blocked with clear message.

**Gate:** all three signup paths above.

### IC4: required-mode flag (0.5 session)
Wire `INVITE_REQUIRED`. Verify: with the flag on, empty code blocks signup; valid code works. Validate-before-signUp ordering confirmed (no orphan auth users on invalid required-code attempts).

---

## 6. Backfill plan

None. No existing invites; the table starts empty. Existing users signed up without codes - that's fine (the `used_by` attribution is only for post-launch signups).

---

## 7. Risks

### IC-R1: orphan auth user on required-mode failure
If the flag is ON and redemption is attempted AFTER signUp, an invalid code leaves an auth user with no valid invite. **Mitigation:** in required-mode, validate the code BEFORE `signUp` (validate-only RPC). Section 4c covers this.

### IC-R2: leaked code spreads
A reviewer tweets their code; strangers redeem it. **Mitigation:** `max_uses` caps shared codes; `revoked_at` kills a leaked one instantly. Single-use codes (`max_uses = 1`) are the default.

### IC-R3: RLS exposure of the invites table
If the anon flow could read `signup_invites` directly, codes would leak. **Mitigation:** redemption goes through the SECURITY DEFINER RPC; the table itself is Thriver-only RLS. The anon client never SELECTs the table.

### IC-R4: race on a shared code at max_uses boundary
Two simultaneous redemptions of a code at `use_count = max_uses - 1`. **Mitigation:** the `UPDATE ... WHERE use_count < max_uses RETURNING` is atomic per-row; Postgres serializes the two updates. Only one crosses the threshold.

### IC-R5: feature flag default must be OFF
A misconfigured deploy with `INVITE_REQUIRED=true` and no codes minted locks out ALL signups. **Mitigation:** default unset = hybrid/optional. Only flip ON deliberately after codes exist.

---

## 8. Smoke test matrix

| Step | Test |
|---|---|
| Schema | Table + RLS + both RPCs exist. |
| Mint | Thriver mints a code; non-Thriver RLS-denied. |
| Hybrid no-code | Signup with empty code field works. |
| Hybrid valid code | Signup + redemption + attribution recorded. |
| Hybrid invalid code | Signup blocked with clear message. |
| Required mode | Flag on: empty code blocks; valid code works; no orphan auth user on invalid. |
| Revoke | Revoked code returns false on redemption. |
| Shared code | `max_uses=3` code redeems 3 times then blocks. |

---

## 9. Maintenance

Update `tasks/launch-plan-2026-06-15.md` invite-code section when this ships (mark the gate live). If the REQUIRED flag is ever flipped on for a launch, document the date + why in `tasks/decisions.md`. Add the `signup_invites` table to the RLS gap-sweep audit's Tier-1 list (it'll have full repo coverage from this spec's SQL).
