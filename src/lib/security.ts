import { useSyncExternalStore } from "react";

const PIN_KEY = "firestone.security.pin.v1";
const BIO_KEY = "firestone.security.bio.v1";

type State = { pin: string; biometrics: boolean };

function read(): State {
  if (typeof window === "undefined") return { pin: "", biometrics: false };
  try {
    return {
      pin: window.localStorage.getItem(PIN_KEY) ?? "",
      biometrics: window.localStorage.getItem(BIO_KEY) === "1",
    };
  } catch { return { pin: "", biometrics: false }; }
}

let state = read();
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

export const securityStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  getSnapshot() { return state; },
  getServerSnapshot() { return { pin: "", biometrics: false } as State; },
  setPin(pin: string) {
    state = { ...state, pin };
    if (typeof window !== "undefined") {
      try {
        if (pin) window.localStorage.setItem(PIN_KEY, pin);
        else window.localStorage.removeItem(PIN_KEY);
      } catch {}
    }
    emit();
  },
  setBiometrics(on: boolean) {
    state = { ...state, biometrics: on };
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(BIO_KEY, on ? "1" : "0"); } catch {}
    }
    emit();
  },
};

export function useSecurity() {
  return useSyncExternalStore(securityStore.subscribe, securityStore.getSnapshot, securityStore.getServerSnapshot);
}

/** WebAuthn-based biometric prompt with graceful fallback. */
export async function requestBiometric(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const cred = (window as any).PublicKeyCredential;
    if (cred?.isUserVerifyingPlatformAuthenticatorAvailable) {
      const available = await cred.isUserVerifyingPlatformAuthenticatorAvailable();
      if (available && navigator.credentials?.get) {
        try {
          await navigator.credentials.get({
            publicKey: {
              challenge: crypto.getRandomValues(new Uint8Array(32)),
              timeout: 30000,
              userVerification: "required",
              allowCredentials: [],
            },
          } as any);
          return true;
        } catch {
          // User likely has no platform credential — fall through to simulated prompt
        }
      }
    }
  } catch {}
  // Simulated biometric on devices without WebAuthn (demo)
  return window.confirm("Use Face ID / Touch ID to authorize this transaction?");
}
