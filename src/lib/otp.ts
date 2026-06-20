const VERIFIED_KEY = "finexthub.verified.v1";

function readVerified(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(VERIFIED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch { return new Set(); }
}

function writeVerified(set: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VERIFIED_KEY, JSON.stringify([...set]));
}

export function isEmailVerified(email: string): boolean {
  return readVerified().has(email.trim().toLowerCase());
}

export function markEmailVerified(email: string) {
  const set = readVerified();
  set.add(email.trim().toLowerCase());
  writeVerified(set);
}

export function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
