export const metadata = {
  title: 'Privacy Policy - The Gains AI',
};

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif', color: '#333' }}>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> February 9, 2025</p>

      <p>The Gains AI (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the Gains AI mobile application and website. This Privacy Policy explains how we collect, use, and protect your information.</p>

      <h2>Information We Collect</h2>
      <ul>
        <li><strong>Account Information:</strong> Email address and password when you create an account.</li>
        <li><strong>Fitness Data:</strong> Workout logs, training preferences, and program selections you provide.</li>
        <li><strong>Nutrition Data:</strong> Food photos and nutrition information you submit for tracking.</li>
        <li><strong>Camera Access:</strong> Photos taken using the in-app camera for food nutrition tracking. Photos are processed for nutritional analysis and are not shared with third parties.</li>
        <li><strong>Payment Information:</strong> Subscription purchases are processed by Apple (App Store), Google (Play Store), or Stripe (web). We do not store your payment card details.</li>
        <li><strong>Device Information:</strong> Device type, operating system, and app version for troubleshooting and analytics.</li>
      </ul>

      <h2>How We Use Your Information</h2>
      <ul>
        <li>To provide and personalize your training programs and nutrition tracking.</li>
        <li>To manage your account and subscription.</li>
        <li>To send workout reminders and coaching notifications (with your permission).</li>
        <li>To improve our app and services.</li>
      </ul>

      <h2>Third-Party Services</h2>
      <p>We use the following third-party services:</p>
      <ul>
        <li><strong>Supabase:</strong> Authentication and data storage.</li>
        <li><strong>RevenueCat:</strong> Subscription management for mobile purchases.</li>
        <li><strong>Stripe:</strong> Payment processing for web purchases.</li>
        <li><strong>Expo:</strong> Push notifications.</li>
      </ul>

      <h2>Data Security</h2>
      <p>We use industry-standard security measures to protect your data, including encryption in transit and at rest. Your data is stored securely using Supabase infrastructure.</p>

      <h2>Data Retention</h2>
      <p>We retain your data for as long as your account is active. You may request deletion of your account and associated data at any time by contacting us.</p>

      <h2>Children&apos;s Privacy</h2>
      <p>Our app is not intended for children under 13. We do not knowingly collect information from children under 13.</p>

      <h2>Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access your personal data.</li>
        <li>Request correction or deletion of your data.</li>
        <li>Opt out of marketing communications.</li>
        <li>Request a copy of your data.</li>
      </ul>

      <h2>Contact Us</h2>
      <p>If you have questions about this Privacy Policy, contact us at:</p>
      <p>Email: support@thegainslab.com</p>

      <h2>Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page.</p>
    </div>
  );
}
