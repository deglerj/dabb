import './global.css';
import React, { useEffect, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  I18nProvider,
  setStorageAdapter,
  detectLanguageAsync,
  type SupportedLanguage,
} from '@dabb/i18n';
import AppErrorBoundary from '../components/ui/AppErrorBoundary.js';
import { loadSoundPreferences } from '../utils/sounds.js';
import { loadHapticsPreferences } from '../utils/haptics.js';

setStorageAdapter(AsyncStorage);

SplashScreen.preventAutoHideAsync();

if (Platform.OS === 'android') {
  void NavigationBar.setVisibilityAsync('hidden');
}

function RootLayout() {
  const [fontsLoaded] = useFonts({
    IMFellEnglishSC_400Regular,
    Caveat_400Regular,
    Caveat_700Bold,
    Lato_400Regular,
    Lato_700Bold,
  });

  const [language, setLanguage] = useState<SupportedLanguage | null>(null);

  useEffect(() => {
    void detectLanguageAsync().then(setLanguage);
  }, []);

  useEffect(() => {
    if (fontsLoaded && language !== null) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, language]);

  useEffect(() => {
    void loadSoundPreferences();
    void loadHapticsPreferences();
  }, []);

  if (!fontsLoaded || language === null) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      <SafeAreaProvider>
        <I18nProvider initialLanguage={language}>
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
