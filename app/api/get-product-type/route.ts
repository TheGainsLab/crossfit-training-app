import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { priceId } = await request.json()

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID required' },
        { status: 400 }
      )
    }

    // Query subscription_tiers to find which tier has this price ID
    const { data: tier, error } = await supabase
      .from('subscription_tiers')
      .select('id')
      .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_quarterly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
      .single()

    if (error || !tier) {
      // Default to premium if not found
      return NextResponse.json({ 
        productType: 'premium',
        note: 'Price ID not found in subscription_tiers, defaulting to premium'
      })
    }

    // Map tier id to product type
    const productType = tier.id.toLowerCase() // 'btn', 'applied_power', 'engine', etc.

    return NextResponse.json({ 
      productType,
      tierId: tier.id
    })
  } catch (error) {
    console.error('❌ Error getting product type:', error)
    return NextResponse.json(
      { error: 'Internal server error', productType: 'premium' },
      { status: 500 }
    )
  }
}

