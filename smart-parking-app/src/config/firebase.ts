/**
 * Firebase configuration for the Smart Parking app.
 * Connects to the same Firebase Realtime DB used by the Python backend.
 * Includes read AND write capabilities for real-time booking sync.
 */

import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, set, push, update, remove, get, DataSnapshot } from 'firebase/database';

const firebaseConfig = {
  // The backend uses the Realtime DB REST API directly.
  // For the JS SDK we need a minimal config with just the database URL.
  apiKey: 'AIzaSyDummy', // Not strictly needed for RTDB reads with open rules
  projectId: 'smartparking-87cee',
  databaseURL: 'https://smartparking-87cee-default-rtdb.asia-southeast1.firebasedatabase.app',
};

// Initialize Firebase (only once)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const database = getDatabase(app);

export { database, ref, onValue, set, push, update, remove, get };
export type { DataSnapshot };
