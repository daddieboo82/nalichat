export default function EncryptionDocumentation() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-heading font-bold mb-2">App Encryption Documentation</h1>
      <p className="text-muted-foreground text-sm mb-8">Export Compliance Documentation for App Store Connect</p>

      <section className="space-y-6 text-sm leading-relaxed text-foreground/80">

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">App Name</h2>
          <p>NaliChat</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Bundle Identifier</h2>
          <p>com.base6a1f5ee134147461560c2b37.app</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Encryption Usage Statement</h2>
          <p>NaliChat does <strong>not</strong> contain any custom, proprietary, or non-exempt encryption.</p>
          <p className="mt-2">All encryption used by this app falls under the standard encryption exemptions defined by the U.S. Bureau of Industry and Security (BIS) for mass-market consumer software.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Encryption Technologies Used (All Exempt)</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>HTTPS / TLS:</strong> All network communication uses standard Transport Layer Security (TLS) via the operating system's built-in networking stack. This is exempt under the "standard networking" category.</li>
            <li><strong>OS-Provided Cryptographic APIs:</strong> Any cryptographic operations (such as secure storage of authentication tokens) use the platform's built-in Keychain / secure storage APIs provided by iOS/iPadOS. No custom cryptographic algorithms are implemented.</li>
            <li><strong>Standard Authentication:</strong> User authentication uses industry-standard JWT (JSON Web Token) handling over HTTPS, provided by the app's backend platform (Base44). No custom encryption is applied.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Exemption Claim</h2>
          <p>This app qualifies for the mass-market encryption exemption under 15 CFR §740.13(e) because:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>It uses only encryption that is publicly available and standard.</li>
            <li>It does not implement any proprietary or custom cryptographic algorithms.</li>
            <li>All cryptographic functionality is provided by the operating system or standard, widely-available libraries.</li>
            <li>The app is a consumer-facing application available to the general public.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Declaration</h2>
          <p>I confirm that this app does not use, implement, or distribute any non-exempt encryption technology. All encryption used is standard, publicly available, and falls within the exemptions described above.</p>
        </div>

      </section>
    </div>
  );
}