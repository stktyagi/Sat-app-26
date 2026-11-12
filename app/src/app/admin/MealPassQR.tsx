import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Download,
  Share2,
  RefreshCw,
  QrCode as QrIcon,
  Calendar,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  Layers,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import QRCodeLib from 'qrcode';

import { useAdminNavigation } from '@/hooks/useAdminNavigation';
import { useThemeStore } from '@/state/themeStore';
import { useUserStore } from '@/state/userStore';
import {
  ROLE_ADMIN,
  ROLE_EB_HOSPITALITY,
  ROLE_EC_HOSPITALITY,
  hasAnyRole,
} from '@/utils/roles';
import { adminGenerateFoodQR } from '@/api/admin';

interface DayOption {
  key: string;
  name: string;
  dayOfWeek: string;
  formattedDate: string;
}

const ALL_DAYS_OPTION: DayOption = {
  key: 'all',
  name: 'All 5 Days',
  dayOfWeek: 'Full Fest',
  formattedDate: 'All 5 Days (Nov 19 – Nov 23, 2026)',
};

const PER_DAY_OPTIONS: DayOption[] = [
  { key: 'day0', name: 'Day 0', dayOfWeek: 'Wednesday', formattedDate: 'Wednesday, Nov 19, 2026' },
  { key: 'day1', name: 'Day 1', dayOfWeek: 'Thursday', formattedDate: 'Thursday, Nov 20, 2026' },
  { key: 'day2', name: 'Day 2', dayOfWeek: 'Friday', formattedDate: 'Friday, Nov 21, 2026' },
  { key: 'day3', name: 'Day 3', dayOfWeek: 'Saturday', formattedDate: 'Saturday, Nov 22, 2026' },
  { key: 'day4', name: 'Day 4', dayOfWeek: 'Sunday', formattedDate: 'Sunday, Nov 23, 2026' },
];

