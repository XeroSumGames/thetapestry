import { createClient } from '../../../lib/supabase-browser'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', 'http://localhost:3000'))
}