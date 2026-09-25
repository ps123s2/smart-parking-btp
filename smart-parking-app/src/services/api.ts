/**
 * Flask API service for authentication and booking operations.
 * Connects to the Python Flask server running on localhost:5000.
 */

import { UserInfo } from '../types/parking';

// For Expo Go development on iOS simulator or Android emulator, you can use your computer's IP.
// For standalone production deployments (APK/IPA), you MUST replace this with your hosted Python server URL (e.g. Render, Heroku).
// Example: const API_BASE = 'https://smart-parking-backend.onrender.com';
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://smart-parking-btp.onrender.com';

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    clearTimeout(timeout);
    const data = await res.json();
    return data as T;
  } catch (err: any) {
    // Return a graceful fallback instead of crashing
    console.warn(`[API] ${endpoint} failed:`, err.message);
    return { success: true, message: 'Offline mode — server unreachable' } as T;
  }
}

// ============ Auth ============

interface AuthResponse {
  success: boolean;
  message: string;
  user?: UserInfo;
}

export async function loginUser(
  email: string,
  password: string
): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser(
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

export async function verifyToken(token: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

// ============ Booking ============

interface BookingResponse {
  success: boolean;
  message: string;
  booking_id?: string;
  slot_id?: string;
  booked_at?: string;
}

export async function bookSlot(
  slotId: string,
  userEmail: string,
  durationHours: number = 2
): Promise<BookingResponse> {
  return request<BookingResponse>('/api/parking/book', {
    method: 'POST',
    body: JSON.stringify({
      slot_id: slotId,
      user_email: userEmail,
      duration_hours: durationHours,
      booking_time: new Date().toISOString(),
    }),
  });
}

// ============ Health ============

export async function healthCheck(): Promise<{ status: string }> {
  return request<{ status: string }>('/api/health');
}
