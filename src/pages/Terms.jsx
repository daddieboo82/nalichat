export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-heading font-bold mb-2">Terms of Service</h1>
      <p className="text-muted-foreground text-sm mb-8">Last updated: September 8, 2026</p>

      <section className="space-y-6 text-sm leading-relaxed text-foreground/80">

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
          <p>By accessing or using NaliChat ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">2. Description of Service</h2>
          <p>NaliChat is a collaborative workspace for music production and industry professionals, providing real-time messaging, project sharing, a studio environment, remix challenges, and AI-assisted tools.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">3. User Accounts</h2>
          <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account and for all activities that occur under your account.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">4. User Content</h2>
          <p>You retain ownership of content you upload to NaliChat, including audio files, messages, and artwork. You grant NaliChat a license to host, display, and process your content for the purpose of providing the Service. You are solely responsible for ensuring your content does not violate any laws or third-party rights.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">5. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Upload content that is illegal, hateful, harassing, or sexually explicit.</li>
            <li>Use the Service to infringe on copyright or intellectual property rights.</li>
            <li>Attempt to disrupt, overload, or gain unauthorized access to the Service.</li>
            <li>Use AI-generated content features to create misleading or harmful material.</li>
            <li>Spam or send unsolicited content to other users.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">6. Content Moderation</h2>
          <p>NaliChat uses automated AI moderation and user reporting to maintain a safe community. Reported content may be reviewed and removed. Repeated violations may result in account suspension or ban.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">7. Intellectual Property</h2>
          <p>NaliChat and its original features, design, and branding are owned by NaliChat. Music and artwork created by users belong to their respective creators.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">8. Disclaimers</h2>
          <p>The Service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free operation.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">9. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, NaliChat shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">10. Donations and Payments</h2>
          <p>NaliChat is donation-supported. Donations are voluntary and non-refundable except where required by law. Paid features, if any, are processed through the platform's payment system.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">11. Termination</h2>
          <p>We may suspend or terminate your account if you violate these Terms. You may delete your account at any time through the Settings page.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">12. Changes to These Terms</h2>
          <p>We may update these Terms from time to time. We will notify you of significant changes by posting the new Terms on this page.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">13. Contact Us</h2>
          <p>If you have questions about these Terms, please contact us at:</p>
          <p className="mt-1"><strong>Email:</strong> support@nalichat.org</p>
          <p><strong>Website:</strong> <a href="https://nalichat.org" className="text-primary underline">nalichat.org</a></p>
          <p className="mt-2"><a href="/privacy" className="text-primary underline">View our Privacy Policy</a></p>
        </div>

      </section>
    </div>
  );
}