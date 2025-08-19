import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ScrollView,
  Platform,
  Dimensions,
  FlatList,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Line, G, Rect, Text as SvgText, Polyline, Circle } from 'react-native-svg';

// ---------- Types ----------
type ProductStats = {
  barcode: string;
  name: string;
  cheapest_price: number;
  highest_price: number;
  last_price: number;
  average_price: number;
  price_increase?: number;
  total_price?: number;
  total_quantity?: number;
  history: {
    date: string;
    price: number;
    quantity: number;
  }[];
};

// ---------- UI Helpers ----------
const nis = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" });
const { width: screenWidth } = Dimensions.get('window');
const CHART_WIDTH = screenWidth - 64; // Adjust chart width to screen size with padding

// Chart Styles - Declared once in the global scope
const chartStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 16,
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

// ---------- Component: Price History Chart (Simple Line Graph) ----------
function PriceHistoryChart({ history }: { history: ProductStats['history'] }) {
  // Guard clause for insufficient data
  if (!history || history.length < 2) {
    return (
      <View style={chartStyles.container}>
        <Text style={chartStyles.noDataText}>אין מספיק נתוני היסטוריה להצגה</Text>
      </View>
    );
  }

  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const prices = sortedHistory.map(item => item.price).filter(p => typeof p === 'number' && !isNaN(p));
  if (prices.length < 2) {
    return (
      <View style={chartStyles.container}>
        <Text style={chartStyles.noDataText}>אין מספיק נתוני היסטוריה תקינים להצגה</Text>
      </View>
    );
  }
  
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const width = CHART_WIDTH;
  const height = 150;
  const padding = 20;
  const xScale = (width - padding * 2) / (sortedHistory.length - 1);
  const yScale = (height - padding * 2) / (maxPrice - minPrice || 1);

  const points = sortedHistory.map((item, index) => {
    const x = index * xScale + padding;
    const y = height - (item.price - minPrice) * yScale - padding;
    return `${x},${y}`;
  }).join(' ');

  const dateLabels = sortedHistory.map((item, index) => {
    const x = index * xScale + padding;
    const date = new Date(item.date);
    return {
      x,
      label: `${date.getDate()}/${date.getMonth() + 1}`,
    };
  });

  return (
    <View style={chartStyles.container}>
      <Svg height={height + padding * 2} width={width + padding * 2}>
        {/* Y-axis */}
        <G>
          <Line x1={padding} y1={padding} x2={padding} y2={height + padding} stroke="#ccc" strokeWidth="1" />
          {/* Y-axis labels */}
          <SvgText x={padding - 5} y={padding + 5} textAnchor="end" fill="#666" fontSize="10">{maxPrice.toFixed(2)}</SvgText>
          <SvgText x={padding - 5} y={height + padding - 5} textAnchor="end" fill="#666" fontSize="10">{minPrice.toFixed(2)}</SvgText>
        </G>
        {/* X-axis */}
        <G>
          <Line x1={padding} y1={height + padding} x2={width + padding} y2={height + padding} stroke="#ccc" strokeWidth="1" />
          {/* X-axis labels */}
          {dateLabels.map((item, index) => (
            <SvgText key={index} x={item.x} y={height + padding + 15} textAnchor="middle" fill="#666" fontSize="10">{item.label}</SvgText>
          ))}
        </G>
        {/* Line graph */}
        <Polyline points={points} fill="none" stroke="#506c4fff" strokeWidth="2" />
        {/* Data points */}
        {sortedHistory.map((item, index) => {
          const x = index * xScale + padding;
          const y = height - (item.price - minPrice) * yScale - padding;
          return (
            <Circle key={index} cx={x} cy={y} r="3" fill="#506c4fff" />
          );
        })}
      </Svg>
    </View>
  );
}


