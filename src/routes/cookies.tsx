import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [{ title: "Cookie Policy — FinextHub Bank of USA" }],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return <LegalPage title="Cookie Policy" lastUpdated="June 1, 2026" sections={COOKIE_SECTIONS} />;
}

const COOKIE_SECTIONS = [
  {
    heading: "1. What Are Cookies?",
    body: `Cookies are small text files placed on your device (computer, smartphone, or tablet) by a website when you visit it. They are widely used to make websites work more efficiently, remember your preferences, and provide analytical data to site owners. Cookies cannot access other files on your device or install software.`,
  },
  {
    heading: "2. How FinextHub Uses Cookies",
    body: `FinextHub Bank of USA uses cookies and similar tracking technologies (including web beacons, pixel tags, and local storage) to:
• Maintain your authenticated session securely across page loads.
• Remember your preferences and settings.
• Detect and prevent fraudulent activity and unauthorized access.
• Analyze how you interact with our Services to improve them.
• Ensure our platform performs correctly across different browsers and devices.
• Comply with regulatory requirements related to session integrity and audit logging.`,
  },
  {
    heading: "3. Types of Cookies We Use",
    body: `Strictly Necessary Cookies
These cookies are essential for you to use our Services. They enable core functions such as secure login, session management, and fraud prevention. These cookies cannot be disabled. Without them, the Services cannot function.
Examples: session authentication token (fnx_session), CSRF protection token.

Functional Cookies
These cookies allow us to remember choices you make (such as language preferences or your last visited page) and provide enhanced, more personal features. They are not used to track your activity on other websites.

Analytics Cookies
We use anonymized analytics cookies to understand how visitors use our platform. This data helps us improve performance, identify errors, and enhance user experience. The data collected is aggregated and does not personally identify you.

Security Cookies
These cookies help us detect and prevent security threats such as unauthorized login attempts, session hijacking, and bot activity. They are required for the secure operation of our banking platform.`,
  },
  {
    heading: "4. Third-Party Cookies",
    body: `We may allow certain third-party service providers to place cookies on your device as part of delivering our Services. These providers include analytics services, fraud detection systems, and performance monitoring tools. Third-party cookies are subject to the respective privacy policies of those providers. We do not allow third-party advertising cookies on our banking platform.`,
  },
  {
    heading: "5. Session vs. Persistent Cookies",
    body: `Session Cookies: These cookies exist only during your browser session and are deleted automatically when you close your browser. We use session cookies to maintain your secure login session.

Persistent Cookies: These cookies remain on your device for a set period or until you delete them. We use persistent cookies to remember your preferences and to support security and fraud detection between sessions. Persistent cookies set by FinextHub expire no later than 12 months from the date they are set.`,
  },
  {
    heading: "6. Managing and Disabling Cookies",
    body: `You can control cookies through your browser settings. Most browsers allow you to:
• View cookies currently stored on your device.
• Accept or decline cookies from specific websites.
• Delete all cookies or cookies from specific sites.
• Set your browser to notify you when a cookie is being set.

Please note that disabling cookies may significantly impair the functionality of our Services. Strictly necessary cookies (such as your authentication session) cannot be disabled if you wish to use our online banking platform.

Browser-specific instructions for managing cookies:
• Chrome: Settings → Privacy and security → Cookies and other site data
• Firefox: Settings → Privacy & Security → Cookies and Site Data
• Safari: Preferences → Privacy → Manage Website Data
• Edge: Settings → Cookies and site permissions`,
  },
  {
    heading: "7. Do Not Track",
    body: `Some browsers include a "Do Not Track" (DNT) feature that signals websites you visit that you do not want to have your online activity tracked. Our platform is designed to respect DNT signals where technically feasible and legally required. However, because no universal standard for responding to DNT signals currently exists, our responses to DNT signals may vary.`,
  },
  {
    heading: "8. Changes to This Cookie Policy",
    body: `We may update this Cookie Policy from time to time to reflect changes in technology, law, or our business practices. When we do, we will update the "Last updated" date at the top of this page. Material changes will be notified via email or a prominent notice on our platform. We encourage you to review this policy periodically.`,
  },
  {
    heading: "9. Contact Us",
    body: `If you have any questions about our use of cookies, please contact:\n\nFinextHub Bank of USA\nPrivacy Officer\n1201 N. Market Street, Suite 100\nWilmington, DE 19801\nEmail: privacy@finexthub.com\nPhone: 1-800-FINEXTHUB`,
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
