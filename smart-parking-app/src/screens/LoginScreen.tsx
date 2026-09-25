/**
 * Login screen with email/password authentication.
 * Matches the dark glassmorphic mockup design.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, fontSize, fontWeight, shadows } from '../config/theme';

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
  onRegister: (email: string, password: string, name: string) => Promise<boolean>;
  error: string | null;
  loading: boolean;
  clearError: () => void;
}

export function LoginScreen({
  onLogin,
  onRegister,
  error,
  loading,
  clearError,
}: LoginScreenProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit() {
    if (isRegister) {
      await onRegister(email, password, name);
    } else {
      await onLogin(email, password);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={[colors.gradient.accentStart, colors.gradient.accentEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoGradient}
          >
            <Ionicons name="car-sport" size={42} color="#fff" />
          </LinearGradient>
          <Text style={styles.appName}>Smart Parking</Text>
          <Text style={styles.appSubtitle}>AI-powered parking management</Text>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={colors.status.occupied} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
          {isRegister && (
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={18} color={colors.text.muted} />
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={colors.text.muted}
                value={name}
                onChangeText={(t) => { setName(t); clearError(); }}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={18} color={colors.text.muted} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={colors.text.muted}
              value={email}
              onChangeText={(t) => { setEmail(t); clearError(); }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={[styles.inputContainer, styles.inputFocused]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.text.muted} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor={colors.text.muted}
              value={password}
              onChangeText={(t) => { setPassword(t); clearError(); }}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={colors.text.muted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit button */}
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>
              {isRegister ? 'Create Account' : 'Sign In'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Toggle */}
        <TouchableOpacity
          onPress={() => {
            setIsRegister(!isRegister);
            clearError();
          }}
        >
          <Text style={styles.toggleText}>
            {isRegister
              ? "Already have an account? "
              : "Don't have an account? "}
            <Text style={styles.toggleLink}>
              {isRegister ? 'Sign In' : 'Register'}
            </Text>
          </Text>
        </TouchableOpacity>

        {/* Skip login hint */}
        <TouchableOpacity
          onPress={() => onLogin('demo@test.com', 'demo123')}
          style={styles.skipButton}
        >
          <Text style={styles.skipText}>Continue as Guest →</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    gap: spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow(colors.accent.blue),
  },
  appName: {
    color: colors.text.primary,
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
  },
  appSubtitle: {
    color: colors.text.muted,
    fontSize: fontSize.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.occupiedGlow,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  errorText: {
    color: colors.status.occupied,
    fontSize: fontSize.sm,
    flex: 1,
  },
  form: {
    gap: spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  inputFocused: {
    borderWidth: 1.5,
    borderColor: colors.accent.blue,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: fontSize.md,
  },
  submitButton: {
    backgroundColor: colors.accent.blue,
    paddingVertical: spacing.lg + 2,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.subtle,
  },
  dividerText: {
    color: colors.text.muted,
    fontSize: fontSize.sm,
  },
  toggleText: {
    textAlign: 'center',
    color: colors.text.muted,
    fontSize: fontSize.md,
  },
  toggleLink: {
    color: colors.accent.blue,
    fontWeight: fontWeight.semibold,
  },
  skipButton: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  skipText: {
    color: colors.text.muted,
    fontSize: fontSize.sm,
  },
});
