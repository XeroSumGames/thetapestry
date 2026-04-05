'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { logVisit } from '../lib/events'

export default function VisitLogger() {
  const pathname = usePathname()

  useEffect(() => {
    logVisit(pathname)
  }, [pathname])

  return null
}
