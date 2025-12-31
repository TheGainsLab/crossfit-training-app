'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Users,
  Activity,
  MessageCircle,
  Settings,
  ChevronLeft
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: number
}

function AdminNav({ navItems }: { navItems: NavItem[] }) {
  const pathname = usePathname()

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href ||
          (item.href !== '/dashboard/admin' && pathname.startsWith(item.href))

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-coral text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className={`ml-auto px-2 py-0.5 text-xs rounded-full ${
                isActive ? 'bg-white/20 text-white' : 'bg-coral/10 text-coral'
              }`}>
                {item.badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [alertCounts, setAlertCounts] = useState({
    unreadChats: 0
  })

  useEffect(() => {
    async function checkAdminAccess() {
      try {
        const res = await fetch('/api/admin/check-role')
        const data = await res.json()

        if (!data.success || !data.isAdmin) {
          setIsAdmin(false)
          router.push('/dashboard')
          return
        }

        setIsAdmin(true)

        // Fetch alert counts for badges
        try {
          const chatRes = await fetch('/api/admin/chat/conversations?unread=true')
          const chatData = await chatRes.json()
          if (chatData.success) {
            setAlertCounts({
              unreadChats: chatData.conversations?.length || 0
            })
          }
        } catch {
          // Silently fail for badge counts
        }

      } catch (error) {
        console.error('Failed to check admin access:', error)
        setIsAdmin(false)
        router.push('/dashboard')
      } finally {
        setLoading(false)
      }
    }

    checkAdminAccess()
  }, [router])

  const navItems: NavItem[] = [
    {
      href: '/dashboard/admin',
      label: 'Overview',
      icon: <LayoutDashboard className="w-5 h-5" />
    },
    {
      href: '/dashboard/admin/users',
      label: 'Users',
      icon: <Users className="w-5 h-5" />
    },
    {
      href: '/dashboard/admin/training',
      label: 'Training',
      icon: <Activity className="w-5 h-5" />
    },
    {
      href: '/dashboard/admin/chat',
      label: 'Chat',
      icon: <MessageCircle className="w-5 h-5" />,
      badge: alertCounts.unreadChats
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Verifying admin access...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm">Back to App</span>
              </Link>
              <div className="h-6 w-px bg-gray-200" />
              <h1 className="text-lg font-semibold text-gray-900">Admin Dashboard</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="hidden md:block w-56 flex-shrink-0">
            <div className="sticky top-24">
              <AdminNav navItems={navItems} />

              <div className="mt-8 pt-4 border-t border-gray-200">
                <Link
                  href="/dashboard/admin/settings"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </Link>
              </div>
            </div>
          </aside>

          {/* Mobile nav */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
            <div className="flex justify-around py-2">
              {navItems.slice(0, 5).map((item) => {
                const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
                const isActive = pathname === item.href ||
                  (item.href !== '/dashboard/admin' && pathname.startsWith(item.href))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex flex-col items-center gap-1 px-3 py-1 ${
                      isActive ? 'text-coral' : 'text-gray-500'
                    }`}
                  >
                    {item.icon}
                    <span className="text-xs">{item.label.split(' ')[0]}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Main content */}
          <main className="flex-1 min-w-0 pb-20 md:pb-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
