'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

export default function Navigation() {
  const [user, setUser] = useState<User | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [todaysHref, setTodaysHref] = useState<string>('/dashboard')
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()
    loadUser()
    const { data: authListener } = supabase.auth.onAuthStateChange((_event: any, session: { user?: User } | null) => {
      const authedUser = (session?.user as User) || null
      setUser(authedUser)
      if (authedUser) {
        // Refresh name on auth change
        supabase
          .from('users')
          .select('name')
          .eq('auth_id', authedUser.id)
          .single()
          .then(({ data }) => {
            if (data?.name) setUserName(data.name)
          })
      } else {
        setUserName('')
      }
      setIsLoading(false)
    })
    return () => {
      try { authListener?.subscription?.unsubscribe?.() } catch {}
    }
  }, [])

  // Compute "Today's Workout" dynamic href based on next incomplete day
  useEffect(() => {
    const computeTodaysHref = async () => {
      try {
        if (!user) return
        const supabase = createClient()
        const { data: userRow } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single()
        const userId = userRow?.id
        if (!userId) return

        // Get latest program with JSON data
        const { data: programRow } = await supabase
          .from('programs')
          .select('id, program_data')
          .eq('user_id', userId)
          .order('id', { ascending: false })
          .limit(1)
          .single()
        const programId = programRow?.id
        const programData: any = programRow?.program_data || {}
        if (!programId || !programData?.weeks) {
          setTodaysHref('/intake')
          return
        }

        const { data: logs } = await supabase
          .from('performance_logs')
          .select('week, day')
          .eq('user_id', userId)

        const completed = new Set<string>((logs || []).map((l: any) => `${l.week}-${l.day}`))

        // Build planned days from program JSON (weeks[].days[].day)
        const planned: Array<{ week: number; day: number }> = []
        try {
          const weeks: any[] = Array.isArray(programData.weeks) ? programData.weeks : []
          weeks.forEach((w: any) => {
            const wk = Number(w?.week) || 0
            const days: any[] = Array.isArray(w?.days) ? w.days : []
            days.forEach((d: any) => {
              const dy = Number(d?.day) || 0
              if (wk > 0 && dy > 0) planned.push({ week: wk, day: dy })
            })
          })
          planned.sort((a, b) => (a.week - b.week) || (a.day - b.day))
        } catch {}

        // Find first incomplete planned day
        let nextWeek = 1
        let nextDay = 1
        if (planned.length > 0) {
          const first = planned[0]
          nextWeek = first.week
          nextDay = first.day
          let found = false
          for (const p of planned) {
            const key = `${p.week}-${p.day}`
            if (!completed.has(key)) { nextWeek = p.week; nextDay = p.day; found = true; break }
          }
          if (!found) {
            const last = planned[planned.length - 1]
            nextWeek = last.week
            nextDay = last.day
          }
        }

        setTodaysHref(`/dashboard/workout/${programId}/week/${nextWeek}/day/${nextDay}`)
      } catch (e) {
        // Keep default
      }
    }
    computeTodaysHref()
  }, [user])

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  const loadUser = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        
        // Get user's name from the database
        const { data: userData } = await supabase
          .from('users')
          .select('name')
          .eq('auth_id', user.id)
          .single()
        
        if (userData?.name) {
          setUserName(userData.name)
        }
      }
      setIsLoading(false)
    } catch (error) {
      console.error('Error loading user:', error)
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = '/auth/signin'
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  // Don't show navigation on auth pages or if user is not logged in
  if (pathname?.startsWith('/auth') || (!user && !isLoading)) {
    return null
  }

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + '/')
  }

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: todaysHref, label: 'Today\'s Workout' },
    { href: '/profile', label: 'Profile' },
  ]

  return (
    <>
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left side - Logo and main nav */}
            <div className="flex">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center">
                <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                  The Gains Apps
                </Link>
              </div>

              {/* Main navigation - Desktop only */}
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive(link.href)
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right side - User info and logout (Desktop) */}
            <div className="hidden sm:flex items-center">
              {user && (
                <>
                  <div className="mr-4">
                    <p className="text-sm text-gray-700">
                      {userName || user.email}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center sm:hidden">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={toggleMobileMenu}
                aria-expanded={isMobileMenuOpen}
              >
                <span className="sr-only">Open main menu</span>
                {/* Hamburger icon */}
                {!isMobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-25 z-40 sm:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Mobile menu panel */}
          <div className="fixed top-16 left-0 right-0 bg-white border-b shadow-lg z-50 sm:hidden">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-3 py-3 rounded-md text-base font-medium transition-colors ${
                    isActive(link.href)
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              
              {/* Mobile user info and logout */}
              {user && (
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="px-3 py-2 text-sm text-gray-600">
                    Signed in as {userName || user.email}
                  </div>
                  <button
                    onClick={() => {
                      handleLogout()
                      setIsMobileMenuOpen(false)
                    }}
                    className="block w-full text-left px-3 py-3 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
