
import { createServerFn } from "@tanstack/react-start";
import { Resend } from "resend";
import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

const OTP_TTL_MS = 10 * 60 * 1000;

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const sendOtp = createServerFn({ method: "POST" })
  .validator((input: { email: string; name?: string }) => {
    if (!input.email?.trim()) throw new Error("Email required");
    return { email: input.email.trim().toLowerCase(), name: input.name || "" };
  })
  .handler(async ({ data }) => {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    // Upsert OTP code in Firestore
    const otpDocRef = doc(db, "otpCodes", data.email);
    await setDoc(otpDocRef, {
      email: data.email,
      code,
      expiresAt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("Email service not configured.");

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
              <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">Identity Verification</p>
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
      from: "FinextHub Bank <noreply@finexthub.com>",
      to: [data.email],
      subject: `${code} is your FinextHub verification code`,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      throw new Error("Failed to send verification email. Please try again.");
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
    const otpDocRef = doc(db, "otpCodes", data.email);
    const otpDoc = await getDoc(otpDocRef);
    if (!otpDoc.exists()) throw new Error("No code found. Please request a new one.");
    const otpData = otpDoc.data();
    if (new Date(otpData.expiresAt.toDate ? otpData.expiresAt.toDate() : otpData.expiresAt) < new Date()) {
      await deleteDoc(otpDocRef);
      throw new Error("Code expired. Please request a new one.");
    }
    if (data.code !== otpData.code) throw new Error("Incorrect code. Please try again.");
    await deleteDoc(otpDocRef);
    // Mark user as verified
    const userQuery = query(collection(db, "users"), where("email", "==", data.email));
    const userSnap = await getDocs(userQuery);
    if (!userSnap.empty) {
      await updateDoc(userSnap.docs[0].ref, {
        verified: true,
        updatedAt: serverTimestamp(),
      });
    }
    return { ok: true };
  });

