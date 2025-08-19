import React from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { useRouter } from 'expo-router';

export default function AnimatedSplashScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LottieView
        style={styles.animation}
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
