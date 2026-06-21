
import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query as firestoreQuery,
  where,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

// In-memory fallback
let inMemoryData: Record<string, Map<string, any>> = {};
const getDb = () => {
  if (!db) {
    console.warn("Firebase Firestore not initialized! Using in-memory db for demo.");
    return { inMemory: true, data: inMemoryData };
  }
  return db;
};

// Helper function to convert Firestore docs to objects
const docToObj = (docSnap: any) => {
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
};

// Query multiple docs
export async function query<T = any>(q: any): Promise<T[]> {
  const currentDb = getDb();
  if ("inMemory" in currentDb) {
    // In-memory querying is limited, but for demo it works
    return [];
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToObj) as T[];
}

// Query single doc
export async function queryOne<T = any>(q: any): Promise<T | null> {
  const currentDb = getDb();
  if ("inMemory" in currentDb) return null;
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return docToObj(snapshot.docs[0]) as T;
}

// Helper to get collection reference
export const getCollection = (name: string) => {
  const currentDb = getDb();
  if ("inMemory" in currentDb) {
    return { inMemory: true, name };
  }
  return collection(currentDb, name);
};

// Helper to get doc reference
export const getDocRef = (collName: string, docId: string) => {
  const currentDb = getDb();
  if ("inMemory" in currentDb) {
    return { inMemory: true, collName, docId };
  }
  return doc(currentDb, collName, docId);
};

export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  firestoreQuery,
  where,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  Timestamp,
};

