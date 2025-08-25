import React, {useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, FlatList, Dimensions, RefreshControl, TouchableOpacity, Modal } from 'react-native';
import LottieView from 'lottie-react-native';
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');
const nis = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' });

// Calendar helpers
function getMonthMatrix(year, month) {
  // Returns a matrix (array of weeks) for the given month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const matrix = [];
  let week = [];
  // JS getDay(): Sunday is 0, Saturday is 6. We want Sunday at the end.
  let dayOfWeek = firstDay.getDay();
  // Fill first week with blanks if month doesn't start on Sunday
  for (let i = 0; i < dayOfWeek; i++) week.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    week.push(d);
    if (week.length === 7) {
      matrix.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    matrix.push(week);
  }
  return matrix;
}

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
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // New state to control the calendar's displayed month
  const [displayDate, setDisplayDate] = useState(new Date());

  // Memoize receipt data processing so it doesn't run on every render
  type ReceiptEntry = { id: string; date: string; total: number };
  type ReceiptsByDay = { [date: string]: ReceiptEntry[] };
  type ChartData = { width: number; height: number; points: string; minY: number; maxY: number; labels: string[] };
  const { receiptEntries, purchaseDays, receiptsByDay, chartData }: {
    receiptEntries: ReceiptEntry[];
    purchaseDays: Set<string>;
    receiptsByDay: ReceiptsByDay;
    chartData: ChartData | undefined;
  } = useMemo(() => {
    if (!data) {
      return { receiptEntries: [], purchaseDays: new Set(), receiptsByDay: {}, chartData: undefined };
    }

    const entries: ReceiptEntry[] = Object.entries(data.receipts || {}).map(([id, r]) => ({
      id,
      date: r.date_and_time,
      total: r.total_price,
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const days = new Set(entries.map(r => r.date.slice(0, 10)));

    const byDay: ReceiptsByDay = {};
    for (const r of entries) {
      const day = r.date.slice(0, 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(r);
    }

    const chartWidth = screenWidth - 40;
    const chartHeight = 120;
    const padding = 24;
    const minY = Math.min(...entries.map(r => r.total), 0);
    const maxY = Math.max(...entries.map(r => r.total), 0);
    const yRange = maxY - minY || 1;
    const xStep = (chartWidth - 2 * padding) / Math.max(entries.length - 1, 1);
    const yScale = (chartHeight - 2 * padding) / yRange;
    const points = entries.map((r, i) => {
      const x = i * xStep + padding;
      const y = chartHeight - ((r.total - minY) * yScale) - padding;
      return `${x},${y}`;
    }).join(' ');

    return {
      receiptEntries: entries,
      purchaseDays: days,
      receiptsByDay: byDay,
      chartData: entries.length > 0 ? { width: chartWidth, height: chartHeight, points, minY, maxY, labels: entries.map(r => r.date) } : undefined
    };
  }, [data]);

  // Memoize calendar calculations and total spent for displayed month
  const { calYear, calMonth, calMatrix, monthName, monthTotalSpent } = useMemo(() => {
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const matrix = getMonthMatrix(year, month);
    const name = displayDate.toLocaleString('he-IL', { month: 'long', year: 'numeric' });
    // Calculate total spent in this month
    let total = 0;
    if (data && data.receipts) {
      Object.values(data.receipts).forEach(r => {
        const d = new Date(r.date_and_time);
        if (d.getFullYear() === year && d.getMonth() === month) {
          total += r.total_price;
        }
      });
    }
    return { calYear: year, calMonth: month, calMatrix: matrix, monthName: name, monthTotalSpent: total };
  }, [displayDate, data]);

  const handlePrevMonth = () => {
    setDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const fetchData = async () => {
    try {
      const res = await fetch('https://zenlist.hack-ops.net/api/stats');
      if (!res.ok) throw new Error('Network error');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError('שגיאה בטעינת נתונים');
    }
  };

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    setShowRefreshLottie(true);
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Lottie visibility
    await fetchData();
    setShowRefreshLottie(false);
    setRefreshing(false);
  };

  if (loading) {
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
        <TouchableOpacity onPress={fetchData} style={{ marginTop: 16 }}>
            <Text style={{ color: '#506c4fff', textDecorationLine: 'underline' }}>נסה שוב</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="transparent" colors={['#506c4fff']} />
      }
    >
      {/* 1. Title is back */}
      <View style={styles.header}>
        <View style={[styles.titleContainer, { alignItems: 'center', gap: 8 }]}> 
          <Text style={styles.title}>סטטיסטיקה</Text>
          <View style={{ justifyContent: 'center', alignItems: 'center', height: 48 }}>
            <LottieView
              source={require('../../assets/statistics-animation.json')}
              autoPlay
              loop
              style={{ width: 100, height: 56, marginLeft: 0, marginTop: 90 }}
            />
          </View>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatBox icon={<Ionicons name="receipt-outline" size={24} color="#506c4fff" />} label={'ביקורים בסופר'} value={data?.total_receipts ?? 0} />
        <StatBox icon={<Ionicons name="cube-outline" size={24} color="#506c4fff" />} label={'סה"כ פריטים'} value={data?.total_items ?? 0} />
        <StatBox icon={<Ionicons name="cash-outline" size={24} color="#506c4fff" />} label={'סה"כ הוצאה שנתית'} value={nis.format(data?.total_spent ?? 0)} />
        <StatBox icon={<Ionicons name="trending-up-outline" size={24} color="#506c4fff" />} label={'ממוצע לקנייה'} value={nis.format(data?.average_spend_per_receipt ?? 0)} />
      </View>

      {/* 2. Layout changed: Chart is now before the calendar */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>הוצאות לפי קבלה</Text>
        <Text style={styles.chartSubtitle}>היסטוריית קבלות</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={{ alignItems: 'center', minWidth: (chartData?.width ?? 200) + 16, backgroundColor: '#f0ecd8ff', borderRadius: 12, paddingVertical: 8 }}>
            {chartData ? <Chart {...chartData} /> : <Text>אין נתונים להצגה</Text>}
          </View>
        </ScrollView>
      </View>

      {/* 3. Calendar with month navigation and total spent */}
      <View style={styles.card}>
        <View style={styles.calendarNav}>
            <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
                <Ionicons name="chevron-forward-outline" size={24} color="#506c4fff" />
            </TouchableOpacity>
            <Text style={styles.sectionTitle}>{monthName}</Text>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
                <Ionicons name="chevron-back-outline" size={24} color="#506c4fff" />
            </TouchableOpacity>
        </View>
        <Text style={styles.monthTotalSpent}>
          סה"כ הוצאה החודש: {nis.format(monthTotalSpent)}
        </Text>
        <View style={styles.calendarWrap}>
          <View style={styles.calendarRow}>
            {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((d, i) => (
              <Text key={i} style={[styles.calendarCell, styles.calendarHeader]}>{d}</Text>
            ))}
          </View>
          {calMatrix.map((week, i) => (
            <View key={i} style={styles.calendarRow}>
              {week.map((day, j) => {
                if (!day) return <View key={j} style={styles.calendarCell} />;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isPurchase = purchaseDays.has(dateStr);
                return (
                  <TouchableOpacity
                    key={j}
                    style={[styles.calendarCell, isPurchase && styles.calendarPurchaseDay]}
                    onPress={() => isPurchase && setSelectedDay(dateStr)}
                    disabled={!isPurchase}
                  >
                    <Text style={[styles.calendarDayText, isPurchase && styles.calendarPurchaseDayText]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* Purchase details modal */}
      <Modal
        visible={!!selectedDay}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDay(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              רכישות ב־{selectedDay}
            </Text>
            {selectedDay && receiptsByDay[selectedDay] ? (
              (receiptsByDay[selectedDay] as ReceiptEntry[]).map((r: ReceiptEntry, idx: number) => (
                // 4. Modal text fixes
                <View key={r.id + idx} style={styles.modalReceipt}>
                  <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>שעה:</Text>
                      <Text style={styles.modalValue}>{r.date.slice(11, 16)}</Text>
                  </View>
                  <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>סכום:</Text>
                      <Text style={[styles.modalValue, styles.modalPrice]}>{nis.format(r.total)}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ color: '#666', textAlign: 'center' }}>לא נמצאו רכישות</Text>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedDay(null)}
            >
              <Text style={styles.closeButtonText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Two lists side by side at the bottom */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 16, paddingHorizontal: 8 }}>
        <View style={[styles.card, { minWidth: screenWidth * 0.85, maxWidth: screenWidth * 0.9, marginBottom: 0 }]}>
          <Text style={styles.sectionTitle}>10 המוצרים שהתייקרו הכי הרבה</Text>
          <FlatList
            data={data?.top_10_price_increase ?? []}
            keyExtractor={item => item.barcode}
            renderItem={({ item }) => (
              <View style={[styles.productRow, { marginBottom: 4, paddingVertical: 6 }]}> 
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[styles.productName, { flex: 1, marginBottom: 0 }]} numberOfLines={1} ellipsizeMode="tail">
                    {item.name.length > 30 ? item.name.slice(0, 30) + '…' : item.name}
                  </Text>
                  <Text style={[styles.productMeta, { color: '#e74c3c', fontWeight: 'bold', minWidth: 80, textAlign: 'left', marginBottom: 0 }]}>התייקרות: {item.price_increase.toFixed(1)}%</Text>
                </View>
                <Text style={[styles.productMeta, { textAlign: 'left', marginTop: 0, marginBottom: 0, lineHeight: 16 }]}>מ: {nis.format(item.old_price)} ל: {nis.format(item.new_price)}</Text>
              </View>
            )}
            scrollEnabled={false}
          />
        </View>
        <View style={[styles.card, { minWidth: screenWidth * 0.85, maxWidth: screenWidth * 0.9, marginBottom: 0 }]}>
          <Text style={styles.sectionTitle}>10 המוצרים שנרכשו הכי הרבה</Text>
          <FlatList
            data={data?.top_10_product_purchased ?? []}
            keyExtractor={item => item.barcode}
            renderItem={({ item }) => (
              <View style={[styles.productRow, { marginBottom: 4, paddingVertical: 6 }]}> 
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[styles.productName, { flex: 1, marginBottom: 0 }]} numberOfLines={1} ellipsizeMode="tail">
                    {item.name.length > 30 ? item.name.slice(0, 30) + '…' : item.name}
                  </Text>
                  <Text style={[styles.productMeta, { fontWeight: 'bold', minWidth: 80, textAlign: 'left', marginBottom: 0 }]}>סה"כ: {item.total_quantity} יח'| {nis.format(item.total_price)} </Text>
                </View>
                <Text style={[styles.productMeta, { textAlign: 'left', marginTop: 0, marginBottom: 0, lineHeight: 16 }]}>מחיר ממוצע: {nis.format(item.average_price)}</Text>
              </View>
            )}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>
    </ScrollView>
  );
}

type StatBoxProps = { icon: React.ReactNode; label: string; value: string | number };
function StatBox({ icon, label, value }: StatBoxProps) {
  return (
    <View style={styles.statBox}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

type ChartProps = { width: number; height: number; points: string; minY: number; maxY: number; labels: string[] };
function Chart({ width, height, points, minY, maxY, labels }: ChartProps) {
  if (!labels || labels.length === 0) {
    return <View style={{width, height, justifyContent: 'center', alignItems: 'center'}}><Text>אין נתונים להצגה</Text></View>;
  }
  return (
    <Svg width={width} height={height}>
      {/* Y axis */}
      <Line x1={32} y1={16} x2={32} y2={height - 16} stroke="#ccc" strokeWidth="1" />
      {/* X axis */}
      <Line x1={32} y1={height - 16} x2={width - 16} y2={height - 16} stroke="#ccc" strokeWidth="1" />
      {/* Polyline */}
      <Polyline points={points} fill="none" stroke="#506c4fff" strokeWidth="2" />
      {/* Y labels */}
      <SvgText x={28} y={24} fontSize="10" fill="#666" textAnchor="end">{maxY.toFixed(0)}</SvgText>
      <SvgText x={28} y={height - 18} fontSize="10" fill="#666" textAnchor="end">{minY.toFixed(0)}</SvgText>
      {/* X labels (show only first, last, and middle) */}
      <SvgText x={32} y={height - 4} fontSize="10" fill="#666" textAnchor="start">{labels[0].slice(5, 10)}</SvgText>
      <SvgText x={width / 2} y={height - 4} fontSize="10" fill="#666" textAnchor="middle">{labels[Math.floor(labels.length / 2)].slice(5, 10)}</SvgText>
      <SvgText x={width - 16} y={height - 4} fontSize="10" fill="#666" textAnchor="end">{labels[labels.length - 1].slice(5, 10)}</SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0ecd8ff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f0ecd8ff' },
  loadingText: { fontSize: 18, color: '#506c4fff', marginTop: 16 },
  errorText: { color: '#B91C1C', fontSize: 18, textAlign: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  titleContainer: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  title: { fontSize: 32, fontWeight: '700',marginTop:80, color: '#506c4fff', textAlign: 'right' },
  statsGrid: { flexDirection: 'row',marginTop: 16, flexWrap: 'wrap', justifyContent: 'space-around', marginBottom: 8, paddingHorizontal: 8 },
  statBox: { backgroundColor: '#f0ecd8ff', borderRadius: 12, padding: 16, width: '48%', alignItems: 'center', marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  statValue: { fontSize: 18, fontWeight: '700', color: '#506c4fff' },
  statLabel: { fontSize: 13, color: '#666', marginTop: 2 },
  card: { backgroundColor: '#f0ecd8ff', borderRadius: 14, padding: 16, marginHorizontal: 8, marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 4, textAlign: 'center' },
  chartSubtitle: { fontSize: 13, color: '#666', marginBottom: 8, textAlign: 'right' },
  calendarNav: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  navButton: { padding: 8 },
  calendarWrap: { marginTop: 8, marginBottom: 8, alignItems: 'center' },
  calendarRow: { flexDirection: 'row-reverse', justifyContent: 'space-around', width: '100%' },
  calendarCell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  calendarHeader: { fontWeight: '700', color: '#506c4fff', fontSize: 15 },
  calendarDayText: { fontSize: 15, color: '#333' },
  calendarPurchaseDay: { backgroundColor: '#10b981', width: 32, height: 32, borderRadius: 16 },
  calendarPurchaseDayText: { color: '#f0ecd8ff', fontWeight: '700' },
  productRow: { backgroundColor: '#f0ecd8ff', borderRadius: 10, padding: 8, marginBottom: 4 },
  productName: { fontSize: 16, fontWeight: '700', color: '#506c4fff', marginBottom: 2, textAlign: 'right', writingDirection: 'rtl' },
  productMeta: { fontSize: 13, color: '#666', textAlign: 'right', writingDirection: 'rtl' },
  // Modal Styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContainer: { backgroundColor: '#fffdefff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#506c4fff', marginBottom: 16, textAlign: 'center' },
  modalReceipt: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#eee'
  },
  modalRow: {
      flexDirection: 'row-reverse', // RTL alignment
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
  },
  modalLabel: {
      fontSize: 16,
      color: '#333',
  },
  modalValue: {
      fontSize: 16,
      color: '#666',
      fontWeight: '500'
  },
  modalPrice: {
      color: '#27ae60', // Green color for price
      fontWeight: '700',
  },
  closeButton: { marginTop: 20, backgroundColor: '#506c4fff', borderRadius: 8, padding: 12, alignItems: 'center' },
  closeButtonText: { color: '#f0ecd8ff', fontWeight: '700', fontSize: 16 },
  monthTotalSpent: { fontSize: 16, color: '#506c4fff', fontWeight: '700', textAlign: 'center', marginBottom: 8 },
});
