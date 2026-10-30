import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  StatusBar,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  RefreshCw,
  Save,
  Bed,
  Utensils,
  Wrench,
  Smartphone,
  Link2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ShieldAlert,
  Globe,
  Apple,
  Calendar,
} from 'lucide-react-native';
import { useAdminNavigation } from '@/hooks/useAdminNavigation';
import { useThemeStore } from '@/state/themeStore';
import { showAlert } from '@/components';
import {
  adminGetAppConfig,
  adminUpdateAppAccommodation,
  adminUpdateAppLinks,
  adminUpdateAppMaintenance,
  adminUpdateAppVersions,
  AppAccommodation,
  AppLinks,
  AppMaintenance,
  AppVersions,
} from '@/api/appConfig';

const DAY_LIST = [
  { key: 'day0', title: 'Day 0', date: '19 Nov (from 8 PM)' },
  { key: 'day1', title: 'Day 1', date: '20 Nov (Thu)' },
  { key: 'day2', title: 'Day 2', date: '21 Nov (Fri)' },
  { key: 'day3', title: 'Day 3', date: '22 Nov (Sat)' },
  { key: 'day4', title: 'Day 4', date: '23 Nov (Sun)' },
];

type TabKey = 'accommodation' | 'maintenance' | 'versions' | 'links';

