import admin from "firebase-admin";

let adminDb: admin.firestore.Firestore | null = null;
let adminApp: admin.app.App | null = null;

export const getFirebaseAdmin = () => {
  if (adminApp) {
    return { app: adminApp, db: adminDb };
  }

  // Check if we have required environment variables
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("Firebase Admin environment variables not set. Using in-memory fallback.");
    return { app: null, db: null };
  }

  try {
    // Initialize Admin SDK
    adminApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });

    adminDb = admin.firestore();
    console.log("Firebase Admin SDK initialized successfully.");
    return { app: adminApp, db: adminDb };
  } catch (error) {
    console.error("Firebase Admin initialization failed:", error);
    return { app: null, db: null };
  }
};
