
import { createServerFn } from "@tanstack/react-start";
import { Resend } from "resend";
import { db } from "./firebase";
import { getFirebaseAdmin } from "./firebase-admin";
import admin from "firebase-admin";

const OTP_TTL_MS = 10 * 60 * 1000;

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// In-memory storage for fallback mode (persists across calls in same process)
const inMemoryOtpCodes = new Map();
const inMemoryUsers = new Map();

// Helper to get appropriate database (Admin SDK on server, Client SDK on client, or fallback)
const getDb = () => {
  // First try Firebase Admin SDK (server-side)
  const { db: adminDb } = getFirebaseAdmin();
  if (adminDb) {
    return { type: "admin" as const, db: adminDb };
  }

  // Then try Firebase Client SDK (client-side)
  if (db) {
    return { type: "client" as const, db };
  }

  // Fall back to in-memory storage
  console.warn("Firebase not initialized! Using in-memory fallback.");
  return { 
    type: "in-memory" as const, 
    otpCodes: inMemoryOtpCodes,
    users: inMemoryUsers
  };
};

export const sendOtp = createServerFn({ method: "POST" })
  .validator((input: { email: string; name?: string }) => {
    if (!input.email?.trim()) throw new Error("Email required");
    return { email: input.email.trim().toLowerCase(), name: input.name || "" };
  })
  .handler(async ({ data }) => {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const currentDb = getDb();

    // Upsert OTP code
    if (currentDb.type === "in-memory") {
      currentDb.otpCodes.set(data.email, {
        email: data.email,
        code,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (currentDb.type === "admin") {
      // Admin SDK (server-side)
      const otpDocRef = currentDb.db.collection("otpCodes").doc(data.email);
      await otpDocRef.set({
        email: data.email,
        code,
        expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set, skipping email send in demo mode");
      console.log(`Demo mode: OTP code for ${data.email} is ${code}`);
      return { ok: true }; // Demo mode: don't fail if no Resend key
    }

    const resend = new Resend(apiKey);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Your FinextHub verification code</title>
</head>
<body style="margin:0;padding:0;background:#040a14;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#040a14;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0d1829 0%,#111827 100%);border-radius:20px;border:1px solid rgba(251,191,36,0.15);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#7c1d1d 0%,#1c1c2e 100%);padding:32px 40px;text-align:center;">
              <div style="display:inline-block;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.3);border-radius:50%;width:56px;height:56px;line-height:56px;text-align:center;margin-bottom:16px;font-size:24px;">🏦</div>
              <h1 style="margin:0;color:#fbbf24;font-size:22px;font-weight:700;letter-spacing:0.08em;">FINEXTHUB</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:0.3em;text-transform:uppercase;">Bank of USA</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:12px;letter-spacing:0.3em;text-transform:uppercase;">Identity Verification</p>
              <h2 style="margin:0 0 16px;color:#ffffff;font-size:24px;font-weight:700;">Your one-time code</h2>
              <p style="margin:0 0 28px;color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;">
                Hi${data.name ? ` ${data.name.split(" ")[0]}` : ""},<br/>
                Use the code below to verify your FinextHub account. It expires in <strong style="color:#fbbf24;">10 minutes</strong>.
              </p>
              <div style="background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.25);border-radius:14px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:0.3em;text-transform:uppercase;">Verification Code</p>
                <p style="margin:0;font-size:42px;font-weight:700;letter-spacing:0.35em;color:#fbbf24;font-family:'Courier New',monospace;">${code}</p>
              </div>
              <p style="margin:0 0 6px;color:rgba(255,255,255,0.4);font-size:13px;line-height:1.6;">
                If you didn't create a FinextHub account, you can safely ignore this email.
              </p>
              <p style="margin:0;color:rgba(255,255,255,0.4);font-size:13px;line-height:1.6;">
                Never share this code with anyone — FinextHub staff will never ask for it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid rgba(255,255,255,0.07);padding:20px 40px;text-align:center;">
              <p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;">
                © 2026 FinextHub Bank of USA · Member FDIC · Equal Housing Lender<br/>
                <span style="color:rgba(255,255,255,0.15);">support@finexthub.com</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const { error } = await resend.emails.send({
      from: "FinextHub <noreply@finexthub.com>",
      to: [data.email],
      subject: `${code} is your FinextHub verification code`,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      // Don't fail in demo mode
      console.log(`Demo mode: OTP code for ${data.email} is ${code}`);
      return { ok: true };
    }

    return { ok: true };
  });

export const verifyOtp = createServerFn({ method: "POST" })
  .validator((input: { email: string; code: string }) => {
    if (!input.email?.trim()) throw new Error("Email required");
    if (!input.code?.trim()) throw new Error("Code required");
    return { email: input.email.trim().toLowerCase(), code: input.code.trim() };
  })
  .handler(async ({ data }) => {
    const currentDb = getDb();
    let otpData: any = null;

    if (currentDb.type === "in-memory") {
      otpData = currentDb.otpCodes.get(data.email);
      if (!otpData) throw new Error("No code found. Please request a new one.");
    } else if (currentDb.type === "admin") {
      // Admin SDK (server-side)
      const otpDocRef = currentDb.db.collection("otpCodes").doc(data.email);
      const otpDoc = await otpDocRef.get();
      if (!otpDoc.exists) throw new Error("No code found. Please request a new one.");
      otpData = otpDoc.data();
    }

    // Check if code is expired
    const expiresAtDate = otpData?.expiresAt?.toDate ? otpData.expiresAt.toDate() : new Date(otpData?.expiresAt);
    if (expiresAtDate < new Date()) {
      // Delete expired code
      if (currentDb.type === "in-memory") {
        currentDb.otpCodes.delete(data.email);
      } else if (currentDb.type === "admin") {
        await currentDb.db.collection("otpCodes").doc(data.email).delete();
      }
      throw new Error("Code expired. Please request a new one.");
    }

    // Check if code is correct
    if (data.code !== otpData?.code) throw new Error("Incorrect code. Please try again.");

    // Code is valid: delete it and mark user as verified
    if (currentDb.type === "in-memory") {
      currentDb.otpCodes.delete(data.email);
      // Mark user as verified in in-memory db
      for (let [id, user] of currentDb.users) {
        if (user.email === data.email) {
          currentDb.users.set(id, { ...user, verified: true, updatedAt: new Date() });
        }
      }
    } else if (currentDb.type === "admin") {
      // Delete OTP doc
      await currentDb.db.collection("otpCodes").doc(data.email).delete();
      // Mark user as verified
      const userQuery = currentDb.db.collection("users").where("email", "==", data.email);
      const userSnap = await userQuery.get();
      if (!userSnap.empty) {
        await userSnap.docs[0].ref.update({
          verified: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    return { ok: true };
  });
