/**
 * Root layout — loaded once for all routes.
 * Loads fonts, sets up GestureHandlerRootView and SafeAreaProvider.
 */
import './global.css';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { useFonts, IMFellEnglishSC_400Regular } from '@expo-google-fonts/im-fell-english-sc';
import { Caveat_400Regular, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import * as SplashScreen from 'expo-splash-screen';
import { I18nProvider } from '@dabb/i18n';
import { useVersionCheck } from '@dabb/ui-shared';
import { APP_VERSION, SERVER_URL } from '../constants.js';
import AppErrorBoundary from '../components/ui/AppErrorBoundary.js';
import UpdateRequiredScreen from '../components/ui/UpdateRequiredScreen.js';
import { loadSoundPreferences } from '../utils/sounds.js';
import { loadHapticsPreferences } from '../utils/haptics.js';

SplashScreen.preventAutoHideAsync();

if (Platform.OS === 'android') {
  void NavigationBar.setVisibilityAsync('hidden');
  void NavigationBar.setBehaviorAsync('overlay-swipe');
}

function RootLayout() {
  const [fontsLoaded] = useFonts({
    IMFellEnglishSC_400Regular,
    Caveat_400Regular,
    Caveat_700Bold,
    Lato_400Regular,
    Lato_700Bold,
  });

  const { needsUpdate, isLoading: versionLoading } = useVersionCheck({
    currentVersion: APP_VERSION,
    serverBaseUrl: SERVER_URL,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    void loadSoundPreferences();
    void loadHapticsPreferences();
  }, []);

  if (!fontsLoaded || versionLoading) {
    return null;
  }

  if (needsUpdate) {
    return <UpdateRequiredScreen />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      <SafeAreaProvider>
        <I18nProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

export default function RootLayoutWithBoundary() {
  return (
    <AppErrorBoundary>
      <RootLayout />
    </AppErrorBoundary>
  );
}