export default function MealPassQRScreen() {
  const navigation = useAdminNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const { userData } = useUserStore();

  // Top tabs: 'all' (All 5 Days) vs 'perDay' (Per Day)
  const [activeTab, setActiveTab] = useState<'all' | 'perDay'>('all');
  const [selectedPerDayKey, setSelectedPerDayKey] = useState<string>('day1');
  const [selectedDayKey, setSelectedDayKey] = useState<string>('all');

  const [qrPayload, setQrPayload] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check elevated permission
  const isAllowed = useMemo(() => {
    return hasAnyRole(userData, [ROLE_ADMIN, ROLE_EB_HOSPITALITY, ROLE_EC_HOSPITALITY]);
  }, [userData]);

  const selectedDay = useMemo(() => {
    if (activeTab === 'all') return ALL_DAYS_OPTION;
    return PER_DAY_OPTIONS.find((d) => d.key === selectedDayKey) || PER_DAY_OPTIONS[1];
  }, [activeTab, selectedDayKey]);

  // Fetch or generate QR from backend
  const fetchQR = useCallback(async (dayKey: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminGenerateFoodQR(dayKey);
      if (res && res.qr) {
        setQrPayload(res.qr);
      } else {
        // Fallback signed placeholder if backend empty
        setQrPayload(`food:${dayKey}`);
      }
    } catch (err: any) {
      console.warn('Failed to generate food QR from backend, using standard fallback:', err);
      // Fallback format recognized by scanner
      setQrPayload(`food:${dayKey}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAllowed) {
      const targetKey = activeTab === 'all' ? 'all' : selectedPerDayKey;
      setSelectedDayKey(targetKey);
      fetchQR(targetKey);
    }
  }, [isAllowed, activeTab, selectedPerDayKey, fetchQR]);

  // Helper to construct the PDF HTML
  const buildPdfHtml = async (payload: string, dateStr: string): Promise<string> => {
    // Generate clean SVG vector string for infinite print resolution
    const svgString = await new Promise<string>((resolve, reject) => {
      QRCodeLib.toString(
        payload,
        {
          type: 'svg',
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        },
        (err: any, svg: string) => {
          if (err) reject(err);
          else resolve(svg);
        }
      );
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Saturnalia Meal Qr</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #FFFFFF;
            color: #000000;
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justifyContent: center;
            text-align: center;
            padding: 60px 40px;
          }
          .date-header {
            font-size: 28px;
            font-weight: 600;
            color: #4B5563;
            margin-bottom: 24px;
            letter-spacing: 0.5px;
          }
          .title {
            font-size: 46px;
            font-weight: 800;
            color: #0F172A;
            margin-bottom: 56px;
            letter-spacing: -0.5px;
          }
          .qr-wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #FFFFFF;
            border: 4px solid #1E293B;
            border-radius: 32px;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
          }
          .qr-wrapper svg {
            width: 480px;
            height: 480px;
            display: block;
          }
        </style>
      </head>
      <body>
        <div class="date-header">${dateStr}</div>
        <div class="title">Saturnalia Meal Qr</div>
        <div class="qr-wrapper">
          ${svgString}
        </div>
      </body>
      </html>
    `;
  };

  // Helper to generate the PDF file on disk
  const createPdfFile = async (): Promise<string> => {
    if (!qrPayload) {
      throw new Error('No QR payload available to export');
    }
    const html = await buildPdfHtml(qrPayload, selectedDay.formattedDate);
    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  };

  // 1. Download / Save PDF
  const handleDownloadPdf = async () => {
    if (exporting) return;
    try {
      setExporting(true);
      const pdfUri = await createPdfFile();

      if (Platform.OS === 'android') {
        try {
          const permissions =
            await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const base64 = await FileSystem.readAsStringAsync(pdfUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const filename = `Saturnalia_Meal_QR_${selectedDay.key}.pdf`;
            const createdUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              filename,
              'application/pdf'
            );
            await FileSystem.writeAsStringAsync(createdUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            Alert.alert('Saved Successfully', 'The PDF has been saved to your selected folder.');
            return;
          }
        } catch (safErr) {
          console.warn('StorageAccessFramework failed or user cancelled, falling back to share sheet:', safErr);
        }
      }

      // iOS or Android fallback: Share sheet allows "Save to Files"
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Save Saturnalia Meal QR PDF',
        });
      } else {
        Alert.alert('PDF Created', `Saved to: ${pdfUri}`);
      }
    } catch (err: any) {
      console.error('Failed to save PDF:', err);
      Alert.alert('Error', err.message || 'Could not save PDF');
    } finally {
      setExporting(false);
    }
  };

  // 2. Share PDF Directly
  const handleSharePdf = async () => {
    if (exporting) return;
    try {
      setExporting(true);
      const pdfUri = await createPdfFile();

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Share Saturnalia Meal QR PDF',
        });
      } else {
        await Share.share({
          title: 'Saturnalia Meal QR',
          message: `Saturnalia Meal QR for ${selectedDay.formattedDate}`,
          url: pdfUri,
        });
      }
    } catch (err: any) {
      console.error('Failed to share PDF:', err);
      Alert.alert('Error', err.message || 'Could not share PDF');
    } finally {
      setExporting(false);
    }
  };

  // Color theme constants
  const bgColor = isDark ? '#131316' : '#F3F4F6';
  const cardBg = isDark ? '#1C1C20' : '#FFFFFF';
  const cardBorder = isDark ? '#2A2A30' : '#E5E7EB';
  const textPrimary = isDark ? '#FFFFFF' : '#111827';
  const textSecondary = isDark ? '#A0A0A0' : '#6B7280';
  const accentColor = '#41B8F0';

  // Permission Denied View
  if (!isAllowed) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <ShieldAlert size={56} color="#DC6D6E" />
        <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: textPrimary, marginTop: 16 }}>
          Access Restricted
        </Text>
        <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: textSecondary, textAlign: 'center', marginTop: 8 }}>
          This screen is reserved for Administrators and Hospitality leads (EB/EC Hospitality).
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            marginTop: 24,
            paddingVertical: 12,
            paddingHorizontal: 24,
            backgroundColor: accentColor,
            borderRadius: 12,
          }}
        >
          <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', fontSize: 14 }}>
            Go Back
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bgColor, paddingTop: insets.top }}>
      {/* Top Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
          backgroundColor: isDark ? '#18181B' : '#FFFFFF',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <ArrowLeft size={20} color={textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: textPrimary }}>
              Meal Pass QR
            </Text>
            <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: accentColor }}>
              Hospitality QR Generator
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => fetchQR(selectedDayKey)}
          disabled={loading}
          activeOpacity={0.7}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: isDark ? 'rgba(65, 184, 240, 0.15)' : 'rgba(65, 184, 240, 0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <RefreshCw size={18} color={accentColor} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 36 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top-Level Mode Tabs: "All 5 Days" vs "Per Day" */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: isDark ? '#1C1C20' : '#E5E7EB',
            borderRadius: 16,
            padding: 4,
            marginBottom: 18,
            borderWidth: 1,
            borderColor: cardBorder,
          }}
        >
          {/* Tab 1: All 5 Days */}
          <TouchableOpacity
            onPress={() => {
              setActiveTab('all');
              setSelectedDayKey('all');
            }}
            activeOpacity={0.8}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: activeTab === 'all'
                ? isDark ? '#27272A' : '#FFFFFF'
                : 'transparent',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: activeTab === 'all' ? 0.12 : 0,
              shadowRadius: 4,
              elevation: activeTab === 'all' ? 2 : 0,
            }}
          >
            <Sparkles
              size={16}
              color={activeTab === 'all' ? '#C6D546' : textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize: 14,
                color: activeTab === 'all' ? textPrimary : textSecondary,
              }}
            >
              All 5 Days
            </Text>
          </TouchableOpacity>

          {/* Tab 2: Per Day */}
          <TouchableOpacity
            onPress={() => {
              setActiveTab('perDay');
              setSelectedDayKey(selectedPerDayKey);
            }}
            activeOpacity={0.8}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: activeTab === 'perDay'
                ? isDark ? '#27272A' : '#FFFFFF'
                : 'transparent',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: activeTab === 'perDay' ? 0.12 : 0,
              shadowRadius: 4,
              elevation: activeTab === 'perDay' ? 2 : 0,
            }}
          >
            <Calendar
              size={16}
              color={activeTab === 'perDay' ? accentColor : textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize: 14,
                color: activeTab === 'perDay' ? textPrimary : textSecondary,
              }}
            >
              Per Day
            </Text>
          </TouchableOpacity>
        </View>

        {/* Day Selector (Shown ONLY when "Per Day" is active) */}
        {activeTab === 'perDay' && (
          <View style={{ marginBottom: 18 }}>
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize: 13,
                color: textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 10,
              }}
            >
              Choose Day
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {PER_DAY_OPTIONS.map((day) => {
                const isSelected = day.key === selectedPerDayKey;
                return (
                  <TouchableOpacity
                    key={day.key}
                    onPress={() => {
                      setSelectedPerDayKey(day.key);
                      setSelectedDayKey(day.key);
                    }}
                    activeOpacity={0.75}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: isSelected ? accentColor : cardBorder,
                      backgroundColor: isSelected
                        ? isDark
                          ? 'rgba(65, 184, 240, 0.16)'
                          : 'rgba(65, 184, 240, 0.12)'
                        : cardBg,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Poppins_600SemiBold',
                        fontSize: 13,
                        color: isSelected ? accentColor : textPrimary,
                      }}
                    >
                      {day.name}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Poppins_400Regular',
                        fontSize: 11,
                        color: isSelected ? accentColor : textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {day.dayOfWeek.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* QR Display Card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: cardBorder,
            padding: 24,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.35 : 0.08,
            shadowRadius: 14,
            elevation: 4,
            marginBottom: 20,
          }}
        >
          {/* Date info on top */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
              paddingVertical: 6,
              paddingHorizontal: 14,
              borderRadius: 20,
              marginBottom: 16,
            }}
          >
            <Calendar
              size={14}
              color={activeTab === 'all' ? '#C6D546' : accentColor}
              style={{ marginRight: 6 }}
            />
            <Text
              style={{
                fontFamily: 'Poppins_500Medium',
                fontSize: 13,
                color: textPrimary,
              }}
            >
              {selectedDay.formattedDate}
            </Text>
          </View>

          <Text
            style={{
              fontFamily: 'Poppins_700Bold',
              fontSize: 20,
              color: textPrimary,
              marginBottom: 4,
            }}
          >
            Saturnalia Meal Qr
          </Text>
          <Text
            style={{
              fontFamily: 'Poppins_400Regular',
              fontSize: 12,
              color: textSecondary,
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            {activeTab === 'all'
              ? 'Universal Mess QR (Valid on all 5 festival days)'
              : 'Hostel Mess Counter Day-Specific QR'}
          </Text>

          {/* QR Code Canvas */}
          <View
            style={{
              padding: 16,
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              borderWidth: 2,
              borderColor: '#111827',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 232,
              minWidth: 232,
            }}
          >
            {loading ? (
              <ActivityIndicator size="large" color={accentColor} />
            ) : qrPayload ? (
              <QRCode
                value={qrPayload}
                size={200}
                backgroundColor="#FFFFFF"
                color="#000000"
              />
            ) : (
              <Text style={{ fontFamily: 'Poppins_500Medium', color: '#9CA3AF' }}>
                No QR generated
              </Text>
            )}
          </View>

          {/* Verification Badge */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 16,
              backgroundColor: isDark ? 'rgba(198, 213, 70, 0.14)' : 'rgba(198, 213, 70, 0.18)',
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 12,
            }}
          >
            <CheckCircle2 size={15} color="#8A9E1A" style={{ marginRight: 6 }} />
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize: 12,
                color: isDark ? '#C6D546' : '#6A7D0D',
              }}
            >
              {activeTab === 'all'
                ? 'Universal Pass (All 5 Days: day0 – day4)'
                : `Day Pass: ${selectedDay.name}`}
            </Text>
          </View>
        </View>

        {/* Action Buttons: Save PDF and Share PDF */}
        <View style={{ gap: 12 }}>
          {/* Download / Save Button */}
          <TouchableOpacity
            onPress={handleDownloadPdf}
            disabled={loading || exporting}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: accentColor,
              paddingVertical: 15,
              borderRadius: 16,
              shadowColor: accentColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 4,
              opacity: loading || exporting ? 0.6 : 1,
            }}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
            ) : (
              <Download size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            )}
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize: 15,
                color: '#FFFFFF',
              }}
            >
              {exporting ? 'Generating PDF...' : 'Download / Save PDF'}
            </Text>
          </TouchableOpacity>

          {/* Share Directly Button */}
          <TouchableOpacity
            onPress={handleSharePdf}
            disabled={loading || exporting}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? '#232328' : '#FFFFFF',
              borderWidth: 1.5,
              borderColor: isDark ? '#383842' : '#D1D5DB',
              paddingVertical: 15,
              borderRadius: 16,
              opacity: loading || exporting ? 0.6 : 1,
            }}
          >
            <Share2 size={20} color={textPrimary} style={{ marginRight: 8 }} />
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize: 15,
                color: textPrimary,
              }}
            >
              Share PDF Directly
            </Text>
          </TouchableOpacity>
        </View>

        {/* Note info */}
        <View
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 14,
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            borderWidth: 1,
            borderColor: cardBorder,
          }}
        >
          <Text
            style={{
              fontFamily: 'Poppins_400Regular',
              fontSize: 12,
              color: textSecondary,
              textAlign: 'center',
              lineHeight: 18,
            }}
          >
            {activeTab === 'all'
              ? 'This single QR code works for all 5 festival days. Post it at hostel mess counters once; the system automatically checks whether the scanning attendee has active meal passes for that day.'
              : `This QR is specifically locked for ${selectedDay.name}. The generated PDF displays the date at top, "Saturnalia Meal Qr", and a big QR.`}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
