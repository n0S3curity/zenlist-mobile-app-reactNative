import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { I18nManager, Platform, View, StyleSheet, Dimensions } from 'react-native';
I18nManager.forceRTL(false);
I18nManager.allowRTL(false);



export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'index', // Set the splash screen as the initial route
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  // On web, render the app inside a centered phone-sized frame so desktop users
  // see a borderless phone UI. On small screens we fall back to full-screen.
  if (Platform.OS === 'web') {
    const windowWidth = Dimensions.get('window').width;
    const smallScreen = windowWidth <= 430;

    return (
      <View style={styles.webBody}>
        <View style={[styles.phoneFrame, smallScreen && styles.phoneFrameSmall]}>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
              <Stack.Screen name="product-stats" />
            </Stack>
          </ThemeProvider>
        </View>
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Add the splash screen to the navigation stack */}
        <Stack.Screen name="index" /> 
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="product-stats" />
      </Stack> 
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  webBody: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  phoneFrame: {
    width: 390,
    height: 844,
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    // Use boxShadow on web to avoid deprecated shadow* warnings from react-native-web.
    boxShadow: Platform.OS === 'web' ? '0 10px 40px rgba(0,0,0,0.08)' : undefined,
    // Native fallback (kept for mobile platforms)
    shadowColor: Platform.OS === 'web' ? undefined : '#000',
    shadowOpacity: Platform.OS === 'web' ? undefined : 0.12,
    shadowRadius: Platform.OS === 'web' ? undefined : 20,
    elevation: Platform.OS === 'web' ? undefined : 6,
  },
  phoneFrameSmall: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
});
