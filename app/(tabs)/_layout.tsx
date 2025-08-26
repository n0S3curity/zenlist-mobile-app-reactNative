import React, { useRef, useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Dimensions, Pressable, Text } from 'react-native';
import LottieView from 'lottie-react-native';


function TabTransitionAnimation({ visible, onFinish }) {
  const animationRef = useRef(null);

  useEffect(() => {
    if (visible && animationRef.current) {
      animationRef.current.play();
      const timeout = setTimeout(() => {
        onFinish();
      }, 1100);
      return () => clearTimeout(timeout);
    }
  }, [visible]);

  if (!visible) return null;
  return (
    <View style={styles.overlay} pointerEvents="none">
      <LottieView
        ref={animationRef}
        source={require('../../assets/hand-animation.json')}
        autoPlay
        loop={true}
        style={styles.lottie}
      />
    </View>
  );
}

export default function TabLayout() {
  const [showAnim, setShowAnim] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#f0ecd8ff' },
      }}
      // Custom tabBar to intercept tab presses
      tabBar={({ state, descriptors, navigation, insets }) => {
        return (
          <>
            <TabTransitionAnimation
              visible={showAnim}
              onFinish={() => {
                setShowAnim(false);
                if (pendingTab !== null) {
                  navigation.navigate(state.routes[pendingTab].name);
                  setPendingTab(null);
                }
              }}
            />
            <View style={{ flexDirection: 'row', height: 80, backgroundColor: '#f0ecd8ff', borderTopWidth: 1, borderColor: '#506c4fff' }}>
              {state.routes.map((route, index) => {
                const { options } = descriptors[route.key];
                const label = options.tabBarLabel ?? options.title ?? route.name;
                const isFocused = state.index === index;
                // If focused then make it a little bigger and move up the text and icon
                let iconSize = isFocused ? 32 : 26;
                let icon = options.tabBarIcon ? options.tabBarIcon({ color: isFocused ? '#506c4fff' : '#222', focused: isFocused, size: iconSize }) : null;
                let translateY = isFocused ? -8 : 0;
                let fontSize = isFocused ? 15 : 12;
                return (
                  <View key={route.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Pressable
                      style={{ alignItems: 'center', justifyContent: 'center', width: '100%', transform: [{ translateY }] }}
                      onPress={() => {
                        if (!isFocused) {
                          setShowAnim(true);
                          setPendingTab(index);
                        }
                      }}
                    >
                      {icon}
                      <Text style={{ color: isFocused ? '#506c4fff' : '#222', fontSize, marginTop: 4, fontWeight: isFocused ? '700' : '400' }}>{typeof label === 'string' ? label : ''}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </>
        );
      }}
    >
      <Tabs.Screen
        name="supermarket"
        options={{
          title: 'סופר',
          tabBarIcon: ({ color }) => <Ionicons name="storefront-outline" size={24} color={color} />,
        }}
      />
      {/* The first two tabs */}




      {/* The last three tabs */}
      <Tabs.Screen
        name="statistics"
        options={{
          title: 'נתונים',
          tabBarIcon: ({ color }) => <Ionicons name="stats-chart-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="receipts"
        options={{
          title: 'קבלות',
          tabBarIcon: ({ color }) => <Ionicons name="receipt-outline" size={24} color={color} />,
        }}
      />

      {/* The middle tab */}
      <Tabs.Screen
        name="shopping-list"
        options={{
          title: 'רשימה',
          tabBarIcon: ({ color }) => <Ionicons name="cart-outline" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'מוצרים',
          tabBarIcon: ({ color }) => <Ionicons name="cube-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'הגדרות',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    // set your desired width and height as device full screen
    width: Dimensions.get('window').width,  // set your desired width
    height: Dimensions.get('window').height, // set your desired height
    backgroundColor: '#f0ecd8ff', // or any color/opacity you want
    // do not overlay the navbar
    // zIndex: 9999, // do not use zIndex in React Native
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: 450,
    height: 450,
  },
});
