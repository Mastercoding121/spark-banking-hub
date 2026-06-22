import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { BankShell } from "@/components/BankShell";
import { holderStore, useHolder } from "@/lib/store";
import { authStore } from "@/lib/auth";
import { securityStore, useSecurity, requestBiometric } from "@/lib/security";
import { updateUserProfile } from "@/lib/user.functions";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile & Settings — FinextHub Bank" }] }),
  component: ProfilePage,
});

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, icon, onClose, children }: {
  title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-700">{icon}</div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Setting row ──────────────────────────────────────────────────────────────
function SettingRow({ icon, label, sublabel, onClick, badge, danger }: {
  icon: React.ReactNode; label: string; sublabel?: string;
  onClick: () => void; badge?: React.ReactNode; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left transition hover:bg-slate-50 ${danger ? "hover:bg-red-50" : ""}`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${danger ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-semibold ${danger ? "text-red-600" : "text-slate-900"}`}>{label}</div>
        {sublabel && <div className="text-xs text-slate-500">{sublabel}</div>}
      </div>
      <div className="flex items-center gap-2">
        {badge}
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </button>
  );
}

function StatusBadge({ on, onLabel = "Active", offLabel = "Not set" }: { on: boolean; onLabel?: string; offLabel?: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
      {on ? onLabel : offLabel}
    </span>
  );
}

type ModalType = "name" | "password" | "pin" | "biometrics" | "notifications" | null;

