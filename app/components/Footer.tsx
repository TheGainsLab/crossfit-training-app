import Link from 'next/link';

interface FooterProps {
  variant?: 'full' | 'minimal';
}

export default function Footer({ variant = 'minimal' }: FooterProps) {
  if (variant === 'full') {
    return (
      <>
        {/* Full Footer - Home page only */}
        
        {/* Final CTA */}
        <section className="py-16" style={{ backgroundColor: '#282B34', color: '#FFFFFF' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-8">Train with a system that understands you.</h2>
            
            {/* App Download Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4">
              <a
                href="YOUR_APP_STORE_LINK"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors hover:opacity-90"
                style={{ backgroundColor: '#FE5858' }}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                Download on App Store
              </a>
              
              <a
                href="YOUR_GOOGLE_PLAY_LINK"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg text-lg font-semibold transition-colors hover:opacity-90"
                style={{ backgroundColor: '#FFFFFF', color: '#282B34' }}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                </svg>
                Get it on Google Play
              </a>
            </div>
            <p className="text-sm text-gray-400">3-day free trial • No credit card required</p>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-800 text-white py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-1 gap-8">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <span style={{ color: '#282B34' }}>G</span>
                  <span style={{ color: '#FE5858' }}>A</span>
                  <span style={{ color: '#FE5858' }}>I</span>
                  <span style={{ color: '#282B34' }}>N</span>
                  <span style={{ color: '#282B34' }}>S</span>
                </h3>
                <p className="text-gray-400">Personalized CrossFit training programs powered by GainsAI™. Built by coaches, enhanced by artificial intelligence.</p>
              </div>
            </div>
            <div className="border-t border-gray-700 mt-8 pt-8 flex justify-between items-center">
              <p className="text-gray-400 text-sm">&copy; 2025 The Gains Apps. All rights reserved. GainsAI™ is a trademark of The Gains Apps.</p>
              <Link href="/auth/signin" className="text-xs text-gray-500 hover:text-gray-400 transition-colors">
                Admin
              </Link>
            </div>
          </div>
        </footer>
      </>
    );
  }

  // Minimal Footer - Product pages
  return (
    <footer className="bg-gray-100 py-8 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-sm text-gray-600">
            <p>&copy; 2025 The Gains Apps</p>
            <span className="hidden sm:inline text-gray-400">•</span>
            <div className="flex gap-3">
              <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
              <span className="text-gray-400">•</span>
              <Link href="/engine" className="hover:text-gray-900 transition-colors">Engine</Link>
              <span className="text-gray-400">•</span>
              <Link href="/appliedpower" className="hover:text-gray-900 transition-colors">Applied Power</Link>
              <span className="text-gray-400">•</span>
              <Link href="/btn" className="hover:text-gray-900 transition-colors">BTN</Link>
            </div>
          </div>
          <Link href="/auth/signin" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
