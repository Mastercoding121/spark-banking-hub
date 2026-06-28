import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { PublicLayout } from "@/components/PublicLayout";
import { EnhancedLoadingScreen } from "@/components/EnhancedLoadingScreen";
import { Smartphone, Globe, ShieldCheck, Zap, TrendingUp, MessageSquare, CreditCard, DollarSign, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FinextHub Bank of USA — Secure Online Banking" },
      { name: "description", content: "Welcome to FinextHub Bank of USA. Download our app, open an account, and manage your finances securely." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const hasStartedRedirect = useRef(false);

  useEffect(() => {
    if (isLoggedIn && !hasStartedRedirect.current) {
      hasStartedRedirect.current = true;
      setIsRedirecting(true);
      const timer = setTimeout(() => {
        navigate({ to: "/dashboard" });
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, navigate]);

  if (isRedirecting) {
    return <EnhancedLoadingScreen title="Redirecting to your dashboard…" subtitle="Please wait while we prepare your account." />;
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-4 py-10">
        {/* Hero Section */}
        <section className="mb-16 text-center lg:text-left">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Live banking · 24/7
              </div>
              <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Your money,
                <span className="block bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">secured.</span>
              </h1>
              <p className="mb-8 text-lg text-white/80 leading-relaxed">
                Real-time banking with zero monthly fees. Open your account in minutes — FDIC-insured up to $250,000.
              </p>
              
              {/* CTA Buttons */}
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
                <Link to="/signup" className="flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-amber-400 to-amber-600 px-8 py-3 text-base font-bold text-red-950 shadow-lg hover:from-amber-300 hover:to-amber-500 transition">
                  Open a Free Account
                </Link>
                <Link to="/login" className="flex items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-8 py-3 text-base font-bold text-white hover:bg-white/20 transition">
                  Sign In
                </Link>
              </div>

              {/* Features List */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { icon: <ShieldCheck className="h-5 w-5 text-emerald-400" />, text: "256-bit encryption" },
                  { icon: <Zap className="h-5 w-5 text-emerald-400" />, text: "Instant transfers" },
                  { icon: <TrendingUp className="h-5 w-5 text-emerald-400" />, text: "Live market data" },
                  { icon: <MessageSquare className="h-5 w-5 text-emerald-400" />, text: "24/7 support" },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-white/70">
                    {f.icon}
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Download App Section */}
            <div className="rounded-2xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
              <h3 className="mb-6 text-2xl font-bold text-white">Download FinextHub</h3>
              <div className="grid gap-4">
                <a href="#" className="group flex items-center gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20 transition">
                  <Smartphone className="h-10 w-10 text-amber-400" />
                  <div className="text-left">
                    <div className="text-xs text-white/60 uppercase">Mobile App</div>
                    <div className="font-semibold text-white">iOS & Android</div>
                  </div>
                  <div className="ml-auto text-amber-300 group-hover:text-amber-200 transition">
                    Download →
                  </div>
                </a>
                <a href="#" className="group flex items-center gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20 transition">
                  <Globe className="h-10 w-10 text-amber-400" />
                  <div className="text-left">
                    <div className="text-xs text-white/60 uppercase">Desktop App</div>
                    <div className="font-semibold text-white">Windows & macOS</div>
                  </div>
                  <div className="ml-auto text-amber-300 group-hover:text-amber-200 transition">
                    Download →
                  </div>
                </a>
                <Link to="/downloads" className="group flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 p-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition">
                  View all download options
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="mb-16">
          <h2 className="mb-10 text-center text-3xl font-bold text-white">Banking Made Simple</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: <CreditCard className="h-12 w-12 text-amber-400" />,
                title: "Free Checking Account",
                description: "No monthly fees, no minimum balance, and a debit card with cashback rewards.",
              },
              {
                icon: <DollarSign className="h-12 w-12 text-amber-400" />,
                title: "Instant Transfers",
                description: "Send and receive money instantly with no fees—24/7, every day of the year.",
              },
              {
                icon: <BarChart3 className="h-12 w-12 text-amber-400" />,
                title: "Smart Budgeting",
                description: "Track spending, set budgets, and get personalized insights to manage your money better.",
              },
            ].map((feature, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/10 p-8 text-center">
                <div className="mb-4 flex justify-center">{feature.icon}</div>
                <h3 className="mb-3 text-xl font-bold text-white">{feature.title}</h3>
                <p className="text-white/70">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
