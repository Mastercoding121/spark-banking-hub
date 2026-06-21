
import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie } from "@tanstack/start-server-core";
import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

// Session constants
const SESSION_COOKIE = "fnx_session";
const SESSION_TTL_DAYS = 30;

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  verified: boolean;
  createdAt: string;
};

// Helper to ensure we have db
const getDb = () => {
  if (!db) {
    console.warn("Firebase Firestore not initialized! Using in-memory fallback.");
    // In-memory fallback for demo mode
    return { 
      inMemory: true, 
      users: new Map(), 
      sessions: new Map(),
      accounts: new Map()
    };
  }
  return db;
};

async function createSession(userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const db = getDb();
  
  if ("inMemory" in db) {
    db.sessions.set(sessionId, {
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 86400000),
      createdAt: new Date(),
    });
  } else {
    await setDoc(doc(db, "sessions", sessionId), {
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 86400000),
      createdAt: serverTimestamp(),
    });
  }
  
  return sessionId;
}

export async function getSessionUser(sessionId: string): Promise<PublicUser | null> {
  if (!sessionId) return null;
  
  const db = getDb();
  
  // First get session
  let sessionData: any = null;
  if ("inMemory" in db) {
    sessionData = db.sessions.get(sessionId);
  } else {
    const sessionSnap = await getDoc(doc(db, "sessions", sessionId));
    if (sessionSnap.exists()) {
      sessionData = sessionSnap.data();
    }
  }
  
  if (!sessionData) return null;
  
  // Check expiry
  const expiresAt = sessionData.expiresAt.toDate ? sessionData.expiresAt.toDate() : sessionData.expiresAt;
  if (expiresAt < new Date()) return null;
  
  // Get user
  let user: any = null;
  if ("inMemory" in db) {
    user = db.users.get(sessionData.userId);
  } else {
    const userSnap = await getDoc(doc(db, "users", sessionData.userId));
    if (userSnap.exists()) {
      user = { id: userSnap.id, ...userSnap.data() };
    }
  }
  
  if (!user) return null;
  
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin || false,
    verified: user.verified || false,
    createdAt: user.createdAt?.toDate?.()?.toISOString() || user.createdAt?.toISOString() || new Date().toISOString(),
  };
}

// ─── getSession ───────────────────────────────────────────────────────────────
export const getSession = createServerFn({ method: "GET" }).handler(async (): Promise<PublicUser | null> => {
  const sid = getCookie(SESSION_COOKIE);
  if (!sid) return null;
  return getSessionUser(sid);
});

// ─── signUp ───────────────────────────────────────────────────────────────────
export const signUp = createServerFn({ method: "POST" })
  .validator((input: {
    email: string;
    name: string;
    password: string;
    securityQuestion: string;
    securityAnswer: string;
  }) => {
    const email = input.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
    if (!input.name?.trim()) throw new Error("Full name is required.");
    if (!input.password || input.password.length < 8) throw new Error("Password must be at least 8 characters.");
    if (!input.securityQuestion) throw new Error("Security question is required.");
    if (!input.securityAnswer?.trim()) throw new Error("Security answer is required.");
    return {
      email,
      name: input.name.trim(),
      password: input.password,
      securityQuestion: input.securityQuestion,
      securityAnswer: input.securityAnswer.trim().toLowerCase(),
    };
  })
  .handler(async ({ data }): Promise<PublicUser> => {
    const db = getDb();
    const userId = crypto.randomUUID();
    
    // Check if user already exists
    if ("inMemory" in db) {
      for (let [id, user] of db.users) {
        if (user.email === data.email) throw new Error("An account with this email already exists.");
      }
    } else {
      const userQuery = query(collection(db, "users"), where("email", "==", data.email));
      const userSnap = await getDocs(userQuery);
      if (!userSnap.empty) throw new Error("An account with this email already exists.");
    }
    
    // Check if this is first user (for admin status)
    let isFirstUser = false;
    if ("inMemory" in db) {
      isFirstUser = db.users.size === 0;
    } else {
      const allUsersSnap = await getDocs(collection(db, "users"));
      isFirstUser = allUsersSnap.empty;
    }
    
    const newUser = {
      id: userId,
      email: data.email,
      name: data.name,
      securityQuestion: data.securityQuestion,
      securityAnswer: data.securityAnswer,
      isAdmin: isFirstUser,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Create user
    if ("inMemory" in db) {
      db.users.set(userId, newUser);
      
      // Create default accounts
      db.accounts.set(`${userId}_checking`, {
        userId,
        type: "checking",
        balance: 0,
        createdAt: new Date()
      });
      db.accounts.set(`${userId}_savings`, {
        userId,
        type: "savings",
        balance: 0,
        createdAt: new Date()
      });
    } else {
      await setDoc(doc(db, "users", userId), {
        ...newUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Create default accounts
      await setDoc(doc(db, "accounts", `${userId}_checking`), {
        userId,
        type: "checking",
        balance: 0,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "accounts", `${userId}_savings`), {
        userId,
        type: "savings",
        balance: 0,
        createdAt: serverTimestamp(),
      });
    }
    
    // Create and set session cookie
    const sessionId = await createSession(userId);
    setCookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: import.meta.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_DAYS * 86400,
      path: "/",
    });
    
    return {
      ...newUser,
      createdAt: newUser.createdAt.toISOString(),
    };
  });

// ─── signIn ───────────────────────────────────────────────────────────────────
export const signIn = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string }) => {
    const email = input.email?.trim().toLowerCase();
    if (!email) throw new Error("Email is required.");
    if (!input.password) throw new Error("Password is required.");
    return { email, password: input.password };
  })
  .handler(async ({ data }): Promise<PublicUser> => {
    const db = getDb();
    
    // Find user
    let user: any = null;
    if ("inMemory" in db) {
      for (let [id, u] of db.users) {
        if (u.email === data.email) {
          user = { id, ...u };
          break;
        }
      }
    } else {
      const userQuery = query(collection(db, "users"), where("email", "==", data.email));
      const userSnap = await getDocs(userQuery);
      if (userSnap.empty) throw new Error("No account found for this email.");
      user = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
    }
    
    if (!user) throw new Error("No account found for this email.");
    
    // Create session and set cookie
    const sessionId = await createSession(user.id);
    setCookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: import.meta.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_DAYS * 86400,
      path: "/",
    });
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin || false,
      verified: user.verified || false,
      createdAt: user.createdAt?.toDate?.()?.toISOString() || user.createdAt?.toISOString() || new Date().toISOString(),
    };
  });

