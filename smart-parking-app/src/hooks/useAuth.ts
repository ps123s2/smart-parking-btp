/**
 * Authentication hook managing user state with AsyncStorage persistence.
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserInfo } from '../types/parking';
import { loginUser, registerUser, verifyToken } from '../services/api';

interface UseAuthResult {
  user: UserInfo | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const USER_STORAGE_KEY = '@smart_parking_user';
const TOKEN_STORAGE_KEY = '@smart_parking_token';

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    checkExistingSession();
  }, []);

  async function checkExistingSession() {
    try {
      const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
      const storedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);

      if (storedUser && storedToken) {
        const userData = JSON.parse(storedUser) as UserInfo;
        // Try to verify the token with the backend
        try {
          const result = await verifyToken(storedToken);
          if (result.success && result.user) {
            setUser({ ...result.user, token: storedToken } as UserInfo);
          } else {
            // Token invalid, use stored data as fallback
            setUser(userData);
          }
        } catch {
          // API not reachable, use stored data
          setUser(userData);
        }
      }
    } catch {
      // Storage error, ignore
    } finally {
      setLoading(false);
    }
  }

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const result = await loginUser(email, password);
      if (result.success && result.user) {
        setUser(result.user);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.user));
        await AsyncStorage.setItem(TOKEN_STORAGE_KEY, result.user.token);
        setLoading(false);
        return true;
      } else {
        setError(result.message || 'Login failed');
        setLoading(false);
        return false;
      }
    } catch (err: any) {
      setError('Cannot connect to server. Make sure the API is running.');
      setLoading(false);
      return false;
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, name: string): Promise<boolean> => {
      setError(null);
      setLoading(true);
      try {
        const result = await registerUser(email, password, name);
        if (result.success && result.user) {
          setUser(result.user);
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.user));
          await AsyncStorage.setItem(TOKEN_STORAGE_KEY, result.user.token);
          setLoading(false);
          return true;
        } else {
          setError(result.message || 'Registration failed');
          setLoading(false);
          return false;
        }
      } catch (err: any) {
        setError('Cannot connect to server. Make sure the API is running.');
        setLoading(false);
        return false;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    setUser(null);
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { user, loading, error, login, register, logout, clearError };
}
