import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// Helper to get env vars on both client and server
const getEnvVar = (name: string) => {
  if (typeof window !== "undefined") {
    return import.meta.env[name];
  }
  return process.env[name] || "";
};

// Firebase Config - Pull from environment variables
const firebaseConfig = {
  apiKey: getEnvVar("VITE_FIREBASE_API_KEY"),
  authDomain: getEnvVar("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnvVar("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnvVar("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnvVar("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnvVar("VITE_FIREBASE_APP_ID"),
  measurementId: getEnvVar("VITE_FIREBASE_MEASUREMENT_ID"),
};

let app: any = null;
let auth: any = null;
let db: any = null;
let analytics: any = null;

try {
  // Check if config has required fields before initializing
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      
      // Only initialize auth and analytics on client
      if (typeof window !== "undefined") {
        auth = getAuth(app);
        
        isSupported().then((supported) => {
          if (supported && app) {
            analytics = getAnalytics(app);
          }
        }).catch(() => { /* ignore analytics errors */ });
      }
    } else {
      app = getApps()[0];
      db = getFirestore(app);
      
      // Only initialize auth and analytics on client
      if (typeof window !== "undefined") {
        auth = getAuth(app);
      }
    }
  }
} catch (error) {
  console.warn("Firebase initialization failed", error);
}

export { app, auth, db, analytics };
