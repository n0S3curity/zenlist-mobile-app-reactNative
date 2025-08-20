import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, FlatList, Dimensions, RefreshControl } from 'react-native';
import LottieView from 'lottie-react-native';
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');
const nis = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' });

export default function StatisticsPage() {
  type StatsData = {
    average_spend_per_receipt: number;
    receipts: Record<string, { date_and_time: string; total_price: number }>;
    top_10_price_increase: Array<{ barcode: string; name: string; new_price: number; old_price: number; price_increase: number }>;
    top_10_product_purchased: Array<{ barcode: string; name: string; average_price: number; total_quantity: number; total_price: number }>;
    total_items: number;
    total_receipts: number;
    total_spent: number;
  };
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setRefreshing] = useState(false);
  const [showRefreshLottie, setShowRefreshLottie] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('https://zenlist.hack-ops.net/api/stats');
        if (!res.ok) throw new Error('Network error');
        const json = await res.json();
        setData(json);
      } catch (e) {
        setError('שגיאה בטעינת נתונים');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    setShowRefreshLottie(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const res = await fetch('https://zenlist.hack-ops.net/api/stats');
      if (!res.ok) throw new Error('Network error');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError('שגיאה בטעינת נתונים');
    }
    setShowRefreshLottie(false);
    setRefreshing(false);
  };

  if (loading || (isRefreshing && showRefreshLottie)) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <LottieView
            source={require('../../assets/raise-animation.json')}
            autoPlay
            speed={1.3}
            loop={true}
            style={{ width: 300, height: 300 }}
          />
          <Text style={styles.loadingText}>טוען נתונים…</Text>
        </View>
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'שגיאה'}</Text>
      </View>
    );
  }

  // Prepare receipts data for chart
  const receiptEntries = Object.entries(data.receipts || {}).map(([id, r]) => ({
    id,
    ...r,
    date: (r as any).date_and_time,
    total: (r as any).total_price,
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Chart points
  const chartWidth = screenWidth - 40;
  const chartHeight = 120;
  const padding = 24;
  const minY = Math.min(...receiptEntries.map(r => r.total));
  const maxY = Math.max(...receiptEntries.map(r => r.total));
  const yRange = maxY - minY || 1;
  const xStep = (chartWidth - 2 * padding) / Math.max(receiptEntries.length - 1, 1);
  const yScale = (chartHeight - 2 * padding) / yRange;
  const points = receiptEntries.map((r, i) => {
    const x = i * xStep + padding;
    const y = chartHeight - ((r.total - minY) * yScale) - padding;
    return `${x},${y}`;
  }).join(' ');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 0 }}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="transparent" />
      }
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>סטטיסטיקות כלליות</Text>
          <LottieView source={require('../../assets/statistics-animation.json')} autoPlay loop style={{ width: 100, height: 70, marginLeft: 8 }} />
        </View>
      </View>
      <View style={styles.statsGrid}>
        <StatBox icon={<Ionicons name="receipt-outline" size={24} color="#506c4fff" />} label={'סה"כ קניות'} value={data.total_receipts} />
        <StatBox icon={<Ionicons name="cube-outline" size={24} color="#506c4fff" />} label={'סה"כ פריטים'} value={data.total_items} />
        <StatBox icon={<Ionicons name="cash-outline" size={24} color="#506c4fff" />} label={'סה"כ הוצאה'} value={nis.format(data.total_spent)} />
        <StatBox icon={<Ionicons name="trending-up-outline" size={24} color="#506c4fff" />} label={'ממוצע לקנייה'} value={nis.format(data.average_spend_per_receipt)} />
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>הוצאות לפי קבלה</Text>
        <Text style={styles.chartSubtitle}>היסטוריית קבלות</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={{ alignItems: 'center', minWidth: chartWidth + 16, backgroundColor: '#f0ecd8ff', borderRadius: 12 }}>
            <Chart width={chartWidth} height={chartHeight} points={points} minY={minY} maxY={maxY} labels={receiptEntries.map(r => r.date)} />
          </View>
        </ScrollView>
      </View>
      {/* Two lists side by side at the bottom */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ gap: 16, paddingHorizontal: 8 }}>
        {/* Price Increase List (now first) */}
        <View style={[styles.card, { minWidth: screenWidth * 0.8, maxWidth: screenWidth * 0.9 }]}> 
          <Text style={styles.sectionTitle}>10 המוצרים שהתייקרו הכי הרבה</Text>
          <FlatList
            data={data.top_10_price_increase}
            keyExtractor={item => item.barcode}
            renderItem={({ item }) => (
              <View style={styles.productRow}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productMeta}>מ: {nis.format(item.old_price)} ל: {nis.format(item.new_price)}</Text>
                <Text style={[styles.productMeta, { color: '#e74c3c', fontWeight: 'bold' }]}>התייקרות: {item.price_increase.toFixed(1)}%</Text>
              </View>
            )}
            scrollEnabled={false}
          />
        </View>
        {/* Most Purchased List (now second) */}
        <View style={[styles.card, { minWidth: screenWidth * 0.8, maxWidth: screenWidth * 0.9 }]}> 
          <Text style={styles.sectionTitle}>10 המוצרים שנרכשו הכי הרבה</Text>
          <FlatList
            data={data.top_10_product_purchased}
            keyExtractor={item => item.barcode}
            renderItem={({ item }) => (
              <View style={styles.productRow}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productMeta}>סה"כ: {item.total_quantity} | {nis.format(item.total_price)}</Text>
                <Text style={styles.productMeta}>מחיר ממוצע: {nis.format(item.average_price)}</Text>
              </View>
            )}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>
    </ScrollView>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode, label: string, value: any }) {
  return (
    <View style={styles.statBox}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Chart({ width, height, points, minY, maxY, labels }: { width: number, height: number, points: string, minY: number, maxY: number, labels: string[] }) {
  return (
    <Svg width={width} height={height}>
      {/* Y axis */}
      <Line x1={32} y1={16} x2={32} y2={height - 16} stroke="#ccc" strokeWidth="1" />
      {/* X axis */}
      <Line x1={32} y1={height - 16} x2={width - 16} y2={height - 16} stroke="#ccc" strokeWidth="1" />
      {/* Polyline */}
      <Polyline points={points} fill="none" stroke="#506c4fff" strokeWidth="2" />
      {/* Y labels */}
      <SvgText x={28} y={28} fontSize="10" fill="#666" textAnchor="end">{maxY.toFixed(0)}</SvgText>
      <SvgText x={28} y={height - 20} fontSize="10" fill="#666" textAnchor="end">{minY.toFixed(0)}</SvgText>
      {/* X labels (show only first, last, and middle) */}
      {labels.length > 0 && (
        <>
          <SvgText x={32} y={height - 2} fontSize="10" fill="#666" textAnchor="start">{labels[0].slice(5, 10)}</SvgText>
          <SvgText x={width / 2} y={height - 2} fontSize="10" fill="#666" textAnchor="middle">{labels[Math.floor(labels.length / 2)].slice(5, 10)}</SvgText>
          <SvgText x={width - 16} y={height - 2} fontSize="10" fill="#666" textAnchor="end">{labels[labels.length - 1].slice(5, 10)}</SvgText>
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0ecd8ff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { fontSize: 18, color: '#506c4fff', marginTop: 16 },
  errorText: { color: '#B91C1C', fontSize: 18, textAlign: 'center' },
  header: { paddingHorizontal: 0, paddingTop: 64, paddingBottom: 24, marginBottom: 8, backgroundColor: '#f0ecd8ff' },
  titleContainer: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 16, alignSelf: 'flex-end', paddingRight: 16, gap: 2 },
  title: { fontSize: 32, fontWeight: '700', color: '#506c4fff', textAlign: 'right' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16, gap: 8, paddingHorizontal: 8 },
  statBox: { backgroundColor: '#f0ecd8ff', borderRadius: 12, padding: 16, minWidth: '46%', alignItems: 'center', flexBasis: '46%', marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  statValue: { fontSize: 18, fontWeight: '700', color: '#506c4fff' },
  statLabel: { fontSize: 13, color: '#666', marginTop: 2 },
  card: { backgroundColor: '#f0ecd8ff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 0.5 } },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 10, textAlign: 'right' },
  chartSubtitle: { fontSize: 13, color: '#666', marginBottom: 8, textAlign: 'right' },
  productRow: { backgroundColor: '#f0ecd8ff', borderRadius: 10, padding: 12, marginBottom: 8 },
  productName: { fontSize: 16, fontWeight: '700', color: '#506c4fff', marginBottom: 2, textAlign: 'right' },
  productMeta: { fontSize: 13, color: '#666', textAlign: 'right' },
});
