/**
 * Flask API service for authentication and booking operations.
 * Connects to the Python Flask server running on localhost:5000.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { UserInfo, AIAllocationResponse } from '../types/parking';

/**
 * Resolves the backend API base URL with full cross-platform environment awareness:
 * 1. Explicit EXPO_PUBLIC_API_URL environment variable (trailing slashes stripped)
 * 2. In Development (__DEV__):
 *    - Web: http://127.0.0.1:5000
 *    - Android Physical Device / Expo Go: http://<EXPO_HOST_IP>:5000 (extracted from hostUri)
 *    - Android Emulator: http://10.0.2.2:5000
 *    - iOS Simulator: http://127.0.0.1:5000
 * 3. Standalone production deployment fallback: https://smart-parking-btp.onrender.com
 */
export function resolveApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl && envUrl.length > 0) {
    return envUrl.replace(/\/+$/, '');
  }

  // Development mode resolution
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // 1. Web browser always connects to localhost
    if (Platform.OS === 'web') {
      return 'http://127.0.0.1:5000';
    }

    // 2. Extract host IP from Expo bundler connection (Expo Go on physical device)
    const hostUri = Constants.expoConfig?.hostUri
      || (Constants as any).manifest?.debuggerHost
      || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

    if (hostUri && typeof hostUri === 'string') {
      const host = hostUri.split(':')[0];
      // Verify host is a local IP and not an exp.direct tunnel
      if (host && !host.includes('exp.direct') && !host.includes('ngrok')) {
        return `http://${host}:5000`;
      }
    }

    // 3. Android emulator loopback host
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:5000';
    }

    // 4. iOS Simulator loopback
    return 'http://127.0.0.1:5000';
  }

  // Standalone production deployment fallback
  return 'https://smart-parking-btp.onrender.com';
}

export const API_BASE = resolveApiBaseUrl();

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${cleanEndpoint}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for Render cold starts
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
    // Log as informative log instead of triggering noisy LogBox warning banner on mobile screen
    console.log(`[API] ${endpoint} unreachable (${err.message}) — using fallback mode`);
    const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
    return {
      success: false,
      status: 'network_error',
      message: isTimeout
        ? 'Request timed out — server unreachable'
        : (err.message || 'Network request failed'),
      is_fallback: true,
      fallback_reason: isTimeout ? 'Network timeout' : 'Network failure',
    } as T;
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
  slotLabel: string,
  userEmail: string,
  durationHours: number = 2
): Promise<BookingResponse> {
  return request<BookingResponse>('/api/parking/book', {
    method: 'POST',
    body: JSON.stringify({
      slot_id: slotId,
      slot_label: slotLabel,
      user_email: userEmail,
      duration_hours: durationHours,
      booking_time: new Date().toISOString(),
    }),
  });
}

// ============ Stage 8 MARL-GCN AI Allocation ============

export async function allocateAISlot(
  userId?: string,
  preferredSlot?: string
): Promise<AIAllocationResponse> {
  return request<AIAllocationResponse>('/api/ai/allocate-slot', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      preferred_slot: preferredSlot,
    }),
  });
}

// ============ Health ============

export async function healthCheck(): Promise<{ status: string }> {
  return request<{ status: string }>('/api/health');
}
