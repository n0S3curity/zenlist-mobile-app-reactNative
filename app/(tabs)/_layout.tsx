import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { 
          backgroundColor: '#fffdefff' // This sets the navbar color
        },
      }}
    ><Tabs.Screen
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
          title: 'סטטיסטיקות',
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
          tabBarIcon: ({ color }) => <Ionicons name="cart-outline" size={24} color={color} />,
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
