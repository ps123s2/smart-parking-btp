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
import { SafeAreaView, StyleSheet, Platform } from 'react-native';
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
  const [isGuest, setIsGuest] = useState(false);
  const [guestEmail, setGuestEmail] = useState<string>('guest@demo.com');

  useEffect(() => {
    async function initGuest() {
      try {
        const stored = await AsyncStorage.getItem('@guest_email');
        if (stored) {
          setGuestEmail(stored);
        } else {
          const newGuest = `guest_${Math.floor(Math.random() * 100000)}@demo.com`;
          await AsyncStorage.setItem('@guest_email', newGuest);
          setGuestEmail(newGuest);
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

  if (!user && !isGuest && !loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <StatusBar style="light" />
        <LoginScreen
          onLogin={handleLogin}
          onRegister={register}
          error={error}
          loading={loading}
          clearError={clearError}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar style="light" />
      <NavigationContainer theme={DarkNavTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: s.tabBar,
            tabBarActiveTintColor: colors.accent.blue,
            tabBarInactiveTintColor: colors.text.muted,
            tabBarLabelStyle: s.tabLabel,
            lazy: false, // Pre-render all tabs to eliminate switch lag
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
              <DashboardScreen
                userName={user?.name || 'Guest'}
                parking={parking}
                onBook={(slot) => {
                  setSlotToBook(slot);
                  navigation.navigate('Bookings' as never);
                }}
                onNavigateToMap={() => navigation.navigate('Map' as never)}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Map">
            {({ navigation }) => (
              <MapScreen
                parking={parking}
                onBook={(slot) => {
                  setSlotToBook(slot);
                  navigation.navigate('Bookings' as never);
                }}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Bookings">
            {() => (
              <BookingsScreen
                userEmail={user?.email || guestEmail}
                slotToBook={slotToBook}
                onClearBookingSlot={() => setSlotToBook(null)}
                bookings={parking.bookings}
                onWriteBooking={parking.writeBooking}
                onCancelBooking={parking.cancelBooking}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Profile">
            {() => (
              <ProfileScreen
                user={user}
                onLogout={() => {
                  setIsGuest(false);
                  logout();
                }}
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  tabBar: {
    backgroundColor: '#0E1420',
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    height: Platform.OS === 'ios' ? 88 : 65,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});
