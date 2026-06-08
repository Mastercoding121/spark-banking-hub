import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { BankShell } from "@/components/BankShell";
import { submitSupportMessage } from "@/lib/finance.functions";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "24/7 Customer Support — Firestone Bank of USA" },
      { name: "description", content: "Get help any time of day. Call, chat, or message our support team — available 24/7." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const send = useServerFn(submitSupportMessage);
  const mutation = useMutation({
    mutationFn: (vars: { name: string; email: string; topic: string; message: string }) => send({ data: vars }),
  });

  const [name, setName] = useState("John Doe");
  const [email, setEmail] = useState("john.doe@example.com");
  const [topic, setTopic] = useState("Account access");
  const [message, setMessage] = useState("");

  return (
    <BankShell>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold">24/7 Customer Support</h1>
          <p className="text-sm text-slate-600">We're here around the clock. Pick the fastest way to reach us.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <ContactTile icon="☎" label="Call us" value="1-800-FIRESTONE" sub="Toll-free, 24/7" />
          <ContactTile icon="✉" label="Email" value="support@firestonebank.us" sub="Replies in &lt; 2 hours" />
          <ContactTile icon="💬" label="Live chat" value="Start chat" sub="Avg wait: 38 seconds" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold">Send us a message</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate({ name, email, topic, message });
              }}
              className="grid gap-3 text-sm sm:grid-cols-2"
            >
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" required />
              </label>
              <label className="sm:col-span-2 block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Topic</span>
                <select value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
                  <option>Account access</option>
                  <option>Card lost or stolen</option>
                  <option>Transfer issue</option>
                  <option>Loan inquiry</option>
                  <option>Investment account</option>
                  <option>Fraud / dispute</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="sm:col-span-2 block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Message</span>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="How can we help?" required />
              </label>
              <button disabled={mutation.isPending} className="sm:col-span-2 rounded-md bg-gradient-to-r from-red-700 to-red-800 py-2.5 text-sm font-semibold text-white hover:from-red-800 hover:to-red-900 disabled:opacity-60">
                {mutation.isPending ? "Sending…" : "Open a Support Ticket"}
              </button>
              {mutation.data?.ok && (
                <div className="sm:col-span-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  ✓ {mutation.data.message}
                </div>
              )}
              {mutation.isError && (
                <div className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {(mutation.error as Error).message}
                </div>
              )}
            </form>
          </section>

          <aside className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold">Quick help</h3>
            <ul className="space-y-2 text-sm">
              <li className="rounded-md bg-slate-50 px-3 py-2">Report a lost or stolen card</li>
              <li className="rounded-md bg-slate-50 px-3 py-2">Dispute a transaction</li>
              <li className="rounded-md bg-slate-50 px-3 py-2">Reset online banking password</li>
              <li className="rounded-md bg-slate-50 px-3 py-2">Order checks</li>
              <li className="rounded-md bg-slate-50 px-3 py-2">Wire transfer instructions</li>
            </ul>
          </aside>
        </div>
      </main>
    </BankShell>
  );
}

function ContactTile({ icon, label, value, sub }: { icon: string; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-xl text-red-700">{icon}</div>
      <div className="mt-3 text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-slate-500" dangerouslySetInnerHTML={{ __html: sub }} />
    </div>
  );
}
