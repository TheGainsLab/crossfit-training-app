'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function BTNSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing your subscription...');

  useEffect(() => {
    handleSuccess();
  }, []);

  const handleSuccess = async () => {
    try {
      const sessionId = searchParams.get('session_id');
      
      if (!sessionId) {
        setStatus('error');
        setMessage('No session found. Please contact support.');
        return;
      }

      console.log('🔍 Verifying Stripe session:', sessionId);

      // Verify the Stripe session
      const verifyResponse = await fetch('/api/verify-stripe-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const verifyData = await verifyResponse.json();
      console.log('✅ Session verified:', verifyData);

      if (!verifyData.customer_details?.email) {
        setStatus('error');
        setMessage('Could not retrieve customer email. Please contact support.');
        return;
      }

      const email = verifyData.customer_details.email;
      console.log('📧 Customer email:', email);

      // Check if user already has auth account
      const supabase = createClient();
      
      // Try to sign in with magic link approach (will work if they have an account)
      // For now, we'll create a temporary password and force a password reset
      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'; // Meets requirements
      
      console.log('🔐 Creating auth account for:', email);
      
      // Try to sign up the user (will fail if already exists, which is fine)
      const { error: signUpError } = await supabase.auth.signUp({
        email: email,
        password: tempPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/profile`,
        }
      });

      if (signUpError && !signUpError.message.includes('already registered')) {
        console.error('❌ Sign up error:', signUpError);
        // Try to sign in instead
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email,
          password: tempPassword,
        });

        if (signInError) {
          // Send password reset email
          console.log('📧 Sending password reset email');
          await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/profile`,
          });
          
          setStatus('success');
          setMessage('Please check your email to set your password and access your account.');
          
          setTimeout(() => {
            router.push('/auth/signin');
          }, 5000);
          return;
        }
      }

      // Success! Redirect to profile
      setStatus('success');
      setMessage('Subscription activated! Redirecting to your profile...');
      
      setTimeout(() => {
        router.push('/profile');
      }, 2000);

    } catch (error) {
      console.error('❌ Error processing subscription:', error);
      setStatus('error');
      setMessage('An error occurred. Please try signing in with your email.');
      
      setTimeout(() => {
        router.push('/auth/signin');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#FE5858] mx-auto mb-6"></div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Processing...</h1>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-6">
              <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Success!</h1>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-6">
              <svg className="w-16 h-16 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Almost There</h1>
            <p className="text-gray-600 mb-4">{message}</p>
            <a
              href="/auth/signin"
              className="inline-block px-6 py-3 bg-[#FE5858] text-white rounded-lg font-semibold hover:bg-[#ff6b6b] transition-colors"
            >
              Go to Sign In
            </a>
          </>
        )}
      </div>
    </div>
  );
}
