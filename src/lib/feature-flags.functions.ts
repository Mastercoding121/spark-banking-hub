
import { createServerFn } from "@tanstack/react-start";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

export const FLAG_KEYS = [
  "investments",
  "grants",
  "deposits",
  "withdrawals",
  "transfers",
  "loans",
] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

export type FlagState = {
  enabled: boolean;
  reason: string | null;
  details: string | null;
};

export type AllFlags = Record<FlagKey, FlagState>;

const DEFAULT_FLAG: FlagState = { enabled: true, reason: null, details: null };

export const getFeatureFlags = createServerFn({ method: "GET" }).handler(async (): Promise<AllFlags> => {
  try {
    const flagsSnap = await getDocs(collection(db, "featureFlags"));
    const flagsMap = new Map();
    flagsSnap.forEach((doc) => {
      flagsMap.set(doc.id, doc.data());
    });
    const result = {} as AllFlags;
    for (const key of FLAG_KEYS) {
      const data = flagsMap.get(key);
      result[key as FlagKey] = data
        ? {
            enabled: Boolean(data.enabled),
            reason: data.reason || null,
            details: data.details || null,
          }
        : { ...DEFAULT_FLAG };
    }
    return result;
  } catch {
    return Object.fromEntries(FLAG_KEYS.map((k) => [k, { ...DEFAULT_FLAG }])) as AllFlags;
  }
});

