import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// Firebase Config - Pull from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app: any = null;
let auth: any = null;
let db: any = null;
let analytics: any = null;

try {
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
} catch (error) {
  console.warn("Firebase initialization failed", error);
}

export { app, auth, db, analytics };
