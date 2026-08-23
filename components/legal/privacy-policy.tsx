'use client'

import Link from 'next/link'

export function PrivacyPolicy() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/images/favicon.png" alt="Trova" width={24} height={24} style={{ borderRadius: 7 }} />
            <span className="text-sm font-semibold">Trova</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/sign-in" style={{ color: 'var(--text-secondary)' }} className="hover:text-white transition-colors">
              Sign in
            </Link>
            <Link href="/sign-up" className="font-semibold text-white px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--accent-primary)' }}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <article className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="text-xs font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--text-muted)' }}>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <h1 className="text-4xl font-bold mt-3 mb-4">Privacy Policy</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            At Trova, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information.
          </p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8" style={{ color: 'var(--text-secondary)' }}>
          {/* Section 1 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>1. Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Information You Provide Directly</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li><strong>Account Registration:</strong> When you create a Trova account, we collect your name, email address, password, and business information.</li>
                  <li><strong>Store Configuration:</strong> Details about your store including address, phone number, currency preferences, and inventory categories.</li>
                  <li><strong>Transaction Data:</strong> Information about products, sales, inventory intake, vendors, and customer transactions you record in the system.</li>
                  <li><strong>Communication:</strong> When you contact our support team, we keep records of your inquiries and correspondence.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Information Collected Automatically</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li><strong>Usage Data:</strong> We collect information about how you interact with Trova, including login timestamps, features used, and session duration.</li>
                  <li><strong>Device Information:</strong> Browser type, operating system, IP address, and device identifiers.</li>
                  <li><strong>Cookies:</strong> We use cookies and similar technologies to recognize you and personalize your experience.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>2. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>To provide and maintain the Trova platform</li>
              <li>To authenticate your identity and secure your account</li>
              <li>To process your transactions and send related information</li>
              <li>To send you technical notices and support messages</li>
              <li>To respond to your inquiries and provide customer support</li>
              <li>To monitor and analyze usage trends and improve the service</li>
              <li>To detect, investigate, and prevent fraudulent transactions and other illegal activities</li>
              <li>To send promotional communications (with your consent)</li>
              <li>To comply with legal obligations and enforce our Terms of Service</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>3. Information Sharing and Disclosure</h2>
            <div className="space-y-4">
              <p>We do <strong>not</strong> sell, trade, or rent your personal information to third parties. We may share your information in these limited circumstances:</p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Service Providers:</strong> With vendors who assist us in operating Trova (e.g., payment processors, email providers, hosting services)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights, privacy, safety, or property</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, bankruptcy, or sale of assets</li>
                <li><strong>Team Members:</strong> Your store data is shared with team members you invite to access your workspace</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>4. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes encryption, secure authentication, and regular security assessments. However, no method of transmission over the Internet is 100% secure, so we cannot guarantee absolute security.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>5. Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to provide Trova and fulfill the purposes outlined in this Privacy Policy. You can request deletion of your account and associated data at any time through your settings or by contacting us. Some information may be retained for legal compliance or legitimate business purposes.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>6. Your Rights and Choices</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Access:</strong> You can access and review your personal information through your account settings</li>
              <li><strong>Correction:</strong> You can update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> You can request deletion of your account and associated data</li>
              <li><strong>Opt-Out:</strong> You can opt out of receiving promotional emails by clicking the unsubscribe link</li>
              <li><strong>Export:</strong> You can request a copy of your data in a portable format</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>7. Cookies and Tracking</h2>
            <p>
              Trova uses cookies to enhance your experience and collect analytics. Essential cookies are necessary for the platform to function. You can control cookie settings through your browser, though disabling some cookies may affect functionality. We do not track you across other websites.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>8. Third-Party Links</h2>
            <p>
              Trova may contain links to third-party websites and services. We are not responsible for their privacy practices. We encourage you to review their privacy policies before providing any personal information.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>9. Children's Privacy</h2>
            <p>
              Trova is not intended for use by individuals under 18 years of age. We do not knowingly collect personal information from children. If we discover we have collected information from a child, we will delete it promptly.
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically to reflect changes in our practices or legal requirements. We will notify you of any material changes by updating the "Last updated" date and posting the revised policy on this page. Your continued use of Trova constitutes your acceptance of the updated Privacy Policy.
            </p>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>11. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', border: '1px solid var(--border)' }}>
              <p className="font-semibold">Trova Support</p>
              <p className="text-sm mt-2">Email: <Link href="mailto:privacy@trovainv.com" style={{ color: 'var(--accent-primary)' }}>privacy@trovainv.com</Link></p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t flex flex-col sm:flex-row gap-4 sm:gap-8 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <Link href="/sign-in" className="hover:text-white transition-colors">Sign In</Link>
          <Link href="/sign-up" className="hover:text-white transition-colors">Get Started</Link>
          <span>© {new Date().getFullYear()} Trova. All rights reserved.</span>
        </footer>
      </article>
    </main>
  )
}
