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
  ShieldAlert,
  CheckCircle2,
  Building,
  Info,
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
  HOSPITALITY_ROLES,
  hasAnyRole,
} from '@/utils/roles';
import { adminGenerateCheckoutQR } from '@/api/admin';

export default function CheckoutQRScreen() {
  const navigation = useAdminNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const { userData } = useUserStore();

  const [qrPayload, setQrPayload] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check elevated permission
  const isAllowed = useMemo(() => {
    return hasAnyRole(userData, [ROLE_ADMIN, ...HOSPITALITY_ROLES]);
  }, [userData]);

  // Fetch or generate QR from backend
  const fetchQR = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminGenerateCheckoutQR();
      if (res && res.qr) {
        setQrPayload(res.qr);
      } else {
        setQrPayload('checkout:all');
      }
    } catch (err: any) {
      console.warn('Failed to generate checkout QR from backend, using fallback:', err);
      setQrPayload('checkout:all');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAllowed) {
      fetchQR();
    }
  }, [isAllowed, fetchQR]);

  // Helper to construct the PDF HTML
  const buildPdfHtml = async (payload: string): Promise<string> => {
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
        <title>Hostel Checkout QR - Saturnalia '26</title>
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
            font-size: 26px;
            font-weight: 600;
            color: #4B5563;
            margin-bottom: 18px;
            letter-spacing: 0.5px;
          }
          .title {
            font-size: 46px;
            font-weight: 800;
            color: #0F172A;
            margin-bottom: 20px;
            letter-spacing: -0.5px;
          }
          .subtitle {
            font-size: 20px;
            font-weight: 500;
            color: #64748B;
            margin-bottom: 48px;
            max-width: 520px;
            line-height: 1.4;
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
          .footer-note {
            margin-top: 48px;
            font-size: 18px;
            font-weight: 600;
            color: #2563EB;
          }
        </style>
      </head>
      <body>
        <div class="date-header">Saturnalia '26 • Hospitality Desk</div>
        <div class="title">Hostel Checkout QR</div>
        <div class="subtitle">Scan this QR with the Saturnalia app to confirm automated checkout and proceed to the gate.</div>
        <div class="qr-wrapper">
          ${svgString}
        </div>
        <div class="footer-note">Valid for all festival days & hostels</div>
      </body>
      </html>
    `;
  };

  // Helper to generate the PDF file on disk
  const createPdfFile = async (): Promise<string> => {
    if (!qrPayload) {
      throw new Error('No QR payload available to export');
    }
    const html = await buildPdfHtml(qrPayload);
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
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const base64Data = await FileSystem.readAsStringAsync(pdfUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const filename = `Saturnalia_Checkout_QR.pdf`;
            const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              filename,
              'application/pdf'
            );
            await FileSystem.writeAsStringAsync(createdFileUri, base64Data, {
              encoding: FileSystem.EncodingType.Base64,
            });
            Alert.alert('Success', 'Hostel Checkout QR PDF saved successfully to your selected folder!');
            return;
          }
        } catch (safErr) {
          console.warn('SAF failed, falling back to share sheet:', safErr);
        }
      }

      // iOS or Android fallback: Share sheet allows "Save to Files"
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Save Saturnalia Checkout QR PDF',
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
          dialogTitle: 'Share Saturnalia Checkout QR PDF',
        });
      } else {
        await Share.share({
          title: 'Saturnalia Hostel Checkout QR',
          message: 'Saturnalia Hostel Checkout QR for all fest days',
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
              Checkout QR
            </Text>
            <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: accentColor }}>
              Automated Hostel Checkout
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={fetchQR}
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
        {/* Info Banner */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 16,
            padding: 16,
            marginBottom: 18,
            borderWidth: 1,
            borderColor: cardBorder,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: 'rgba(65, 184, 240, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Building size={20} color={accentColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: textPrimary }}>
              Hostel Display QR
            </Text>
            <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: textSecondary, marginTop: 2 }}>
              Display or print this QR at hostel reception desks. Attendees scan it to complete automated checkout.
            </Text>
          </View>
        </View>

        {/* QR Code Presentation Box */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 24,
            padding: 24,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: cardBorder,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: isDark ? 0.35 : 0.08,
            shadowRadius: 14,
            elevation: 4,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? '#27272A' : '#F3F4F6',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              marginBottom: 20,
            }}
          >
            <CheckCircle2 size={14} color="#10B981" style={{ marginRight: 6 }} />
            <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: textPrimary }}>
              Universal (Valid All Fest Days)
            </Text>
          </View>

          {/* QR Container */}
          <View
            style={{
              padding: 18,
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              borderWidth: 3,
              borderColor: isDark ? '#3F3F46' : '#E5E7EB',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 6,
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 260,
              minHeight: 260,
            }}
          >
            {loading ? (
              <ActivityIndicator size="large" color={accentColor} />
            ) : qrPayload ? (
              <QRCode
                value={qrPayload}
                size={230}
                color="#000000"
                backgroundColor="#FFFFFF"
                quietZone={6}
              />
            ) : (
              <View style={{ alignItems: 'center', padding: 20 }}>
                <QrIcon size={48} color="#EF4444" />
                <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: '#EF4444', marginTop: 8 }}>
                  Could not load QR
                </Text>
              </View>
            )}
          </View>

          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              fontSize: 16,
              color: textPrimary,
              marginTop: 20,
              textAlign: 'center',
            }}
          >
            Automated Checkout QR
          </Text>
          <Text
            style={{
              fontFamily: 'Poppins_400Regular',
              fontSize: 12,
              color: textSecondary,
              textAlign: 'center',
              marginTop: 4,
              paddingHorizontal: 12,
            }}
          >
            Universal print payload recognized by participant scanner.
          </Text>

          {/* Action Buttons: Download PDF & Share */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' }}>
            {/* Download / Print PDF Button */}
            <TouchableOpacity
              onPress={handleDownloadPdf}
              disabled={exporting || loading || !qrPayload}
              activeOpacity={0.8}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: accentColor,
                paddingVertical: 14,
                borderRadius: 14,
                gap: 8,
              }}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Download size={18} color="#FFFFFF" />
                  <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#FFFFFF' }}>
                    Save PDF
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Share PDF Button */}
            <TouchableOpacity
              onPress={handleSharePdf}
              disabled={exporting || loading || !qrPayload}
              activeOpacity={0.8}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? '#27272A' : '#E5E7EB',
                paddingVertical: 14,
                borderRadius: 14,
                gap: 8,
              }}
            >
              <Share2 size={18} color={textPrimary} />
              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: textPrimary }}>
                Share PDF
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
