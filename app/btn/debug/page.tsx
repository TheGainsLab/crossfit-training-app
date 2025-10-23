'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BTNDebugPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDebugData()
  }, [])

  const loadDebugData = async () => {
    try {
      const supabase = createClient()
      
      // Get auth user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setData({ error: 'Not authenticated' })
        setLoading(false)
        return
      }

      // Get user data
      const { data: userData } = await supabase
        .from('users')
        .select('id, email, subscription_tier, subscription_status, stripe_customer_id')
        .eq('auth_id', user.id)
        .single()

      // Get subscription data
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userData?.id)

      // Check access
      const accessResponse = await fetch('/api/btn/check-access')
      const accessData = await accessResponse.json()

      setData({
        auth: {
          id: user.id,
          email: user.email
        },
        user: userData,
        subscriptions,
        accessCheck: accessData
      })
    } catch (error: any) {
      setData({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FE5858]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">BTN Subscription Debug</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <pre className="whitespace-pre-wrap text-sm">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>

        <div className="mt-6">
          <button
            onClick={loadDebugData}
            className="px-4 py-2 bg-[#FE5858] text-white rounded-lg hover:bg-[#ff6b6b]"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
