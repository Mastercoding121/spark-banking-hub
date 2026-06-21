import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export const Route = createFileRoute("/downloads")({
  head: () => ({
    meta: [{ title: "Downloads — FinextHub Bank of USA" }],
  }),
  component: DownloadsPage,
});

interface Release {
  latest: string;
  downloadUrl: string;
  releaseDate: string;
}

function DownloadsPage() {
  const { isLoggedIn } = useAuth();
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRelease() {
      try {
        const res = await fetch("/releases.json");
        if (res.ok) {
          const data = await res.json();
          setRelease(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchRelease();
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-3xl">🔒</div>
        <h1 className="text-xl font-bold">Authentication Required</h1>
        <p className="text-sm text-white/50">Please sign in to download releases.</p>
        <Link to="/" className="mt-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300">
          Go to Sign In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-white">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-white/60">Loading releases...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
        <Link to="/dashboard" className="flex items-center gap-3">
          <BrandLogo height="h-10" className="text-white/60" />
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-tight">FINEXTHUB</div>
            <div className="text-[10px] uppercase tracking-[0.3em] opacity-80">Bank of USA</div>
          </div>
        </Link>
        <nav className="flex items-center gap-6">
          <Link to="/dashboard" className="text-sm text-white/80 hover:text-amber-300">Dashboard</Link>
          <Link to="/profile" className="text-sm text-white/80 hover:text-amber-300">Profile</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Downloads</h1>
            <p className="text-sm text-white/60">Get the latest version of FinextHub apps</p>
          </div>

          {release && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-amber-300">Latest Release</h2>
                  <p className="text-sm text-white/60">Version {release.latest} · Released {release.releaseDate}</p>
                </div>
                <a
                  href={release.downloadUrl}
                  className="rounded-lg bg-gradient-to-r from-amber-400 to-amber-600 px-6 py-3 text-sm font-bold text-red-950 shadow-lg hover:from-amber-300 hover:to-amber-500"
                >
                  Download
                </a>
              </div>
              <div className="text-xs text-white/40">
                This release includes bug fixes and performance improvements.
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
