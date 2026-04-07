import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Pass Vercel geo headers as cookies for client-side access
  const country = request.headers.get('x-vercel-ip-country') ?? ''
  const region = request.headers.get('x-vercel-ip-country-region') ?? ''
  const city = request.headers.get('x-vercel-ip-city') ?? ''
  const lat = request.headers.get('x-vercel-ip-latitude') ?? ''
  const lng = request.headers.get('x-vercel-ip-longitude') ?? ''

  if (country) response.cookies.set('geo_country', country, { path: '/', sameSite: 'lax' })
  if (region) response.cookies.set('geo_region', region, { path: '/', sameSite: 'lax' })
  if (city) response.cookies.set('geo_city', decodeURIComponent(city), { path: '/', sameSite: 'lax' })
  if (lat) response.cookies.set('geo_lat', lat, { path: '/', sameSite: 'lax' })
  if (lng) response.cookies.set('geo_lng', lng, { path: '/', sameSite: 'lax' })

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/).*)'],
}
