
    // Create auth account with admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true // Skip email confirmation for paid users
    })

    if (authError) {
  console.error('❌ Auth creation error:', authError)
  
  // Handle specific error cases
  if (authError.code === 'email_exists') {
    return NextResponse.json({ 
      error: 'An account with this email already exists. Please log in instead.' 
    }, { status: 409 })
  }
  
  // Generic error for other cases
  return NextResponse.json({ 
    error: 'Account creation failed', 
    details: authError.message 
  }, { status: 400 })
}


    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 })
    }

    console.log('✅ Auth account created:', authData.user.id)
