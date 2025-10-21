import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      )
    }

    console.log('🔍 Verifying Stripe session:', sessionId)

    // Retrieve the session with line items to get price ID
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'line_items.data.price']
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    console.log('✅ Stripe session retrieved:', {
      id: session.id,
      email: session.customer_details?.email,
      priceId: session.line_items?.data?.[0]?.price?.id
    })

    return NextResponse.json({
      id: session.id,
      customer_details: session.customer_details,
      line_items: {
        data: session.line_items?.data || []
      }
    })
  } catch (error: any) {
    console.error('❌ Error verifying Stripe session:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
