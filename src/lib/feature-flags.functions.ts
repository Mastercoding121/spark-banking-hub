
import { createServerFn } from "@tanstack/react-start";

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
  return Object.fromEntries(FLAG_KEYS.map((k) => [k, { ...DEFAULT_FLAG }])) as AllFlags;
});
