import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    console.log('🔍 Verifying Stripe session:', sessionId)

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    console.log('✅ Session retrieved:', session.id, session.payment_status)

    // Verify the session is valid and paid
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Session not paid' }, { status: 400 })
    }

    // Return session data
    return NextResponse.json({
      id: session.id,
      customer_details: session.customer_details,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency
    })

  } catch (error) {
    console.error('❌ Error verifying session:', error)
    return NextResponse.json(
      { error: 'Failed to verify session' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
