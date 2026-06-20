import { createServerFn } from "@tanstack/react-start";
import { query } from "./db";

export const FLAG_KEYS = ["investments", "grants", "deposits", "withdrawals", "transfers", "loans"] as const;
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
    const rows = await query<{ feature_key: string; enabled: boolean; reason: string | null; details: string | null }>(
      "SELECT feature_key, enabled, reason, details FROM feature_flags"
    );
    const result = {} as AllFlags;
    for (const key of FLAG_KEYS) {
      const row = rows.find((r) => r.feature_key === key);
      result[key] = row ? { enabled: row.enabled, reason: row.reason, details: row.details } : { ...DEFAULT_FLAG };
    }
    return result;
  } catch {
    return Object.fromEntries(FLAG_KEYS.map((k) => [k, { ...DEFAULT_FLAG }])) as AllFlags;
  }
});
