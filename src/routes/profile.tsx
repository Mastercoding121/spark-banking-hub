import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BankShell } from "@/components/BankShell";
import { holderStore, useHolder } from "@/lib/store";
import { securityStore, useSecurity, requestBiometric } from "@/lib/security";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile & Security — Firestone Bank" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const holder = useHolder();
  const { pin, biometrics } = useSecurity();
  const [name, setName] = useState(holder);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const saveName = (e: React.FormEvent) => {
    e.preventDefault();
    holderStore.set(name.trim());
    setMsg("Profile updated.");
    setTimeout(() => setMsg(null), 2500);
  };

  const savePin = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (newPin.length < 4 || newPin.length > 6) return setErr("PIN must be 4–6 digits.");
    if (newPin !== confirmPin) return setErr("PINs don't match.");
    securityStore.setPin(newPin);
    setNewPin(""); setConfirmPin("");
    setMsg("Transaction PIN saved.");
    setTimeout(() => setMsg(null), 2500);
  };

  const toggleBio = async () => {
    if (!biometrics) {
      const ok = await requestBiometric();
      if (ok) { securityStore.setBiometrics(true); setMsg("Biometrics enabled."); }
      else setErr("Could not enable biometrics.");
    } else {
      securityStore.setBiometrics(false);
      setMsg("Biometrics disabled.");
    }
    setTimeout(() => { setMsg(null); setErr(null); }, 2500);
  };

  return (
    <BankShell>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <header className="rounded-xl border border-slate-200 bg-gradient-to-r from-red-700 to-red-900 p-5 text-white">
          <div className="text-[11px] uppercase tracking-widest opacity-80">Account Profile</div>
          <h1 className="text-2xl font-bold">{holder || "Guest"}</h1>
          <p className="text-xs opacity-80">Manage your identity and security settings.</p>
        </header>

        {msg && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</div>}
        {err && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Personal Information</h2>
          <form onSubmit={saveName} className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Account holder name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <div className="sm:col-span-2">
              <button className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">Save</button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold">Transaction PIN</h2>
          <p className="mb-3 text-xs text-slate-500">Required to authorize every transfer. {pin ? "✅ A PIN is currently set." : "⚠️ No PIN set."}</p>
          <form onSubmit={savePin} className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">New PIN (4–6 digits)</span>
              <input type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tracking-widest" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Confirm PIN</span>
              <input type="password" inputMode="numeric" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tracking-widest" />
            </label>
            <div className="sm:col-span-2 flex gap-2">
              <button className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">Save PIN</button>
              {pin && <button type="button" onClick={() => { securityStore.setPin(""); setMsg("PIN removed."); }} className="rounded-md border border-slate-300 px-4 py-2 text-sm">Remove PIN</button>}
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Biometric Authentication</h2>
              <p className="text-xs text-slate-500">Use Face ID / Touch ID (WebAuthn) to approve transactions.</p>
            </div>
            <button onClick={toggleBio} className={`rounded-full px-4 py-2 text-xs font-semibold ${biometrics ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>
              {biometrics ? "Enabled" : "Enable"}
            </button>
          </div>
        </section>
      </main>
    </BankShell>
  );
}
