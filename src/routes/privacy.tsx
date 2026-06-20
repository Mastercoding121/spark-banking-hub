import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [{ title: "Privacy Policy — FinextHub Bank of USA" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <LegalPage title="Privacy Policy" lastUpdated="June 1, 2026" sections={PRIVACY_SECTIONS} />;
}

const PRIVACY_SECTIONS = [
  {
    heading: "1. Introduction",
    body: `FinextHub Bank of USA ("FinextHub," "we," "our," or "us") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our online banking platform, mobile application, and related services (collectively, the "Services"). Please read this policy carefully. By using our Services, you consent to the practices described herein.`,
  },
  {
    heading: "2. Information We Collect",
    body: `We collect information you provide directly to us, including:
• Identity information: full legal name, date of birth, Social Security Number (SSN), government-issued identification.
• Contact information: email address, phone number, mailing address.
• Financial information: account numbers, transaction history, balances, loan and investment data, employment and income details.
• Security information: usernames, passwords (stored as one-way hashes), security questions and answers, biometric indicators (if enabled).
• Device and usage information: IP address, browser type, operating system, pages visited, time and date of access, referring URLs, and device identifiers.
• Communications: records of your correspondence with our customer support team.`,
  },
  {
    heading: "3. How We Use Your Information",
    body: `We use the information we collect to:
• Open and manage your accounts and process transactions.
• Verify your identity and prevent fraud, money laundering, and other illegal activity.
• Provide, maintain, and improve our Services.
• Communicate with you about your account, products, and promotional offers (where permitted by law).
• Comply with legal and regulatory obligations, including those imposed by the Bank Secrecy Act (BSA), USA PATRIOT Act, and applicable federal and state banking regulations.
• Enforce our Terms of Service and other agreements.
• Analyze usage patterns to improve customer experience.`,
  },
  {
    heading: "4. Information Sharing and Disclosure",
    body: `We do not sell your personal information. We may share your information with:
• Service providers: third-party vendors who assist us in operating our platform, processing payments, conducting fraud detection, or providing customer support, subject to confidentiality agreements.
• Affiliates: entities under common ownership or control with FinextHub, for purposes consistent with this policy.
• Regulators and law enforcement: government agencies, regulators, or law enforcement when required by law, court order, or to protect the rights, property, or safety of FinextHub, our customers, or the public.
• Business transfers: in connection with any merger, acquisition, reorganization, or sale of assets, your information may be transferred as a business asset.
• With your consent: for any other purpose disclosed at the time of collection, with your explicit consent.`,
  },
  {
    heading: "5. Cookies and Tracking Technologies",
    body: `We use cookies, web beacons, and similar tracking technologies to operate and improve our Services. For detailed information about our use of cookies and how to manage your preferences, please refer to our Cookie Policy. Essential session cookies are required for the security and functionality of our online banking platform and cannot be disabled.`,
  },
  {
    heading: "6. Data Security",
    body: `We implement industry-standard technical, administrative, and physical safeguards to protect your personal information, including 256-bit SSL/TLS encryption for data in transit and AES-256 encryption for sensitive data at rest. We conduct regular security assessments and penetration tests. While we take these precautions seriously, no method of transmission over the internet or electronic storage is completely secure, and we cannot guarantee absolute security.`,
  },
  {
    heading: "7. Data Retention",
    body: `We retain your personal information for as long as your account is active or as needed to provide Services to you. We are required by law to retain certain financial records for minimum periods (generally five to seven years under federal banking regulations). When retention is no longer required, we securely delete or anonymize your information.`,
  },
  {
    heading: "8. Your Rights and Choices",
    body: `Depending on your state of residence, you may have certain rights regarding your personal information, including:
• Access: request a copy of the personal information we hold about you.
• Correction: request correction of inaccurate or incomplete information.
• Deletion: request deletion of your personal information, subject to our legal obligations to retain certain records.
• Opt-out: opt out of marketing communications at any time by contacting us or using the unsubscribe link in any marketing email.
• California residents: additional rights under the California Consumer Privacy Act (CCPA) may apply.
To exercise any of these rights, contact us at privacy@finexthub.com.`,
  },
  {
    heading: "9. Children's Privacy",
    body: `Our Services are not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have inadvertently collected information from a minor, please contact us immediately at privacy@finexthub.com and we will take steps to delete it.`,
  },
  {
    heading: "10. Changes to This Policy",
    body: `We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on our website and, where required by law, by sending you a notice via email or through our platform. Your continued use of our Services after the effective date of any changes constitutes your acceptance of the updated policy.`,
  },
  {
    heading: "11. Contact Us",
    body: `If you have any questions, concerns, or requests regarding this Privacy Policy, please contact us at:\n\nFinextHub Bank of USA\nPrivacy Officer\n1201 N. Market Street, Suite 100\nWilmington, DE 19801\nEmail: privacy@finexthub.com\nPhone: 1-800-FINEXTHUB`,
  },
];

function LegalPage({ title, lastUpdated, sections }: {
  title: string;
  lastUpdated: string;
  sections: { heading: string; body: string }[];
}) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-gradient-to-r from-red-700 via-red-800 to-red-900 text-white shadow-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/dashboard" className="flex items-center gap-2.5 no-underline">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 L20 6 V12 C20 17 16 21 12 22 C8 21 4 17 4 12 V6 Z" fill="rgba(251,191,36,0.15)" />
                <path d="M8.5 12 h7 M8.5 14.5 h7 M12 9 v8" />
                <circle cx="12" cy="9" r="1.1" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">FINEXTHUB</div>
              <div className="text-[9px] uppercase tracking-[0.2em] opacity-70">Bank of USA</div>
            </div>
          </Link>
          <Link to="/profile" className="text-xs text-white/70 transition hover:text-white">← Back to Profile</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">
          Legal Document
        </div>
        <h1 className="mb-1 text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        <p className="mb-8 text-sm text-slate-500">Last updated: {lastUpdated} · FinextHub Bank of USA, Member FDIC</p>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-100">
            {sections.map((s) => (
              <section key={s.heading} className="px-6 py-6">
                <h2 className="mb-3 text-base font-bold text-slate-800">{s.heading}</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{s.body}</p>
              </section>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-slate-400">
          <Link to="/privacy" className="hover:text-red-700">Privacy Policy</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-red-700">Terms of Service</Link>
          <span>·</span>
          <Link to="/cookies" className="hover:text-red-700">Cookie Policy</Link>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          © 2026 FinextHub Bank of USA · Member FDIC · Equal Housing Lender
        </p>
      </main>
    </div>
  );
}
