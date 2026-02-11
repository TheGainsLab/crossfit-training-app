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
  const [userRole, setUserRole] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()
    loadUser()
    const { data: authListener } = supabase.auth.onAuthStateChange((_event: any, session: { user?: User } | null) => {
      const authedUser = (session?.user as User) || null
      setUser(authedUser)
      if (authedUser) {
        supabase
          .from('users')
          .select('name, role')
          .eq('auth_id', authedUser.id)
          .single()
          .then(({ data }: { data?: { name?: string, role?: string } | null }) => {
            if (data?.name) setUserName(data.name)
            if (data?.role) setUserRole(data.role)
          })
      } else {
        setUserName('')
        setUserRole(null)
      }
      setIsLoading(false)
    })
    return () => {
      try { authListener?.subscription?.unsubscribe?.() } catch {}
    }
  }, [])

  const loadUser = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setUser(user)

        const { data: userData } = await supabase
          .from('users')
          .select('name, role')
          .eq('auth_id', user.id)
          .single()

        if (userData?.name) setUserName(userData.name)
        if (userData?.role) setUserRole(userData.role)
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

  const handleSignIn = async () => {
    try {
      window.location.href = '/auth/signin'
    } catch {}
  }

  // Don't show navigation on auth pages
  if (pathname?.startsWith('/auth')) {
    return null
  }

  // Only show navigation for admin users
  if (!user || userRole !== 'admin') {
    return null
  }

  return (
    <nav className="supports-[backdrop-filter]:bg-white/80 bg-white/95 backdrop-blur border-b shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link
            href="/dashboard/admin"
            className="text-5xl sm:text-6xl font-bold hover:opacity-90 transition-opacity flex items-center h-full leading-none"
          >
            <span style={{ color: '#282B34' }}>G</span>
            <span style={{ color: '#FE5858' }}>A</span>
            <span style={{ color: '#FE5858' }}>I</span>
            <span style={{ color: '#282B34' }}>N</span>
            <span style={{ color: '#282B34' }}>S</span>
          </Link>

          {/* Auth actions */}
          <div className="flex items-center">
            {user ? (
              <>
                <div className="mr-4">
                  <p className="text-sm text-gray-700">
                    {userName || user.email}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-white bg-coral hover:opacity-90 rounded-md transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={handleSignIn}
                className="px-4 py-2 text-sm font-medium text-white bg-coral hover:opacity-90 rounded-md transition-colors"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
