import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    const productType = session.metadata?.product || 'premium'
    const customerEmail = session.customer_details?.email || session.customer_email || ''
    const customerName = session.customer_details?.name || ''

    return NextResponse.json({
      email: customerEmail,
      name: customerName,
      productType,
      status: session.status
    })
  } catch (error: any) {
    console.error('Error verifying checkout session:', error)
    return NextResponse.json({ error: 'Invalid session' }, { status: 400 })
  }
}