export default function AppConfigScreen() {
  const navigation = useAdminNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();

  const [activeTab, setActiveTab] = useState<TabKey>('accommodation');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingTab, setSavingTab] = useState<TabKey | null>(null);

  // Document states
  const [accommodation, setAccommodation] = useState<AppAccommodation>({
    amount: 650,
    price: 650,
    technicalAmount: 650,
    culturalAmount: 650,
    foodAmount: 150,
    technicalFoodAmount: 150,
    culturalFoodAmount: 150,
    technicalDays: { day0: 0, day1: 650, day2: 650, day3: 650, day4: 0 },
    culturalDays: { day0: 0, day1: 650, day2: 650, day3: 650, day4: 0 },
    technicalFoodDays: { day0: 150, day1: 150, day2: 150, day3: 150, day4: 150 },
    culturalFoodDays: { day0: 150, day1: 150, day2: 150, day3: 150, day4: 150 },
  });

  const [maintenance, setMaintenance] = useState<AppMaintenance>({
    android: false,
    ios: false,
    web: false,
  });

  const [versions, setVersions] = useState<AppVersions>({
    android: '1.0.0',
    ios: '1.0.0',
  });

  const [links, setLinks] = useState<AppLinks>({
    appleStore: '',
    playStore: '',
  });

  // Theme tokens
  const bgColor = isDark ? '#121215' : '#F3F4F6';
  const cardBg = isDark ? '#1A1A22' : '#FFFFFF';
  const cardBorder = isDark ? '#272733' : '#E5E7EB';
  const textPrimary = isDark ? '#FFFFFF' : '#111827';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
  const inputBg = isDark ? '#23232D' : '#F9FAFB';
  const accentColor = '#41B8F0';

  const loadConfig = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await adminGetAppConfig();
      if (data.accommodation) {
        setAccommodation({
          amount: data.accommodation.amount || data.accommodation.price || 650,
          price: data.accommodation.amount || data.accommodation.price || 650,
          technicalAmount: data.accommodation.technicalAmount || data.accommodation.amount || 650,
          culturalAmount: data.accommodation.culturalAmount || data.accommodation.amount || 650,
          foodAmount: data.accommodation.foodAmount ?? 150,
          technicalFoodAmount: data.accommodation.technicalFoodAmount ?? data.accommodation.foodAmount ?? 150,
          culturalFoodAmount: data.accommodation.culturalFoodAmount ?? data.accommodation.foodAmount ?? 150,
          technicalDays: data.accommodation.technicalDays || { day0: 0, day1: 650, day2: 650, day3: 650, day4: 0 },
          culturalDays: data.accommodation.culturalDays || { day0: 0, day1: 650, day2: 650, day3: 650, day4: 0 },
          technicalFoodDays: data.accommodation.technicalFoodDays || { day0: 150, day1: 150, day2: 150, day3: 150, day4: 150 },
          culturalFoodDays: data.accommodation.culturalFoodDays || { day0: 150, day1: 150, day2: 150, day3: 150, day4: 150 },
        });
      }
      if (data.maintenance) {
        setMaintenance({
          android: Boolean(data.maintenance.android),
          ios: Boolean(data.maintenance.ios),
          web: Boolean(data.maintenance.web),
        });
      }
      if (data.versions) {
        setVersions({
          android: data.versions.android || '1.0.0',
          ios: data.versions.ios || '1.0.0',
        });
      }
      if (data.links) {
        setLinks({
          appleStore: data.links.appleStore || '',
          playStore: data.links.playStore || '',
        });
      }
    } catch (err: any) {
      console.error('Failed to load app config:', err);
      showAlert('Error', err?.message || 'Failed to load app configuration');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Save Accommodation
  const handleSaveAccommodation = async () => {
    if (accommodation.amount <= 0) {
      showAlert('Invalid Input', 'Accommodation per-day amount must be greater than 0');
      return;
    }
    setSavingTab('accommodation');
    try {
      const updated = await adminUpdateAppAccommodation({
        amount: Number(accommodation.amount || 650),
        price: Number(accommodation.amount || 650),
        technicalAmount: Number(accommodation.technicalAmount || accommodation.amount || 650),
        culturalAmount: Number(accommodation.culturalAmount || accommodation.amount || 650),
        foodAmount: Number(accommodation.foodAmount || 0),
        technicalFoodAmount: Number(accommodation.technicalFoodAmount || accommodation.foodAmount || 0),
        culturalFoodAmount: Number(accommodation.culturalFoodAmount || accommodation.foodAmount || 0),
        technicalDays: accommodation.technicalDays,
        culturalDays: accommodation.culturalDays,
        technicalFoodDays: accommodation.technicalFoodDays,
        culturalFoodDays: accommodation.culturalFoodDays,
      });
      setAccommodation({
        amount: updated.amount,
        price: updated.amount,
        technicalAmount: updated.technicalAmount ?? updated.amount,
        culturalAmount: updated.culturalAmount ?? updated.amount,
        foodAmount: updated.foodAmount ?? 150,
        technicalFoodAmount: updated.technicalFoodAmount ?? updated.foodAmount ?? 150,
        culturalFoodAmount: updated.culturalFoodAmount ?? updated.foodAmount ?? 150,
        technicalDays: updated.technicalDays ?? accommodation.technicalDays,
        culturalDays: updated.culturalDays ?? accommodation.culturalDays,
        technicalFoodDays: updated.technicalFoodDays ?? accommodation.technicalFoodDays,
        culturalFoodDays: updated.culturalFoodDays ?? accommodation.culturalFoodDays,
      });
      showAlert('Saved', 'Accommodation and Food pricing updated successfully!');
    } catch (err: any) {
      showAlert('Save Error', err?.message || 'Failed to update accommodation document');
    } finally {
      setSavingTab(null);
    }
  };

  // Save Maintenance
  const handleSaveMaintenance = async (customMaint?: AppMaintenance) => {
    const toSave = customMaint || maintenance;
    setSavingTab('maintenance');
    try {
      const updated = await adminUpdateAppMaintenance(toSave);
      setMaintenance(updated);
      showAlert('Saved', 'Platform maintenance flags updated successfully!');
    } catch (err: any) {
      showAlert('Save Error', err?.message || 'Failed to update maintenance document');
    } finally {
      setSavingTab(null);
    }
  };

  // Save Versions
  const handleSaveVersions = async () => {
    if (!versions.android.trim() || !versions.ios.trim()) {
      showAlert('Invalid Input', 'Both Android and iOS minimum versions must be provided');
      return;
    }
    setSavingTab('versions');
    try {
      const updated = await adminUpdateAppVersions({
        android: versions.android.trim(),
        ios: versions.ios.trim(),
      });
      setVersions(updated);
      showAlert('Saved', 'App version constraints updated successfully!');
    } catch (err: any) {
      showAlert('Save Error', err?.message || 'Failed to update versions document');
    } finally {
      setSavingTab(null);
    }
  };

  // Save Links
  const handleSaveLinks = async () => {
    setSavingTab('links');
    try {
      const updated = await adminUpdateAppLinks({
        appleStore: links.appleStore.trim(),
        playStore: links.playStore.trim(),
      });
      setLinks(updated);
      showAlert('Saved', 'Store links updated successfully!');
    } catch (err: any) {
      showAlert('Save Error', err?.message || 'Failed to update links document');
    } finally {
      setSavingTab(null);
    }
  };

  const openUrl = async (url: string) => {
    if (!url) {
      showAlert('No URL', 'Please enter a URL first.');
      return;
    }
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
      } else {
        showAlert('Invalid URL', 'Unable to open the provided URL.');
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'Could not open URL');
    }
  };

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'accommodation', label: 'Pricing', icon: Bed },
    { key: 'maintenance', label: 'Maintenance', icon: Wrench },
    { key: 'versions', label: 'Versions', icon: Smartphone },
    { key: 'links', label: 'Links', icon: Link2 },
  ];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: bgColor,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
          backgroundColor: cardBg,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: isDark ? '#23232D' : '#F3F4F6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color={textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 18, color: textPrimary }}>
              App Collection
            </Text>
            <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: textSecondary }}>
              Firestore /app configuration
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => loadConfig(true)}
          disabled={loading || refreshing}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: isDark ? '#23232D' : '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          activeOpacity={0.7}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <RefreshCw size={18} color={textPrimary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs Selector */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: isActive
                    ? accentColor
                    : isDark
                    ? '#1E1E26'
                    : '#FFFFFF',
                  borderWidth: 1,
                  borderColor: isActive ? accentColor : cardBorder,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isActive ? 0.2 : 0.05,
                  shadowRadius: 4,
                  elevation: isActive ? 3 : 1,
                }}
                activeOpacity={0.8}
              >
                <Icon
                  size={16}
                  color={isActive ? '#FFFFFF' : isDark ? '#9CA3AF' : '#4B5563'}
                />
                <Text
                  style={{
                    fontFamily: isActive ? 'Poppins_600SemiBold' : 'Poppins_500Medium',
                    fontSize: 13,
                    color: isActive ? '#FFFFFF' : textPrimary,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={{ fontFamily: 'Poppins_500Medium', color: textSecondary, marginTop: 12 }}>
            Loading app configuration…
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* ─────────────────────────────────────────────────────────────
                1. Accommodation & Food Pricing Tab
               ───────────────────────────────────────────────────────────── */}
            {activeTab === 'accommodation' && (
              <View style={{ gap: 16 }}>
                {/* Info Card */}
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(65, 184, 240, 0.08)' : '#E0F2FE',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(65, 184, 240, 0.2)' : '#BAE6FD',
                    padding: 16,
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <Bed size={22} color={accentColor} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: 'Poppins_600SemiBold',
                        fontSize: 14,
                        color: isDark ? '#E0F2FE' : '#0369A1',
                      }}
                    >
                      Document: app/accommodation
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Poppins_400Regular',
                        fontSize: 12,
                        color: isDark ? '#93C5FD' : '#0284C7',
                        marginTop: 2,
                      }}
                    >
                      Changes apply immediately to user event registration and accommodation passes.
                    </Text>
                  </View>
                </View>

                {/* Form Card */}
                <View
                  style={{
                    backgroundColor: cardBg,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: cardBorder,
                    padding: 20,
                    gap: 20,
                  }}
                >
                  {/* Technical Events Room Charge */}
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Bed size={18} color="#A855F7" />
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: textPrimary }}>
                        Technical Events Accommodation (₹ / day)
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: cardBorder,
                        borderRadius: 14,
                        paddingHorizontal: 14,
                      }}
                    >
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#A855F7', marginRight: 6 }}>
                        ₹
                      </Text>
                      <TextInput
                        value={String(accommodation.technicalAmount ?? accommodation.amount ?? '')}
                        onChangeText={(t) =>
                          setAccommodation((prev) => ({
                            ...prev,
                            technicalAmount: Number(t.replace(/\D/g, '')),
                          }))
                        }
                        placeholder="650"
                        placeholderTextColor={textSecondary}
                        keyboardType="number-pad"
                        style={{
                          flex: 1,
                          height: 48,
                          fontFamily: 'Poppins_600SemiBold',
                          fontSize: 16,
                          color: textPrimary,
                        }}
                      />
                    </View>
                  </View>

                  {/* Cultural Events Room Charge */}
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Bed size={18} color="#F59E0B" />
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: textPrimary }}>
                        Cultural Events Accommodation (₹ / day)
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: cardBorder,
                        borderRadius: 14,
                        paddingHorizontal: 14,
                      }}
                    >
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#F59E0B', marginRight: 6 }}>
                        ₹
                      </Text>
                      <TextInput
                        value={String(accommodation.culturalAmount ?? accommodation.amount ?? '')}
                        onChangeText={(t) =>
                          setAccommodation((prev) => ({
                            ...prev,
                            culturalAmount: Number(t.replace(/\D/g, '')),
                          }))
                        }
                        placeholder="650"
                        placeholderTextColor={textSecondary}
                        keyboardType="number-pad"
                        style={{
                          flex: 1,
                          height: 48,
                          fontFamily: 'Poppins_600SemiBold',
                          fontSize: 16,
                          color: textPrimary,
                        }}
                      />
                    </View>
                  </View>

                  {/* Default / Fallback Room Charge */}
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Bed size={18} color={accentColor} />
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: textPrimary }}>
                        Default / Base Accommodation (₹ / day)
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: cardBorder,
                        borderRadius: 14,
                        paddingHorizontal: 14,
                      }}
                    >
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: accentColor, marginRight: 6 }}>
                        ₹
                      </Text>
                      <TextInput
                        value={String(accommodation.amount ?? '')}
                        onChangeText={(t) =>
                          setAccommodation((prev) => ({
                            ...prev,
                            amount: Number(t.replace(/\D/g, '')),
                            price: Number(t.replace(/\D/g, '')),
                          }))
                        }
                        placeholder="650"
                        placeholderTextColor={textSecondary}
                        keyboardType="number-pad"
                        style={{
                          flex: 1,
                          height: 48,
                          fontFamily: 'Poppins_600SemiBold',
                          fontSize: 16,
                          color: textPrimary,
                        }}
                      />
                    </View>
                  </View>

                  {/* Technical Events Food Pass Price */}
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Utensils size={18} color="#A855F7" />
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: textPrimary }}>
                        Technical Events Food Pass (₹ / day)
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: cardBorder,
                        borderRadius: 14,
                        paddingHorizontal: 14,
                      }}
                    >
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#A855F7', marginRight: 6 }}>
                        ₹
                      </Text>
                      <TextInput
                        value={String(accommodation.technicalFoodAmount ?? accommodation.foodAmount ?? '')}
                        onChangeText={(t) =>
                          setAccommodation((prev) => ({
                            ...prev,
                            technicalFoodAmount: Number(t.replace(/\D/g, '')),
                          }))
                        }
                        placeholder="150"
                        placeholderTextColor={textSecondary}
                        keyboardType="number-pad"
                        style={{
                          flex: 1,
                          height: 48,
                          fontFamily: 'Poppins_600SemiBold',
                          fontSize: 16,
                          color: textPrimary,
                        }}
                      />
                    </View>
                  </View>

                  {/* Cultural Events Food Pass Price */}
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Utensils size={18} color="#F59E0B" />
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: textPrimary }}>
                        Cultural Events Food Pass (₹ / day)
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: cardBorder,
                        borderRadius: 14,
                        paddingHorizontal: 14,
                      }}
                    >
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#F59E0B', marginRight: 6 }}>
                        ₹
                      </Text>
                      <TextInput
                        value={String(accommodation.culturalFoodAmount ?? accommodation.foodAmount ?? '')}
                        onChangeText={(t) =>
                          setAccommodation((prev) => ({
                            ...prev,
                            culturalFoodAmount: Number(t.replace(/\D/g, '')),
                          }))
                        }
                        placeholder="150"
                        placeholderTextColor={textSecondary}
                        keyboardType="number-pad"
                        style={{
                          flex: 1,
                          height: 48,
                          fontFamily: 'Poppins_600SemiBold',
                          fontSize: 16,
                          color: textPrimary,
                        }}
                      />
                    </View>
                  </View>

                  {/* Default Food Pass Charge */}
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Utensils size={18} color="#22c55e" />
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: textPrimary }}>
                        Default / Base Food Pass (₹ / day)
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: cardBorder,
                        borderRadius: 14,
                        paddingHorizontal: 14,
                      }}
                    >
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#22c55e', marginRight: 6 }}>
                        ₹
                      </Text>
                      <TextInput
                        value={String(accommodation.foodAmount ?? '')}
                        onChangeText={(t) =>
                          setAccommodation((prev) => ({
                            ...prev,
                            foodAmount: Number(t.replace(/\D/g, '')),
                          }))
                        }
                        placeholder="150"
                        placeholderTextColor={textSecondary}
                        keyboardType="number-pad"
                        style={{
                          flex: 1,
                          height: 48,
                          fontFamily: 'Poppins_600SemiBold',
                          fontSize: 16,
                          color: textPrimary,
                        }}
                      />
                    </View>
                  </View>

                  {/* Per-Day Breakdown Section Header */}
                  <View style={{ borderTopWidth: 1, borderTopColor: cardBorder, paddingTop: 18, marginTop: 4, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Calendar size={18} color={accentColor} />
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: textPrimary }}>
                        Per-Day Price Breakdown
                      </Text>
                    </View>
                    <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: textSecondary }}>
                      Customize pricing for each festival day. Setting ₹0 makes the day complimentary for participants.
                    </Text>
                  </View>

                  {/* Day Cards */}
                  {DAY_LIST.map((d) => {
                    const techVal = accommodation.technicalDays?.[d.key] ?? accommodation.technicalAmount ?? accommodation.amount ?? 650;
                    const cultVal = accommodation.culturalDays?.[d.key] ?? accommodation.culturalAmount ?? accommodation.amount ?? 650;
                    const isFreeStay = techVal === 0 && cultVal === 0;

                    return (
                      <View
                        key={d.key}
                        style={{
                          backgroundColor: isDark ? '#23232D' : '#F9FAFB',
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: isFreeStay ? (isDark ? 'rgba(34, 197, 94, 0.4)' : '#86EFAC') : cardBorder,
                          padding: 14,
                          gap: 12,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: textPrimary }}>
                              {d.title}
                            </Text>
                            <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: textSecondary }}>
                              • {d.date}
                            </Text>
                          </View>
                          {isFreeStay && (
                            <View style={{ backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#22c55e' }}>
                                Free Stay
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          {/* Tech Room Input */}
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 11, color: '#A855F7' }}>
                              Tech Room (₹)
                            </Text>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: inputBg,
                                borderWidth: 1,
                                borderColor: cardBorder,
                                borderRadius: 10,
                                paddingHorizontal: 10,
                                height: 40,
                              }}
                            >
                              <TextInput
                                value={String(accommodation.technicalDays?.[d.key] ?? '')}
                                onChangeText={(t) => {
                                  const val = t.trim() === '' ? 0 : Number(t.replace(/\D/g, ''));
                                  setAccommodation((prev) => ({
                                    ...prev,
                                    technicalDays: { ...(prev.technicalDays || {}), [d.key]: val },
                                  }));
                                }}
                                placeholder="0"
                                placeholderTextColor={textSecondary}
                                keyboardType="number-pad"
                                style={{
                                  flex: 1,
                                  fontFamily: 'Poppins_600SemiBold',
                                  fontSize: 14,
                                  color: textPrimary,
                                  padding: 0,
                                }}
                              />
                            </View>
                          </View>

                          {/* Cult Room Input */}
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 11, color: '#F59E0B' }}>
                              Cult Room (₹)
                            </Text>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: inputBg,
                                borderWidth: 1,
                                borderColor: cardBorder,
                                borderRadius: 10,
                                paddingHorizontal: 10,
                                height: 40,
                              }}
                            >
                              <TextInput
                                value={String(accommodation.culturalDays?.[d.key] ?? '')}
                                onChangeText={(t) => {
                                  const val = t.trim() === '' ? 0 : Number(t.replace(/\D/g, ''));
                                  setAccommodation((prev) => ({
                                    ...prev,
                                    culturalDays: { ...(prev.culturalDays || {}), [d.key]: val },
                                  }));
                                }}
                                placeholder="0"
                                placeholderTextColor={textSecondary}
                                keyboardType="number-pad"
                                style={{
                                  flex: 1,
                                  fontFamily: 'Poppins_600SemiBold',
                                  fontSize: 14,
                                  color: textPrimary,
                                  padding: 0,
                                }}
                              />
                            </View>
                          </View>

                          {/* Meals Input */}
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 11, color: '#22c55e' }}>
                              Meals (₹)
                            </Text>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: inputBg,
                                borderWidth: 1,
                                borderColor: cardBorder,
                                borderRadius: 10,
                                paddingHorizontal: 10,
                                height: 40,
                              }}
                            >
                              <TextInput
                                value={String(accommodation.technicalFoodDays?.[d.key] ?? accommodation.culturalFoodDays?.[d.key] ?? '')}
                                onChangeText={(t) => {
                                  const val = t.trim() === '' ? 0 : Number(t.replace(/\D/g, ''));
                                  setAccommodation((prev) => ({
                                    ...prev,
                                    technicalFoodDays: { ...(prev.technicalFoodDays || {}), [d.key]: val },
                                    culturalFoodDays: { ...(prev.culturalFoodDays || {}), [d.key]: val },
                                  }));
                                }}
                                placeholder="0"
                                placeholderTextColor={textSecondary}
                                keyboardType="number-pad"
                                style={{
                                  flex: 1,
                                  fontFamily: 'Poppins_600SemiBold',
                                  fontSize: 14,
                                  color: textPrimary,
                                  padding: 0,
                                }}
                              />
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}

                  {/* Pricing Projection Card */}
                  <View
                    style={{
                      backgroundColor: isDark ? '#23232D' : '#F9FAFB',
                      borderRadius: 14,
                      padding: 14,
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: textSecondary, textTransform: 'uppercase' }}>
                      Pricing Preview for Users (Per Day: Room + Food)
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#A855F7' }}>
                        Technical Participant (1 Day)
                      </Text>
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: textPrimary }}>
                        ₹{(accommodation.technicalAmount || accommodation.amount || 0) + (accommodation.technicalFoodAmount || accommodation.foodAmount || 0)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#F59E0B' }}>
                        Cultural Participant (1 Day)
                      </Text>
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: textPrimary }}>
                        ₹{(accommodation.culturalAmount || accommodation.amount || 0) + (accommodation.culturalFoodAmount || accommodation.foodAmount || 0)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: textSecondary }}>
                        Base / Default (1 Day)
                      </Text>
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: textPrimary }}>
                        ₹{(accommodation.amount || 0) + (accommodation.foodAmount || 0)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: cardBorder, paddingTop: 6 }}>
                      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: textSecondary }}>
                        Base 3 Days Stay
                      </Text>
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: textPrimary }}>
                        ₹{((accommodation.amount || 0) + (accommodation.foodAmount || 0)) * 3}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: textSecondary }}>
                        Base Full 5 Days Stay (Day 0–4)
                      </Text>
                      <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 13, color: accentColor }}>
                        ₹{((accommodation.amount || 0) + (accommodation.foodAmount || 0)) * 5}
                      </Text>
                    </View>
                  </View>

                  {/* Save Button */}
                  <TouchableOpacity
                    onPress={handleSaveAccommodation}
                    disabled={savingTab === 'accommodation'}
                    style={{
                      backgroundColor: accentColor,
                      paddingVertical: 14,
                      borderRadius: 14,
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    activeOpacity={0.8}
                  >
                    {savingTab === 'accommodation' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Save size={18} color="#FFFFFF" />
                        <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', fontSize: 15 }}>
                          Save Accommodation Pricing
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ─────────────────────────────────────────────────────────────
                2. Platform Maintenance Tab
               ───────────────────────────────────────────────────────────── */}
            {activeTab === 'maintenance' && (
              <View style={{ gap: 16 }}>
                {/* Warning Banner */}
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEE2E2',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#FECACA',
                    padding: 16,
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <ShieldAlert size={22} color="#EF4444" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: 'Poppins_600SemiBold',
                        fontSize: 14,
                        color: isDark ? '#FCA5A5' : '#B91C1C',
                      }}
                    >
                      Document: app/maintenance
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Poppins_400Regular',
                        fontSize: 12,
                        color: isDark ? '#F87171' : '#DC2626',
                        marginTop: 2,
                      }}
                    >
                      Toggling maintenance on blocks client interaction and displays the maintenance splash screen.
                    </Text>
                  </View>
                </View>

                {/* Platforms List */}
                <View
                  style={{
                    backgroundColor: cardBg,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: cardBorder,
                    padding: 20,
                    gap: 16,
                  }}
                >
                  {/* Android Switch Card */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: inputBg,
                      borderRadius: 14,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: cardBorder,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Smartphone size={24} color={maintenance.android ? '#EF4444' : '#22c55e'} />
                      <View>
                        <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: textPrimary }}>
                          Android Platform
                        </Text>
                        <Text
                          style={{
                            fontFamily: 'Poppins_500Medium',
                            fontSize: 12,
                            color: maintenance.android ? '#EF4444' : '#22c55e',
                          }}
                        >
                          {maintenance.android ? '🔴 In Maintenance' : '🟢 Operational (Live)'}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={maintenance.android}
                      onValueChange={(val) => setMaintenance((prev) => ({ ...prev, android: val }))}
                      trackColor={{ false: '#71717A', true: '#EF4444' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {/* iOS Switch Card */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: inputBg,
                      borderRadius: 14,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: cardBorder,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Smartphone size={24} color={maintenance.ios ? '#EF4444' : '#22c55e'} />
                      <View>
                        <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: textPrimary }}>
                          iOS Platform
                        </Text>
                        <Text
                          style={{
                            fontFamily: 'Poppins_500Medium',
                            fontSize: 12,
                            color: maintenance.ios ? '#EF4444' : '#22c55e',
                          }}
                        >
                          {maintenance.ios ? '🔴 In Maintenance' : '🟢 Operational (Live)'}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={maintenance.ios}
                      onValueChange={(val) => setMaintenance((prev) => ({ ...prev, ios: val }))}
                      trackColor={{ false: '#71717A', true: '#EF4444' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {/* Web Switch Card */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: inputBg,
                      borderRadius: 14,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: cardBorder,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Globe size={24} color={maintenance.web ? '#EF4444' : '#22c55e'} />
                      <View>
                        <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: textPrimary }}>
                          Web Platform
                        </Text>
                        <Text
                          style={{
                            fontFamily: 'Poppins_500Medium',
                            fontSize: 12,
                            color: maintenance.web ? '#EF4444' : '#22c55e',
                          }}
                        >
                          {maintenance.web ? '🔴 In Maintenance' : '🟢 Operational (Live)'}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={maintenance.web}
                      onValueChange={(val) => setMaintenance((prev) => ({ ...prev, web: val }))}
                      trackColor={{ false: '#71717A', true: '#EF4444' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {/* Quick Preset Buttons */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={() => setMaintenance({ android: false, ios: false, web: false })}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: isDark ? '#242430' : '#E5E7EB',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: textPrimary }}>
                        Set All Live
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setMaintenance({ android: true, ios: true, web: true })}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#EF4444' }}>
                        All Maintenance
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Save Button */}
                  <TouchableOpacity
                    onPress={() => handleSaveMaintenance()}
                    disabled={savingTab === 'maintenance'}
                    style={{
                      backgroundColor: accentColor,
                      paddingVertical: 14,
                      borderRadius: 14,
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 6,
                    }}
                    activeOpacity={0.8}
                  >
                    {savingTab === 'maintenance' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Save size={18} color="#FFFFFF" />
                        <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', fontSize: 15 }}>
                          Save Maintenance Status
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ─────────────────────────────────────────────────────────────
                3. App Versions Tab
               ───────────────────────────────────────────────────────────── */}
            {activeTab === 'versions' && (
              <View style={{ gap: 16 }}>
                {/* Info Card */}
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(65, 184, 240, 0.08)' : '#E0F2FE',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(65, 184, 240, 0.2)' : '#BAE6FD',
                    padding: 16,
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <Smartphone size={22} color={accentColor} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: 'Poppins_600SemiBold',
                        fontSize: 14,
                        color: isDark ? '#E0F2FE' : '#0369A1',
                      }}
                    >
                      Document: app/versions
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Poppins_400Regular',
                        fontSize: 12,
                        color: isDark ? '#93C5FD' : '#0284C7',
                        marginTop: 2,
                      }}
                    >
                      Specifies the minimum build versions required. Users with older versions will see the force update prompt.
                    </Text>
                  </View>
                </View>

                {/* Form Card */}
                <View
                  style={{
                    backgroundColor: cardBg,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: cardBorder,
                    padding: 20,
                    gap: 18,
                  }}
                >
                  {/* Android Version */}
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: textPrimary }}>
                      Minimum Android Version
                    </Text>
                    <TextInput
                      value={versions.android}
                      onChangeText={(t) => setVersions((prev) => ({ ...prev, android: t }))}
                      placeholder="e.g. 1.0.0"
                      placeholderTextColor={textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={{
                        backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: cardBorder,
                        borderRadius: 14,
                        paddingHorizontal: 16,
                        height: 50,
                        fontFamily: 'Poppins_500Medium',
                        fontSize: 15,
                        color: textPrimary,
                      }}
                    />
                  </View>

                  {/* iOS Version */}
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: textPrimary }}>
                      Minimum iOS Version
                    </Text>
                    <TextInput
                      value={versions.ios}
                      onChangeText={(t) => setVersions((prev) => ({ ...prev, ios: t }))}
                      placeholder="e.g. 1.0.0"
                      placeholderTextColor={textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={{
                        backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: cardBorder,
                        borderRadius: 14,
                        paddingHorizontal: 16,
                        height: 50,
                        fontFamily: 'Poppins_500Medium',
                        fontSize: 15,
                        color: textPrimary,
                      }}
                    />
                  </View>

                  {/* Version Presets */}
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: textSecondary }}>
                      Common Release Targets:
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {['1.0.0', '1.0.1', '1.1.0', '2.0.0'].map((ver) => (
                        <TouchableOpacity
                          key={ver}
                          onPress={() => setVersions({ android: ver, ios: ver })}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 8,
                            backgroundColor: isDark ? '#242430' : '#F3F4F6',
                          }}
                        >
                          <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: textPrimary }}>
                            {ver}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Save Button */}
                  <TouchableOpacity
                    onPress={handleSaveVersions}
                    disabled={savingTab === 'versions'}
                    style={{
                      backgroundColor: accentColor,
                      paddingVertical: 14,
                      borderRadius: 14,
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 6,
                    }}
                    activeOpacity={0.8}
                  >
                    {savingTab === 'versions' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Save size={18} color="#FFFFFF" />
                        <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', fontSize: 15 }}>
                          Save Version Constraints
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ─────────────────────────────────────────────────────────────
                4. App Store Links Tab
               ───────────────────────────────────────────────────────────── */}
            {activeTab === 'links' && (
              <View style={{ gap: 16 }}>
                {/* Info Card */}
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(65, 184, 240, 0.08)' : '#E0F2FE',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(65, 184, 240, 0.2)' : '#BAE6FD',
                    padding: 16,
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <Link2 size={22} color={accentColor} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: 'Poppins_600SemiBold',
                        fontSize: 14,
                        color: isDark ? '#E0F2FE' : '#0369A1',
                      }}
                    >
                      Document: app/link
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Poppins_400Regular',
                        fontSize: 12,
                        color: isDark ? '#93C5FD' : '#0284C7',
                        marginTop: 2,
                      }}
                    >
                      Destination URLs used for update prompts, sharing Saturnalia 2026, and downloads.
                    </Text>
                  </View>
                </View>

                {/* Form Card */}
                <View
                  style={{
                    backgroundColor: cardBg,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: cardBorder,
                    padding: 20,
                    gap: 20,
                  }}
                >
                  {/* Apple App Store */}
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: textPrimary }}>
                        Apple App Store Link
                      </Text>
                      {Boolean(links.appleStore) && (
                        <TouchableOpacity
                          onPress={() => openUrl(links.appleStore)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                          <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: accentColor }}>
                            Test
                          </Text>
                          <ExternalLink size={12} color={accentColor} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      value={links.appleStore}
                      onChangeText={(t) => setLinks((prev) => ({ ...prev, appleStore: t }))}
                      placeholder="https://apps.apple.com/app/..."
                      placeholderTextColor={textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={{
                        backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: cardBorder,
                        borderRadius: 14,
                        paddingHorizontal: 16,
                        height: 50,
                        fontFamily: 'Poppins_400Regular',
                        fontSize: 14,
                        color: textPrimary,
                      }}
                    />
                  </View>

                  {/* Google Play Store */}
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: textPrimary }}>
                        Google Play Store Link
                      </Text>
                      {Boolean(links.playStore) && (
                        <TouchableOpacity
                          onPress={() => openUrl(links.playStore)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                          <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: accentColor }}>
                            Test
                          </Text>
                          <ExternalLink size={12} color={accentColor} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      value={links.playStore}
                      onChangeText={(t) => setLinks((prev) => ({ ...prev, playStore: t }))}
                      placeholder="https://play.google.com/store/apps/details?id=..."
                      placeholderTextColor={textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={{
                        backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: cardBorder,
                        borderRadius: 14,
                        paddingHorizontal: 16,
                        height: 50,
                        fontFamily: 'Poppins_400Regular',
                        fontSize: 14,
                        color: textPrimary,
                      }}
                    />
                  </View>

                  {/* Save Button */}
                  <TouchableOpacity
                    onPress={handleSaveLinks}
                    disabled={savingTab === 'links'}
                    style={{
                      backgroundColor: accentColor,
                      paddingVertical: 14,
                      borderRadius: 14,
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 6,
                    }}
                    activeOpacity={0.8}
                  >
                    {savingTab === 'links' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Save size={18} color="#FFFFFF" />
                        <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', fontSize: 15 }}>
                          Save Store Links
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
