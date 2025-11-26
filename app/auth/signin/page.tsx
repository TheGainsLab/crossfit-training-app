'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMessage(`❌ Error: ${error.message}`)
        return
      }

      if (data.user) {
        setMessage('✅ Signed in successfully! Redirecting...')
        
        // Check user's subscription tier and program status
        const { data: userData } = await supabase
          .from('users')
          .select('id, subscription_tier')
          .eq('auth_id', data.user.id)
          .single()

        if (userData) {
          // BTN users should go to workout history
          if (userData.subscription_tier === 'BTN') {
            router.push('/btn/workouts')
            return
          }
          
          // Engine users should go to Engine dashboard
          if (userData.subscription_tier === 'ENGINE') {
            router.push('/engine')
            return
          }
          
          // Check if user has a program (for Premium/Applied Power)
          const { data: programData } = await supabase
            .from('programs')
            .select('id')
            .eq('user_id', userData.id)
            .limit(1)
            .single()

          if (programData) {
            // User has a program, go to dashboard
            router.push('/dashboard')
          } else {
            // No program yet, go to intake
            router.push('/intake')
          }
        } else {
          // No user record found, go to intake
          router.push('/intake')
        }
      }
    } catch (error) {
      setMessage('❌ An unexpected error occurred')
      console.error('Sign in error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link href="/" className="font-medium text-blue-600 hover:text-blue-500">
              return to homepage
            </Link>
          </p>
        </div>

        {message && (
          <div className={`p-4 rounded-md ${
            message.startsWith('✅') 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Just completed a purchase?{' '}
              <Link href="/intake" className="font-medium text-blue-600 hover:text-blue-500">
                Access your intake form
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
