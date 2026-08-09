import React, { useEffect, useState, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useRouteError } from 'react-router-dom';
import { ActivityIndicator, View } from '@dabb/rn-compat';
import { I18nProvider } from '@dabb/i18n';
import AppErrorBoundary from './components/ui/AppErrorBoundary.js';
import ErrorBoundaryScreen from './components/ui/ErrorBoundaryScreen.js';
import { loadSoundPreferences } from './utils/sounds.js';
import { loadHapticsPreferences } from './utils/haptics.js';

// React Router's data router gives every route its own default error boundary, which would
// otherwise intercept render errors (e.g. Firebase init failures) before AppErrorBoundary — a
// plain class component with no route context — ever sees them. This is the route-aware
// equivalent, wired in as errorElement on the root route below.
function RouteErrorScreen() {
  const routeError = useRouteError();
  const error = routeError instanceof Error ? routeError : new Error(String(routeError));

  const handleCopy = () => {
    const text = [
      '=== ERROR ===',
      error.message,
      '',
      '=== STACK TRACE ===',
      error.stack ?? '(no stack)',
    ].join('\n');
    void navigator.clipboard.writeText(text);
  };

  return (
    <ErrorBoundaryScreen
      error={error}
      onReload={() => window.location.reload()}
      onCopy={handleCopy}
    />
  );
}

// Lazy: keeps Firebase's module-level init (which throws synchronously on
// bad config) inside a render pass the error boundary can actually catch,
// rather than eagerly evaluating at the top of the module graph before
// React mounts. Also code-splits Firebase out of the offline-only chunk.
const HomeScreen = React.lazy(() => import('./components/ui/HomeScreen.js'));
const RulesScreen = React.lazy(() => import('./app/rules.js'));
const PrivacyScreen = React.lazy(() => import('./app/privacy.js'));
const WaitingRoomRoute = React.lazy(() => import('./app/waiting-room/WaitingRoomRoute.js'));
const GameRoute = React.lazy(() => import('./app/game/GameRoute.js'));
const OfflineGameRoute = React.lazy(() => import('./app/game/offline.js'));

const FONT_FAMILIES = [
  'IMFellEnglishSC_400Regular',
  'Caveat_400Regular',
  'Caveat_700Bold',
  'Lato_400Regular',
  'Lato_700Bold',
];

async function loadFonts(): Promise<void> {
  await Promise.all(FONT_FAMILIES.map((family) => document.fonts.load(`16px ${family}`)));
}

function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    loadFonts()
      .catch(() => undefined)
      .finally(() => setFontsLoaded(true));
  }, []);

  useEffect(() => {
    loadSoundPreferences();
    loadHapticsPreferences();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <I18nProvider>
        <Suspense
          fallback={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" />
            </View>
          }
        >
          <Outlet />
        </Suspense>
      </I18nProvider>
    </View>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorScreen />,
    children: [
      { path: '/', element: <HomeScreen /> },
      { path: '/rules', element: <RulesScreen /> },
      { path: '/privacy', element: <PrivacyScreen /> },
      { path: '/waiting-room/:code', element: <WaitingRoomRoute /> },
      { path: '/game/offline', element: <OfflineGameRoute /> },
      { path: '/game/:code', element: <GameRoute /> },
    ],
  },
]);

export default function App() {
  return (
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  );
}
