import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EnhancedLoadingScreen } from "@/components/EnhancedLoadingScreen";
import { BankShell } from "@/components/BankShell";

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
  const navigate = useNavigate();
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate({ to: "/" });
    } else {
      const timer = setTimeout(() => {
        setIsPageLoading(false);
      }, 2500); // 2.5 seconds
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, navigate]);

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

  if (isPageLoading) {
    return (
      <EnhancedLoadingScreen
        title="Preparing your downloads…"
        subtitle="Please wait while we load your account data."
      />
    );
  }

  if (loading) {
    return (
      <BankShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </BankShell>
    );
  }

  return (
    <BankShell>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Downloads</h1>
            <p className="text-sm text-slate-600">Get the latest version of FinextHub apps</p>
          </div>

          {release && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-amber-800">Latest Release</h2>
                  <p className="text-sm text-slate-600">Version {release.latest} · Released {release.releaseDate}</p>
                </div>
                <a
                  href={release.downloadUrl}
                  className="rounded-lg bg-gradient-to-r from-amber-400 to-amber-600 px-6 py-3 text-sm font-bold text-red-950 shadow-lg hover:from-amber-300 hover:to-amber-500"
                >
                  Download
                </a>
              </div>
              <div className="text-xs text-slate-500">
                This release includes bug fixes and performance improvements.
              </div>
            </div>
          )}
        </div>
      </main>
    </BankShell>
  );
}