// ---------- Screen: Product Stats Page ----------
export default function ProductStatsPage() {
  const { barcode } = useLocalSearchParams();
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProductStats() {
      if (!barcode) {
        setError("לא נמצא ברקוד");
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`https://zenlist.hack-ops.net/api/stats/${barcode}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: ProductStats = await res.json();
        setStats(data);
      } catch (e: any) {
        setError("שגיאה בטעינת נתוני המוצר.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchProductStats();
  }, [barcode]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#506c4fff" />
          <Text style={styles.loadingText}>טוען נתוני מוצר...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color="#c0392b" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!stats) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color="#f39c12" />
          <Text style={styles.errorText}>לא נמצאו נתונים עבור מוצר זה.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const ListHeader = () => (
    <>
      {/* Product Info with corrected padding */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: "#506c4fff" }]}>{`פרטי מוצר: ${stats.barcode}`}</Text>
          <Text style={[styles.titleEmoji, { color: "#506c4fff" }]}>📝</Text>
        </View>
        <Text style={styles.productName}>{stats.name}</Text>
      </View>

      {/* Price Stats */}
      <StatRow title="מחיר אחרון" value={stats.last_price} color="#333" />
      <StatRow title="מחיר ממוצע" value={stats.average_price} color="#333" />
      <StatRow title="המחיר הכי זול" value={stats.cheapest_price} color="#2ecc71" />
      <StatRow title="המחיר הכי יקר" value={stats.highest_price} color="#e74c3c" />
      <StatRow title="סה״כ מחיר" value={stats.total_price} color="#333" />
      <StatRow title="סה״כ רכישות" value={stats.total_quantity} color="#333" isInteger={true} />
      <StatRow title="התייקרות" value={stats.price_increase} color="#e74c3c" isPercentage={true} />
      
      {/* Price History Chart */}
      <Text style={styles.chartTitle}>היסטוריית מחירים</Text>
      <PriceHistoryChart history={stats.history} />

      {/* Purchase History List Title */}
      <Text style={styles.historyTitle}>היסטוריית רכישות</Text>
    </>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={stats.history}
        keyExtractor={(item, index) => `${item.date}-${index}`}
        renderItem={({ item }) => <HistoryRow item={item} />}
        ListHeaderComponent={ListHeader}
        ItemSeparatorComponent={() => <View style={styles.historySeparator} />}
        contentContainerStyle={styles.container}
      />
    </SafeAreaView>
  );
}

// ---------- Component: Stat Row ----------
function StatRow({ title, value, color, isPercentage = false, isInteger = false }: { title: string; value: number | undefined; color: string; isPercentage?: boolean; isInteger?: boolean }) {
  let formattedValue = "—";
  if (typeof value === 'number' && !isNaN(value)) {
    if (isPercentage) {
      formattedValue = `${value.toFixed(2)}%`;
    } else if (isInteger) {
      formattedValue = value.toString();
    } else {
      formattedValue = nis.format(value);
    }
  }

  return (
    <View style={statStyles.row}>
      <Text style={statStyles.title}>{title}</Text>
      <Text style={[statStyles.value, { color }]}>{formattedValue}</Text>
    </View>
  );
}

// ---------- Component: History Row ----------
function HistoryRow({ item }: { item: { date: string, price: number, quantity: number } }) {
  const purchaseDate = new Date(item.date);
  const formattedDate = purchaseDate.toLocaleDateString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const formattedTime = purchaseDate.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  const priceText = typeof item.price === 'number' && !isNaN(item.price) ? nis.format(item.price) : "—";
  const quantityText = typeof item.quantity === 'number' && !isNaN(item.quantity) ? `כמות: ${item.quantity}` : "כמות: —";
  
  return (
    <View style={styles.historyRow}>
      <View style={styles.historyDetails}>
        <Text style={[styles.historyDate, { fontWeight: 'bold' }]}>{`${formattedDate} ${formattedTime}`}</Text>
        <Text style={styles.historyQuantity}>{quantityText}</Text>
      </View>
      <Text style={styles.historyPrice}>{priceText}</Text>
    </View>
  );
}


// ---------- General Styles ----------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f0ecd8ff",
    paddingTop: Platform.OS === "android" ? 25 : 0,
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 18,
    color: "#506c4fff",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 18,
    textAlign: 'center',
  },
  header: {
    alignItems: 'flex-end',
    marginBottom: 16, // Adjusted marginBottom for better spacing
    paddingTop: 20, // Adjusted paddingTop
  },
  titleContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 8,
    alignSelf: 'flex-end',
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    textAlign: 'right',
  },
  titleEmoji: {
    fontSize: 28,
  },
  productName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#506c4fff',
    textAlign: 'right',
    marginTop: 8, // Adjusted marginTop
  },
  barcodeText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
    marginTop: 24,
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  historyDetails: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  historyDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'right',
  },
  historyQuantity: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
    marginTop: 2,
  },
  historyPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2ca71cff',
    textAlign: 'left',
  },
  historySeparator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
});

const statStyles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'right',
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'left',
  },
});