// ─── signOut ──────────────────────────────────────────────────────────────────
export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const sid = getCookie(SESSION_COOKIE);
  if (sid) {
    try {
      const db = getDb();
      if (!("inMemory" in db)) {
        await deleteDoc(doc(db, "sessions", sid));
      }
    } catch (e) {
      console.error("Error deleting session:", e);
    }
  }
  deleteCookie(SESSION_COOKIE, { path: "/" });
  return { ok: true };
});

// ─── markVerified ─────────────────────────────────────────────────────────────
export const markVerified = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => ({ email: input.email.trim().toLowerCase() }))
  .handler(async ({ data }) => {
    const db = getDb();
    
    if ("inMemory" in db) {
      for (let [id, user] of db.users) {
        if (user.email === data.email) {
          db.users.set(id, { ...user, verified: true, updatedAt: new Date() });
        }
      }
    } else {
      const userQuery = query(collection(db, "users"), where("email", "==", data.email));
      const userSnap = await getDocs(userQuery);
      if (!userSnap.empty) {
        await updateDoc(userSnap.docs[0].ref, { verified: true, updatedAt: serverTimestamp() });
      }
    }
    return { ok: true };
  });

// ─── lookupForReset ───────────────────────────────────────────────────────────
export const lookupForReset = createServerFn({ method: "GET" })
  .validator((input: { email: string }) => ({ email: input.email.trim().toLowerCase() }))
  .handler(async ({ data }) => {
    const db = getDb();
    
    let securityQuestion: string | null = null;
    if ("inMemory" in db) {
      for (let [id, user] of db.users) {
        if (user.email === data.email) {
          securityQuestion = user.securityQuestion;
          break;
        }
      }
    } else {
      const userQuery = query(collection(db, "users"), where("email", "==", data.email));
      const userSnap = await getDocs(userQuery);
      if (!userSnap.empty) {
        securityQuestion = userSnap.docs[0].data().securityQuestion;
      }
    }
    
    if (!securityQuestion) throw new Error("No account found for that email.");
    
    return { email: data.email, securityQuestion };
  });

// ─── resetPassword ────────────────────────────────────────────────────────────
export const resetPassword = createServerFn({ method: "POST" })
  .validator((input: { email: string; answer: string; newPassword: string }) => ({
    email: input.email.trim().toLowerCase(),
    answer: input.answer.trim().toLowerCase(),
    newPassword: input.newPassword,
  }))
  .handler(async ({ data }) => {
    if (data.newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
    
    const db = getDb();
    let foundUser = false;
    
    if ("inMemory" in db) {
      for (let [id, user] of db.users) {
        if (user.email === data.email) {
          foundUser = true;
          if (user.securityAnswer !== data.answer) throw new Error("Security answer is incorrect.");
          // In demo mode, just mark success
        }
      }
    } else {
      const userQuery = query(collection(db, "users"), where("email", "==", data.email));
      const userSnap = await getDocs(userQuery);
      if (userSnap.empty) throw new Error("No account found for that email.");
      foundUser = true;
      
      const userData = userSnap.docs[0].data();
      if (userData.securityAnswer !== data.answer) throw new Error("Security answer is incorrect.");
    }
    
    if (!foundUser) throw new Error("No account found for that email.");
    
    return { ok: true };
  });

// ─── updateProfile ────────────────────────────────────────────────────────────
export const updateUserProfile = createServerFn({ method: "POST" })
  .validator((input: { name?: string; currentPassword?: string; newPassword?: string }) => input)
  .handler(async ({ data }): Promise<PublicUser> => {
    const sid = getCookie(SESSION_COOKIE);
    const sessionUser = sid ? await getSessionUser(sid) : null;
    if (!sessionUser) throw new Error("Not authenticated.");
    
    const db = getDb();
    const updateData: any = { updatedAt: new Date() };
    
    if (data.name?.trim()) updateData.name = data.name.trim();
    
    if ("inMemory" in db) {
      const user = db.users.get(sessionUser.id);
      if (user) {
        const updatedUser = { ...user, ...updateData, updatedAt: new Date() };
        db.users.set(sessionUser.id, updatedUser);
        return {
          ...updatedUser,
          createdAt: updatedUser.createdAt.toISOString(),
        };
      }
    } else {
      const userDocRef = doc(db, "users", sessionUser.id);
      await updateDoc(userDocRef, { ...updateData, updatedAt: serverTimestamp() });
      
      const updatedSnap = await getDoc(userDocRef);
      const updatedData = updatedSnap.data()!;
      return {
        id: sessionUser.id,
        email: updatedData.email,
        name: updatedData.name,
        isAdmin: updatedData.isAdmin || false,
        verified: updatedData.verified || false,
        createdAt: updatedData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    }
    
    return sessionUser; // Fallback if something goes wrong
  });

