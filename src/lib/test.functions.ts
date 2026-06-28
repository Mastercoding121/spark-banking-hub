import { createServerFn } from "@tanstack/react-start";

export const testServerFunction = createServerFn({ method: "GET" }).handler(async () => {
  console.log("[testServerFunction] Invoked on server!");
  
  const envVars = {
    hasFirebaseApiKey: !!process.env.VITE_FIREBASE_API_KEY,
    hasFirebaseProjectId: !!process.env.VITE_FIREBASE_PROJECT_ID,
    hasResendKey: !!process.env.RESEND_API_KEY,
  };

  console.log("[testServerFunction] Environment check:", envVars);
  return {
    success: true,
    message: "Server function is working!",
    time: new Date().toISOString(),
    env: envVars,
  };
});
