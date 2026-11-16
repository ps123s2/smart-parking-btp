/**
 * Smart Parking AI — Main App Entry Point
 * Tab navigation with dark theme, connecting to Firebase backend.
 * 
 * PERFORMANCE: useFirebaseParking() is called ONCE here and shared
 * via props to all screens. This prevents duplicate Firebase listeners
 * and GPS watchers from being created on every tab switch.
 */
import 'react-native-gesture-handler';
import React, { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Platform, Alert, View, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from './hooks/useAuth';
import { useFirebaseParking } from './hooks/useFirebaseParking';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { MapScreen } from './screens/MapScreen';
import { BookingsScreen } from './screens/BookingsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SlotInfo } from './types/parking';
import { colors, fontSize, fontWeight } from './config/theme';
import { showAlert } from './utils/alert';
import { AppToast, showToast } from './utils/toast';
import { ScreenTransition } from './components/ui/ScreenTransition';
import { NavigationTransition, triggerNavigationTransition } from './components/ui/NavigationTransition';

const Tab = createBottomTabNavigator();

const DarkNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg.primary,
    card: colors.bg.card,
    text: colors.text.primary,
    border: colors.border.subtle,
    primary: colors.accent.blue,
  },
};

export default function App() {
  const { user, loading, error, login, register, logout, clearError } = useAuth();
  const parking = useFirebaseParking(); // Called ONCE, shared everywhere
  const [slotToBook, setSlotToBook] = useState<SlotInfo | null>(null);
  const [mapSlotToBook, setMapSlotToBook] = useState<SlotInfo | null>(null);
  const [autoOpenMapBooking, setAutoOpenMapBooking] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [guestEmail, setGuestEmail] = useState<string>(
    () => `guest_${Math.floor(10000 + Math.random() * 90000)}@demo.com`
  );

  // Fast safety timeout: if auth check takes too long (API unreachable), show login immediately
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      console.log('[App] Auth check fast-forwarding to login');
      setLoadingTimedOut(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    async function initGuest() {
      try {
        const stored = await AsyncStorage.getItem('@guest_email');
        if (stored) {
          setGuestEmail(stored);
        } else {
          await AsyncStorage.setItem('@guest_email', guestEmail);
        }
      } catch {
        // fallback
      }
    }
    initGuest();
  }, []);

  const handleLogin = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (email === 'demo@test.com') {
      setIsGuest(true);
      return true;
    }
    return login(email, password);
  }, [login]);

  // Show loading screen while checking auth (with spinner)
  if (loading && !loadingTimedOut) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={s.safeArea}>
          <StatusBar style="light" />
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent.blue} />
            <Text style={s.loadingText}>Loading Smart Parking...</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Show login screen if not authenticated (or if loading timed out)
  if (!user && !isGuest) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={s.safeArea}>
          <StatusBar style="light" />
          <LoginScreen
            onLogin={handleLogin}
            onRegister={register}
            error={error || (loadingTimedOut ? 'Server unreachable. Use demo@test.com to continue as guest.' : null)}
            loading={false}
            clearError={clearError}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <StatusBar style="dark" />
      <NavigationContainer theme={DarkNavTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            animation: 'fade',
            tabBarStyle: s.tabBar,
            tabBarActiveTintColor: colors.accent.orange,
            tabBarInactiveTintColor: colors.text.muted,
            tabBarLabelStyle: s.tabLabel,
            lazy: true, // Render tabs on-demand to maximize FPS and reduce GPU memory
            tabBarIcon: ({ focused, color }) => {
              const icons: Record<string, any> = {
                Home: focused ? 'home' : 'home-outline',
                Map: focused ? 'map' : 'map-outline',
                Bookings: focused ? 'calendar' : 'calendar-outline',
                Profile: focused ? 'person' : 'person-outline',
              };
              return <Ionicons name={icons[route.name]} size={22} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Home">
            {({ navigation }) => (
              <ScreenTransition>
                <DashboardScreen
                  userName={user?.name || 'Guest'}
                  userEmail={user?.email || guestEmail}
                  parking={parking}
                  onBook={(slot) => {
                    const currentEmail = (user?.email || guestEmail).trim().toLowerCase();
                    const isMy = (b: any) =>
                      Boolean(currentEmail && b.userEmail && b.userEmail.trim().toLowerCase() === currentEmail);
                    const activeBooking = parking.bookings.find(b => b.status === 'active' && isMy(b));
                    if (activeBooking) {
                      showToast(
                        'You already booked a slot!',
                        `You currently have an active reservation for Slot ${activeBooking.slotLabel}. Cancel it first to change slots.`,
                        'warning'
                      );
                      return;
                    }
                    setSlotToBook(slot);
                    navigation.navigate('Bookings' as never);
                  }}
                  onNavigateToMap={(slot) => {
                    const currentEmail = (user?.email || guestEmail).trim().toLowerCase();
                    const isMy = (b: any) =>
                      Boolean(currentEmail && b.userEmail && b.userEmail.trim().toLowerCase() === currentEmail);
                    const activeBooking = parking.bookings.find(b => b.status === 'active' && isMy(b));
                    if (activeBooking) {
                      triggerNavigationTransition(() => {
                        navigation.navigate('Map' as never);
                      });
                      return;
                    }
                    if (slot) {
                      setMapSlotToBook(slot);
                      setAutoOpenMapBooking(true);
                    }
                    triggerNavigationTransition(() => {
                      navigation.navigate('Map' as never);
                    });
                  }}
                />
              </ScreenTransition>
            )}
          </Tab.Screen>
          <Tab.Screen name="Map">
            {() => (
              <ScreenTransition>
                <MapScreen
                  userEmail={user?.email || guestEmail}
                  parking={parking}
                  initialSlotToBook={mapSlotToBook}
                  autoOpenBookingModal={autoOpenMapBooking}
                  onClearBookingModal={() => {
                    setMapSlotToBook(null);
                    setAutoOpenMapBooking(false);
                  }}
                />
              </ScreenTransition>
            )}
          </Tab.Screen>
          <Tab.Screen name="Bookings">
            {() => (
              <ScreenTransition>
                <BookingsScreen
                  userEmail={user?.email || guestEmail}
                  slotToBook={slotToBook}
                  onClearBookingSlot={() => setSlotToBook(null)}
                  bookings={parking.bookings}
                  onWriteBooking={parking.writeBooking}
                  onCancelBooking={parking.cancelBooking}
                  slots={parking.slots}
                />
              </ScreenTransition>
            )}
          </Tab.Screen>
          <Tab.Screen name="Profile">
            {() => (
              <ScreenTransition>
                <ProfileScreen
                  user={user}
                  onLogout={() => {
                    setIsGuest(false);
                    logout();
                  }}
                />
              </ScreenTransition>
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
      {/* Non-blocking In-App Toast Banner (Zero alert windows or OK buttons) */}
      <AppToast />
      {/* Sleek Navigation Launch Screen Transition */}
      <NavigationTransition />
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    height: Platform.OS === 'ios' ? 82 : 60,
    paddingBottom: Platform.OS === 'ios' ? 24 : 6,
    paddingTop: 6,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  tabLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg.primary,
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
    marginTop: 16,
  },
});
