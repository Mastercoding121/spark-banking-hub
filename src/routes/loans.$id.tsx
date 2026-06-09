import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { BankShell } from "@/components/BankShell";
import {
  getLoanStatus,
  uploadLoanDocument,
  addUnderwritingNote,
  type LoanStatus,
} from "@/lib/finance.functions";

export const Route = createFileRoute("/loans/$id")({
  head: () => ({
    meta: [
      { title: "Loan Application Details — Firestone Bank of USA" },
      { name: "description", content: "View your submitted loan application, upload supporting documents, and see underwriting notes." },
    ],
  }),
  component: LoanDetailPage,
});

const STEPS: LoanStatus[] = ["submitted", "underwriting", "approved"];
const STEP_LABEL: Record<LoanStatus, string> = {
  submitted: "Submitted",
  underwriting: "Underwriting",
  approved: "Approved",
};

function LoanDetailPage() {
  const { id } = useParams({ from: "/loans/$id" });
  const referenceId = id.toUpperCase();
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getLoanStatus);
  const uploadDoc = useServerFn(uploadLoanDocument);
  const addNote = useServerFn(addUnderwritingNote);

  const statusQuery = useQuery({
    queryKey: ["loan-status", referenceId],
    queryFn: () => fetchStatus({ data: { referenceId } }),
    refetchInterval: 5000,
  });

  const uploadMut = useMutation({
    mutationFn: (v: { name: string; sizeBytes: number; contentType: string }) =>
      uploadDoc({ data: { referenceId, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loan-status", referenceId] }),
  });
  const noteMut = useMutation({
    mutationFn: (text: string) => addNote({ data: { referenceId, text } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loan-status", referenceId] }),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [noteText, setNoteText] = useState("");

  const result = statusQuery.data;

  return (
    <BankShell>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/loans" className="text-xs text-red-700 hover:underline">← Back to Loans</Link>
            <h1 className="mt-1 text-2xl font-bold">Application {referenceId}</h1>
          </div>
        </div>

        {!result && <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading application…</div>}
        {result && "error" in result && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{result.error}</div>
        )}
        {result && "application" in result && (() => {
          const app = result.application;
          const idx = STEPS.indexOf(app.status);
          return (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
                    <div className="text-lg font-bold">{STEP_LABEL[app.status]}</div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{STEP_LABEL[app.status]}</span>
                </div>
                <div className="mt-5 flex items-center justify-between">
                  {STEPS.map((s, i) => {
                    const done = i <= idx;
                    return (
                      <div key={s} className="flex flex-1 flex-col items-center">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-red-700 text-white" : "bg-slate-100 text-slate-400"} ${i === idx ? "ring-4 ring-red-200" : ""}`}>
                          {done ? "✓" : i + 1}
                        </div>
                        <div className={`mt-2 text-[11px] font-medium ${done ? "text-slate-900" : "text-slate-400"}`}>{STEP_LABEL[s]}</div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-3 text-lg font-semibold">Submitted Form</h2>
                  <dl className="space-y-2 text-sm">
                    <Row k="Reference" v={app.referenceId} />
                    <Row k="Product" v={app.productId} />
                    <Row k="Full Name" v={app.fullName} />
                    <Row k="Email" v={app.email} />
                    <Row k="Amount" v={`$${app.amount.toLocaleString()}`} />
                    <Row k="Term" v={`${app.termMonths} months`} />
                    <Row k="Submitted" v={new Date(app.submittedAt).toLocaleString()} />
                  </dl>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Documents</h2>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800"
                    >
                      Upload
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        uploadMut.mutate({ name: f.name, sizeBytes: f.size, contentType: f.type });
                        e.target.value = "";
                      }}
                    />
                  </div>
                  {app.documents.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">No documents yet. Upload pay stubs, ID, bank statements.</div>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {app.documents.map((d) => (
                        <li key={d.id} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{d.name}</div>
                            <div className="text-[11px] text-slate-500">{Math.round(d.sizeBytes / 1024)} KB · {new Date(d.uploadedAt).toLocaleString()}</div>
                          </div>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Received</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {uploadMut.isError && <div className="mt-2 text-xs text-red-700">{(uploadMut.error as Error).message}</div>}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold">Underwriting Notes</h2>
                <div className="space-y-2">
                  {app.underwritingNotes.slice().reverse().map((n) => (
                    <div key={n.id} className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span className="font-semibold uppercase">{n.author}</span>
                        <span>{new Date(n.at).toLocaleString()}</span>
                      </div>
                      <div className="mt-1 text-slate-700">{n.text}</div>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={(e) => { e.preventDefault(); if (!noteText.trim()) return; noteMut.mutate(noteText, { onSuccess: () => setNoteText("") }); }}
                  className="mt-3 flex gap-2"
                >
                  <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note for underwriting…" className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  <button disabled={noteMut.isPending} className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{noteMut.isPending ? "Sending…" : "Add Note"}</button>
                </form>
              </section>
            </>
          );
        })()}
      </main>
    </BankShell>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
      <dd className="text-right text-slate-900">{v}</dd>
    </div>
  );
}