// ─── Main page ────────────────────────────────────────────────────────────────
function ProfilePage() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const holder = useHolder();

  useEffect(() => {
    if (!isLoggedIn) {
      navigate({ to: "/" });
    }
  }, [isLoggedIn, navigate]);
  const currentUser = authStore.current();
  const { pin, biometrics } = useSecurity();

  const [openModal, setOpenModal] = useState<ModalType>(null);
  const [globalMsg, setGlobalMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [release, setRelease] = useState<{ latest: string; downloadUrl: string; releaseDate: string } | null>(null);

  useEffect(() => {
    const fetchRelease = async () => {
      try {
        const res = await fetch("/releases.json");
        if (res.ok) {
          const data = await res.json();
          setRelease(data);
        }
      } catch (e) {
        console.error("Failed to fetch releases", e);
      }
    };
    fetchRelease();
  }, []);

  const close = () => setOpenModal(null);
  const flash = (type: "ok" | "err", text: string) => {
    setGlobalMsg({ type, text });
    setTimeout(() => setGlobalMsg(null), 3000);
  };

  const initials = (holder || currentUser?.email || "G").trim()[0].toUpperCase();
  const memberSince = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "—";

  return (
    <BankShell>
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">

        {/* ── Profile Hero Card ────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-700 via-red-800 to-red-950 p-6 text-white shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 0%, transparent 60%)" }}
          />
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 text-3xl font-bold ring-2 ring-white/20">
                {initials}
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 text-white shadow-md">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest opacity-60">Account Holder</div>
              <h1 className="truncate text-2xl font-bold">{holder || "Guest"}</h1>
              <div className="mt-0.5 text-sm opacity-75">{currentUser?.email ?? ""}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                  FinextHub Premium
                </span>
                <span className="text-[11px] opacity-50">Member since {memberSince}</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-3 divide-x divide-white/10 rounded-xl bg-white/10 py-3">
            {[
              { label: "FDIC Insured", value: "$250K" },
              { label: "Account Status", value: "Active" },
              { label: "Security Level", value: pin && biometrics ? "High" : pin ? "Medium" : "Low" },
            ].map(({ label, value }) => (
              <div key={label} className="px-3 text-center">
                <div className="text-base font-bold">{value}</div>
                <div className="text-[10px] uppercase tracking-wide opacity-60">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Toast / Flash ─────────────────────────────────────── */}
        {globalMsg && (
          <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm ${
            globalMsg.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}>
            {globalMsg.type === "ok"
              ? <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              : <svg className="h-4 w-4 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            }
            {globalMsg.text}
          </div>
        )}

        {/* ── Account Settings ──────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Account</h2>
          </div>
          <div className="divide-y divide-slate-100">
            <SettingRow
              icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>}
              label="Personal Information"
              sublabel={holder || "Set your display name"}
              onClick={() => setOpenModal("name")}
            />
            <SettingRow
              icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>}
              label="Change Password"
              sublabel="Last changed: account creation"
              onClick={() => setOpenModal("password")}
            />
          </div>
        </section>

        {/* ── Security Settings ─────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Security</h2>
          </div>
          <div className="divide-y divide-slate-100">
            <SettingRow
              icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="10" width="16" height="12" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /><circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" /></svg>}
              label="Transaction PIN"
              sublabel="Required to authorize every transfer"
              onClick={() => setOpenModal("pin")}
              badge={<StatusBadge on={!!pin} onLabel="Set" offLabel="Not set" />}
            />
            <SettingRow
              icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C8 2 4 6 4 10c0 5 5 10 8 12 3-2 8-7 8-12 0-4-4-8-8-8z" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              label="Biometric Authentication"
              sublabel="Face ID / Touch ID for transactions"
              onClick={() => setOpenModal("biometrics")}
              badge={<StatusBadge on={biometrics} onLabel="On" offLabel="Off" />}
            />
            <SettingRow
              icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>}
              label="Notifications"
              sublabel="Alerts and banking activity"
              onClick={() => setOpenModal("notifications")}
              badge={<StatusBadge on={true} onLabel="On" offLabel="Off" />}
            />
          </div>
        </section>

        {/* ── App Info ──────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">About</h2>
          </div>
          <div className="divide-y divide-slate-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">App Version</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">{release?.latest || "2.6.0"}</span>
                <button
                  onClick={() => navigate("/downloads")}
                  className="rounded-lg bg-gradient-to-r from-amber-400 to-amber-600 px-3 py-1.5 text-xs font-semibold text-red-950 shadow-sm hover:from-amber-300 hover:to-amber-500"
                >
                  Check for Updates
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Legal ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <div className="divide-y divide-slate-100">
            {([
              ["Privacy Policy", "/privacy"],
              ["Terms of Service", "/terms"],
              ["Cookie Policy", "/cookies"],
            ] as const).map(([label, to]) => (
              <Link
                key={to}
                to={to}
                className="flex w-full items-center justify-between py-3 text-sm text-slate-600 hover:text-red-700"
              >
                {label}
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>

        {/* ── FDIC Notice ───────────────────────────────────────── */}
        <div className="rounded-xl bg-slate-100 px-4 py-3 text-center text-xs text-slate-500">
          © 2026 FinextHub Bank of USA · Member <span className="font-semibold">FDIC</span> · Equal Housing Lender
        </div>
      </main>

      {/* ══ MODALS ══════════════════════════════════════════════ */}
      {openModal === "name" && (
        <NameModal holder={holder} onClose={close} onSuccess={(msg) => flash("ok", msg)} onError={(msg) => flash("err", msg)} />
      )}
      {openModal === "password" && (
        <PasswordModal onClose={close} onSuccess={(msg) => flash("ok", msg)} onError={(msg) => flash("err", msg)} />
      )}
      {openModal === "pin" && (
        <PinModal pin={pin} onClose={close} onSuccess={(msg) => flash("ok", msg)} onError={(msg) => flash("err", msg)} />
      )}
      {openModal === "biometrics" && (
        <BiometricsModal biometrics={biometrics} onClose={close} onSuccess={(msg) => flash("ok", msg)} onError={(msg) => flash("err", msg)} />
      )}
      {openModal === "notifications" && (
        <NotificationsModal onClose={close} />
      )}
    </BankShell>
  );
}

// ─── Name Modal ───────────────────────────────────────────────────────────────
function NameModal({ holder, onClose, onSuccess, onError }: {
  holder: string; onClose: () => void; onSuccess: (m: string) => void; onError: (m: string) => void;
}) {
  const [name, setName] = useState(holder);
  const updateFn = useServerFn(updateUserProfile);
  const mut = useMutation({
    mutationFn: () => updateFn({ data: { name } }),
    onSuccess: () => {
      holderStore.set(name.trim());
      onSuccess("Name updated successfully.");
      onClose();
    },
    onError: (e: any) => onError(e?.message ?? "Failed to update."),
  });

  return (
    <Modal title="Personal Information" onClose={onClose}
      icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Display Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
            placeholder="Your full name"
          />
          <p className="mt-1.5 text-xs text-slate-400">This name appears on your account and receipts.</p>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={!name.trim() || mut.isPending}
            className="flex-1 rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {mut.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Password Modal ───────────────────────────────────────────────────────────
function PasswordModal({ onClose, onSuccess, onError }: {
  onClose: () => void; onSuccess: (m: string) => void; onError: (m: string) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const updateFn = useServerFn(updateUserProfile);
  const mut = useMutation({
    mutationFn: () => updateFn({ data: { currentPassword: current, newPassword: next } }),
    onSuccess: () => { onSuccess("Password changed successfully."); onClose(); },
    onError: (e: any) => onError(e?.message ?? "Failed to change password."),
  });

  const strength = next.length === 0 ? 0 : next.length < 8 ? 1 : next.length < 12 ? 2 : /[A-Z]/.test(next) && /[0-9]/.test(next) ? 4 : 3;
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "bg-red-400", "bg-amber-400", "bg-emerald-400", "bg-emerald-600"][strength];

  const canSubmit = current && next.length >= 8 && next === confirm;

  return (
    <Modal title="Change Password" onClose={onClose}
      icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Current Password</label>
          <div className="relative">
            <input
              autoFocus
              type={showCurrent ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-10 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                {showCurrent ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
              </svg>
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">New Password</label>
          <div className="relative">
            <input
              type={showNext ? "text" : "password"}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-10 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
              placeholder="Min. 8 characters"
            />
            <button type="button" onClick={() => setShowNext(!showNext)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                {showNext ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
              </svg>
            </button>
          </div>
          {next.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${strength >= i ? strengthColor : "bg-slate-200"}`} />
                ))}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Strength: <span className="font-semibold">{strengthLabel}</span></div>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Confirm New Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-red-100 ${
              confirm && confirm !== next ? "border-red-300 bg-red-50 focus:border-red-400" : "border-slate-300 focus:border-red-400"
            }`}
          />
          {confirm && confirm !== next && <p className="mt-1 text-xs text-red-600">Passwords don't match.</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={!canSubmit || mut.isPending}
            className="flex-1 rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {mut.isPending ? "Updating…" : "Update Password"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── PIN Modal ────────────────────────────────────────────────────────────────
function PinModal({ pin, onClose, onSuccess, onError }: {
  pin: string; onClose: () => void; onSuccess: (m: string) => void; onError: (m: string) => void;
}) {
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");

  const save = () => {
    if (newPin.length < 4 || newPin.length > 6) return onError("PIN must be 4–6 digits.");
    if (newPin !== confirm) return onError("PINs don't match.");
    securityStore.setPin(newPin);
    onSuccess("Transaction PIN saved successfully.");
    onClose();
  };

  const remove = () => {
    securityStore.setPin("");
    onSuccess("PIN removed.");
    onClose();
  };

  return (
    <Modal title="Transaction PIN" onClose={onClose}
      icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="10" width="16" height="12" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /><circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" /></svg>}
    >
      <div className="space-y-4">
        {pin && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            A PIN is currently active on your account.
          </div>
        )}
        <p className="text-sm text-slate-500">Your PIN is required to authorize every transfer. Choose 4–6 digits.</p>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{pin ? "New PIN" : "Create PIN"} (4–6 digits)</label>
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-xl tracking-[0.5em] outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
            placeholder="• • • •"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Confirm PIN</label>
          <input
            type="password"
            inputMode="numeric"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className={`w-full rounded-xl border px-4 py-3 text-center text-xl tracking-[0.5em] outline-none transition focus:ring-2 focus:ring-red-100 ${
              confirm && confirm !== newPin ? "border-red-300 bg-red-50" : "border-slate-300 focus:border-red-400"
            }`}
            placeholder="• • • •"
          />
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button
              onClick={save}
              disabled={!newPin || !confirm}
              className="flex-1 rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
            >
              Save PIN
            </button>
          </div>
          {pin && (
            <button onClick={remove} className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
              Remove PIN
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Biometrics Modal ─────────────────────────────────────────────────────────
function BiometricsModal({ biometrics, onClose, onSuccess, onError }: {
  biometrics: boolean; onClose: () => void; onSuccess: (m: string) => void; onError: (m: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (biometrics) {
      securityStore.setBiometrics(false);
      onSuccess("Biometrics disabled.");
      onClose();
    } else {
      setLoading(true);
      try {
        const ok = await requestBiometric();
        if (ok) { securityStore.setBiometrics(true); onSuccess("Biometrics enabled."); onClose(); }
        else onError("Could not enable biometrics on this device.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Modal title="Biometric Authentication" onClose={onClose}
      icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C8 2 4 6 4 10c0 5 5 10 8 12 3-2 8-7 8-12 0-4-4-8-8-8z" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    >
      <div className="space-y-5">
        {/* Status indicator */}
        <div className={`flex items-center justify-between rounded-2xl p-5 ${biometrics ? "bg-emerald-50" : "bg-slate-50"}`}>
          <div>
            <div className={`text-sm font-bold ${biometrics ? "text-emerald-800" : "text-slate-700"}`}>
              {biometrics ? "Biometrics Active" : "Biometrics Disabled"}
            </div>
            <div className="text-xs text-slate-500">Face ID / Touch ID / WebAuthn</div>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${biometrics ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 3H5a2 2 0 00-2 2v4" /><path d="M15 3h4a2 2 0 012 2v4" /><path d="M9 21H5a2 2 0 01-2-2v-4" /><path d="M15 21h4a2 2 0 002-2v-4" />
              <path d="M12 8v4l3 3" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <p className="text-sm text-slate-600">
          {biometrics
            ? "Your device's biometric sensor is used to authorize transfers without entering your PIN each time."
            : "Enable biometrics to authorize transfers quickly and securely using Face ID or Touch ID."
          }
        </p>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            onClick={toggle}
            disabled={loading}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${biometrics ? "bg-slate-700 hover:bg-slate-800" : "bg-red-700 hover:bg-red-800"}`}
          >
            {loading ? "Requesting…" : biometrics ? "Disable" : "Enable Biometrics"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Notifications Modal ──────────────────────────────────────────────────────
function NotificationsModal({ onClose }: { onClose: () => void }) {
  const [prefs, setPrefs] = useState({
    transactions: true,
    security: true,
    promotions: false,
    statements: true,
  });

  const toggle = (k: keyof typeof prefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const ITEMS: { key: keyof typeof prefs; label: string; sub: string }[] = [
    { key: "transactions", label: "Transaction Alerts", sub: "Notify me of every transfer and payment" },
    { key: "security", label: "Security Alerts", sub: "Login attempts, PIN changes, and anomalies" },
    { key: "statements", label: "Monthly Statements", sub: "Receive monthly account summary" },
    { key: "promotions", label: "Promotions & Offers", sub: "New products, rates, and special offers" },
  ];

  return (
    <Modal title="Notifications" onClose={onClose}
      icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>}
    >
      <div className="space-y-4">
        <div className="divide-y divide-slate-100">
          {ITEMS.map(({ key, label, sub }) => (
            <div key={key} className="flex items-center justify-between py-3">
              <div className="mr-4">
                <div className="text-sm font-medium text-slate-900">{label}</div>
                <div className="text-xs text-slate-500">{sub}</div>
              </div>
              <button
                onClick={() => toggle(key)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${prefs[key] ? "bg-red-600" : "bg-slate-200"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${prefs[key] ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="w-full rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-800">
          Save Preferences
        </button>
      </div>
    </Modal>
  );
}
