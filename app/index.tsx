import React from 'react';
import { View, StyleSheet, I18nManager } from 'react-native';
import LottieView from '@/components/WebLottie';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';

// Enable RTL for Hebrew
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

export default function AnimatedSplashScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LottieView
        style={Platform.OS === 'web' ? { width: 220, height: 220 } : styles.animation}
        source={require('../assets/cart-animation.json')} // Your animation file
        autoPlay
        loop={false}
        speed={1.1} // This makes the animation twice as fast
        resizeMode="cover"
        onAnimationFinish={() => {
          // When the animation is done, replace the splash screen with the main app
          router.replace('/(tabs)/shopping-list'); 
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fffdefff', // Match your tab bar color
  },
  animation: {
    width: '40%',
    height: '40%',
  },
});
