import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Test database connection by counting equipment options
    const { data, error } = await supabase
      .from('equipment_options')
      .select('*')
      
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ 
      message: 'Database connected successfully!',
      equipmentCount: data?.length || 0,
      sampleEquipment: data?.slice(0, 3).map(item => item.name) || []
    })
  } catch (error) {
    return NextResponse.json({ error: 'Connection failed' }, { status: 500 })
  }
}
