export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-heading font-bold mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground text-sm mb-8">Last updated: September 11, 2026</p>

      <section className="space-y-6 text-sm leading-relaxed text-foreground/80">

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">1. Introduction</h2>
          <p>Welcome to NaliChat ("we", "our", or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, and share information when you use our app at <a href="https://nalichat.org" className="text-primary underline">nalichat.org</a>.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">2. Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account Information:</strong> Email address, display name, and profile photo when you register.</li>
            <li><strong>Content:</strong> Audio files, messages, and other content you upload or share.</li>
            <li><strong>Usage Data:</strong> How you interact with the app, including pages visited and features used.</li>
            <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To provide and maintain the NaliChat service.</li>
            <li>To enable collaboration features between users.</li>
            <li>To send notifications related to your account and activity.</li>
            <li>To improve and personalize your experience.</li>
            <li>To comply with legal obligations.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">4. Sharing Your Information</h2>
          <p>We do not sell your personal data. We may share information with:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Other Users:</strong> Information you publish to public profile and Explore surfaces may be visible to other NaliChat users. Project files and collaboration content are limited to users who have been granted access, except when you intentionally create a public share link.</li>
            <li><strong>Service Providers:</strong> Third-party services that help us operate the platform (e.g., cloud storage, analytics).</li>
            <li><strong>Legal Requirements:</strong> When required by law or to protect our rights.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">5. Data Retention</h2>
          <p>We retain your data for as long as your account is active. You may request deletion of your account and associated data at any time by contacting us.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">6. Security</h2>
          <p>We use industry-standard security measures to protect your data. However, no method of transmission over the internet is 100% secure.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">7. Children's Privacy</h2>
          <p>NaliChat is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe we have, please contact us immediately.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">8. Your Rights</h2>
          <p>Depending on your location, you may have the right to access, correct, or delete your personal data. Contact us to exercise these rights.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">9. Changes to This Policy</h2>
          <p>We may update this policy from time to time. We will notify you of significant changes by posting the new policy on this page.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">10. Contact Us</h2>
          <p>If you have questions about this Privacy Policy, please contact us at:</p>
          <p className="mt-1"><strong>Email:</strong> privacy@nalichat.org</p>
          <p><strong>Website:</strong> <a href="https://nalichat.org" className="text-primary underline">nalichat.org</a></p>
          <p className="mt-2"><a href="/terms" className="text-primary underline">View our Terms of Service</a></p>
        </div>

      </section>
    </div>
  );
}