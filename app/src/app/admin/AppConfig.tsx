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
  adminGetScreensConfig,
  adminUpdateScreensConfig,
  AppAccommodation,
  AppLinks,
  AppMaintenance,
  AppVersions,
  AdminScreenConfig,
} from '@/api/appConfig';

const DAY_LIST = [
  { key: 'day0', title: 'Day 0', date: '19 Nov (from 8 PM)' },
  { key: 'day1', title: 'Day 1', date: '20 Nov (Thu)' },
  { key: 'day2', title: 'Day 2', date: '21 Nov (Fri)' },
  { key: 'day3', title: 'Day 3', date: '22 Nov (Sat)' },
  { key: 'day4', title: 'Day 4', date: '23 Nov (Sun)' },
];

type TabKey = 'accommodation' | 'maintenance' | 'versions' | 'links' | 'screens';

const ALL_STAFF_ROLES = ['admin', 'eb_events', 'eb_hospitality', 'ec_hospitality', 'eb_outreach', 'eb_finance', 'eb_media', 'event_poc'];

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
    amount: 600,
    price: 600,
    technicalAmount: 600,
    culturalAmount: 500,
    foodAmount: 300,
    technicalFoodAmount: 200,
    culturalFoodAmount: 300,
    technicalDays: { day0: 600, day1: 600, day2: 600, day3: 600, day4: 600 },
    culturalDays: { day0: 500, day1: 500, day2: 500, day3: 500, day4: 500 },
    technicalFoodDays: { day0: 200, day1: 200, day2: 200, day3: 200, day4: 200 },
    culturalFoodDays: { day0: 300, day1: 300, day2: 300, day3: 300, day4: 300 },
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

  const [screens, setScreens] = useState<AdminScreenConfig[]>([]);
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
          amount: data.accommodation.amount || data.accommodation.price || 600,
          price: data.accommodation.amount || data.accommodation.price || 600,
          technicalAmount: data.accommodation.technicalAmount || data.accommodation.amount || 600,
          culturalAmount: data.accommodation.culturalAmount || data.accommodation.amount || 500,
          foodAmount: data.accommodation.foodAmount ?? 300,
          technicalFoodAmount: data.accommodation.technicalFoodAmount ?? data.accommodation.foodAmount ?? 200,
          culturalFoodAmount: data.accommodation.culturalFoodAmount ?? data.accommodation.foodAmount ?? 300,
          technicalDays: data.accommodation.technicalDays || { day0: 600, day1: 600, day2: 600, day3: 600, day4: 600 },
          culturalDays: data.accommodation.culturalDays || { day0: 500, day1: 500, day2: 500, day3: 500, day4: 500 },
          technicalFoodDays: data.accommodation.technicalFoodDays || { day0: 200, day1: 200, day2: 200, day3: 200, day4: 200 },
          culturalFoodDays: data.accommodation.culturalFoodDays || { day0: 300, day1: 300, day2: 300, day3: 300, day4: 300 },
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
      try {
        const screensData = await adminGetScreensConfig();
        if (Array.isArray(screensData) && screensData.length > 0) {
          setScreens(screensData);
        }
      } catch (scErr) {
        console.warn("Could not load screens config:", scErr);
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
    const baseAmount = Number(accommodation.amount || accommodation.technicalAmount || 600);
    const techAmount = Number(accommodation.technicalAmount || baseAmount);
    const cultAmount = Number(accommodation.culturalAmount || baseAmount);
    const baseFood = Number(accommodation.foodAmount ?? 300);
    const techFood = Number(accommodation.technicalFoodAmount ?? baseFood);
    const cultFood = Number(accommodation.culturalFoodAmount ?? baseFood);

    if (baseAmount <= 0 && techAmount <= 0) {
      showAlert('Invalid Input', 'Accommodation per-day amount must be greater than 0');
      return;
    }

    const cleanDays = (map?: Record<string, number | string>, fallback = 0): Record<string, number> => {
      const res: Record<string, number> = {};
      DAY_LIST.forEach((d) => {
        const val = map?.[d.key];
        res[d.key] = val !== undefined && val !== '' ? Number(val) : fallback;
      });
      return res;
    };

    const techDays = cleanDays(accommodation.technicalDays, techAmount);
    const cultDays = cleanDays(accommodation.culturalDays, cultAmount);
    const techFoodDays = cleanDays(accommodation.technicalFoodDays, techFood);
    const cultFoodDays = cleanDays(accommodation.culturalFoodDays, cultFood);

    setSavingTab('accommodation');
    try {
      const updated = await adminUpdateAppAccommodation({
        amount: baseAmount,
        price: baseAmount,
        technicalAmount: techAmount,
        culturalAmount: cultAmount,
        foodAmount: baseFood,
        technicalFoodAmount: techFood,
        culturalFoodAmount: cultFood,
        technicalDays: techDays,
        culturalDays: cultDays,
        technicalFoodDays: techFoodDays,
        culturalFoodDays: cultFoodDays,
      });
      setAccommodation({
        amount: updated.amount,
        price: updated.amount,
        technicalAmount: updated.technicalAmount ?? updated.amount,
        culturalAmount: updated.culturalAmount ?? updated.amount,
        foodAmount: updated.foodAmount ?? baseFood,
        technicalFoodAmount: updated.technicalFoodAmount ?? updated.foodAmount ?? techFood,
        culturalFoodAmount: updated.culturalFoodAmount ?? updated.foodAmount ?? cultFood,
        technicalDays: updated.technicalDays ?? techDays,
        culturalDays: updated.culturalDays ?? cultDays,
        technicalFoodDays: updated.technicalFoodDays ?? techFoodDays,
        culturalFoodDays: updated.culturalFoodDays ?? cultFoodDays,
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

  // Save Admin Screens
  const handleSaveScreens = async () => {
    setSavingTab('screens');
    try {
      const updated = await adminUpdateScreensConfig(screens);
      setScreens(updated);
      showAlert('Saved', 'Admin screen role permissions updated successfully on the backend!');
    } catch (err: any) {
      showAlert('Save Error', err?.message || 'Failed to update admin screen permissions');
    } finally {
      setSavingTab(null);
    }
  };

  const toggleRoleForScreen = (screenKey: string, role: string) => {
    setScreens((prev) =>
      prev.map((s) => {
        if (s.key !== screenKey) return s;
        const exists = s.requiredRoles.includes(role);
        const nextRoles = exists
          ? s.requiredRoles.filter((r) => r !== role)
          : [...s.requiredRoles, role];
        return { ...s, requiredRoles: nextRoles };
      })
    );
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
    { key: 'screens', label: 'Admin Screens', icon: Layers },
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
                        value={
                          accommodation.technicalAmount !== undefined && accommodation.technicalAmount !== null
                            ? String(accommodation.technicalAmount)
                            : ''
                        }
                        onChangeText={(t) => {
                          const cleaned = t.replace(/\D/g, '');
                          setAccommodation((prev) => ({
                            ...prev,
                            technicalAmount: cleaned === '' ? ('' as any) : Number(cleaned),
                          }));
                        }}
                        placeholder="600"
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
                        value={
                          accommodation.culturalAmount !== undefined && accommodation.culturalAmount !== null
                            ? String(accommodation.culturalAmount)
                            : ''
                        }
                        onChangeText={(t) => {
                          const cleaned = t.replace(/\D/g, '');
                          setAccommodation((prev) => ({
                            ...prev,
                            culturalAmount: cleaned === '' ? ('' as any) : Number(cleaned),
                          }));
                        }}
                        placeholder="500"
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
                        value={
                          accommodation.amount !== undefined && accommodation.amount !== null
                            ? String(accommodation.amount)
                            : ''
                        }
                        onChangeText={(t) => {
                          const cleaned = t.replace(/\D/g, '');
                          setAccommodation((prev) => ({
                            ...prev,
                            amount: cleaned === '' ? ('' as any) : Number(cleaned),
                            price: cleaned === '' ? ('' as any) : Number(cleaned),
                          }));
                        }}
                        placeholder="600"
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
                        value={
                          accommodation.technicalFoodAmount !== undefined && accommodation.technicalFoodAmount !== null
                            ? String(accommodation.technicalFoodAmount)
                            : ''
                        }
                        onChangeText={(t) => {
                          const cleaned = t.replace(/\D/g, '');
                          setAccommodation((prev) => ({
                            ...prev,
                            technicalFoodAmount: cleaned === '' ? ('' as any) : Number(cleaned),
                          }));
                        }}
                        placeholder="200"
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
                        value={
                          accommodation.culturalFoodAmount !== undefined && accommodation.culturalFoodAmount !== null
                            ? String(accommodation.culturalFoodAmount)
                            : ''
                        }
                        onChangeText={(t) => {
                          const cleaned = t.replace(/\D/g, '');
                          setAccommodation((prev) => ({
                            ...prev,
                            culturalFoodAmount: cleaned === '' ? ('' as any) : Number(cleaned),
                          }));
                        }}
                        placeholder="300"
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
                        value={
                          accommodation.foodAmount !== undefined && accommodation.foodAmount !== null
                            ? String(accommodation.foodAmount)
                            : ''
                        }
                        onChangeText={(t) => {
                          const cleaned = t.replace(/\D/g, '');
                          setAccommodation((prev) => ({
                            ...prev,
                            foodAmount: cleaned === '' ? ('' as any) : Number(cleaned),
                          }));
                        }}
                        placeholder="300"
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
                      Customize room and meals pricing individually for each festival day.
                    </Text>
                  </View>

                  {/* Day Cards */}
                  {DAY_LIST.map((d) => {
                    const defaultTech = accommodation.technicalAmount || accommodation.amount || 600;
                    const defaultCult = accommodation.culturalAmount || accommodation.amount || 500;
                    const defaultTechFood = accommodation.technicalFoodAmount || accommodation.foodAmount || 200;
                    const defaultCultFood = accommodation.culturalFoodAmount || accommodation.foodAmount || 300;

                    return (
                      <View
                        key={d.key}
                        style={{
                          backgroundColor: isDark ? '#23232D' : '#F9FAFB',
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: cardBorder,
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
                        </View>

                        {/* Room / Stay Row */}
                        <View style={{ gap: 6 }}>
                          <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 11, color: textSecondary, textTransform: 'uppercase' }}>
                            Room / Stay (₹)
                          </Text>
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
                                  value={
                                    accommodation.technicalDays?.[d.key] !== undefined && accommodation.technicalDays?.[d.key] !== null
                                      ? String(accommodation.technicalDays[d.key])
                                      : ''
                                  }
                                  onChangeText={(t) => {
                                    const cleaned = t.replace(/\D/g, '');
                                    setAccommodation((prev) => ({
                                      ...prev,
                                      technicalDays: {
                                        ...(prev.technicalDays || {}),
                                        [d.key]: cleaned === '' ? ('' as any) : Number(cleaned),
                                      },
                                    }));
                                  }}
                                  placeholder={String(defaultTech)}
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
                                  value={
                                    accommodation.culturalDays?.[d.key] !== undefined && accommodation.culturalDays?.[d.key] !== null
                                      ? String(accommodation.culturalDays[d.key])
                                      : ''
                                  }
                                  onChangeText={(t) => {
                                    const cleaned = t.replace(/\D/g, '');
                                    setAccommodation((prev) => ({
                                      ...prev,
                                      culturalDays: {
                                        ...(prev.culturalDays || {}),
                                        [d.key]: cleaned === '' ? ('' as any) : Number(cleaned),
                                      },
                                    }));
                                  }}
                                  placeholder={String(defaultCult)}
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

                        {/* Food Pass / Meals Row */}
                        <View style={{ gap: 6 }}>
                          <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 11, color: textSecondary, textTransform: 'uppercase' }}>
                            Food Pass / Meals (₹)
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            {/* Tech Food Input */}
                            <View style={{ flex: 1, gap: 4 }}>
                              <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 11, color: '#06B6D4' }}>
                                Tech Meals (₹)
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
                                  value={
                                    accommodation.technicalFoodDays?.[d.key] !== undefined && accommodation.technicalFoodDays?.[d.key] !== null
                                      ? String(accommodation.technicalFoodDays[d.key])
                                      : ''
                                  }
                                  onChangeText={(t) => {
                                    const cleaned = t.replace(/\D/g, '');
                                    setAccommodation((prev) => ({
                                      ...prev,
                                      technicalFoodDays: {
                                        ...(prev.technicalFoodDays || {}),
                                        [d.key]: cleaned === '' ? ('' as any) : Number(cleaned),
                                      },
                                    }));
                                  }}
                                  placeholder={String(defaultTechFood)}
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

                            {/* Cult Food Input */}
                            <View style={{ flex: 1, gap: 4 }}>
                              <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 11, color: '#10B981' }}>
                                Cult Meals (₹)
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
                                  value={
                                    accommodation.culturalFoodDays?.[d.key] !== undefined && accommodation.culturalFoodDays?.[d.key] !== null
                                      ? String(accommodation.culturalFoodDays[d.key])
                                      : ''
                                  }
                                  onChangeText={(t) => {
                                    const cleaned = t.replace(/\D/g, '');
                                    setAccommodation((prev) => ({
                                      ...prev,
                                      culturalFoodDays: {
                                        ...(prev.culturalFoodDays || {}),
                                        [d.key]: cleaned === '' ? ('' as any) : Number(cleaned),
                                      },
                                    }));
                                  }}
                                  placeholder={String(defaultCultFood)}
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
                        Technical: Room ₹{accommodation.technicalAmount || accommodation.amount || 600} + Food ₹{accommodation.technicalFoodAmount || accommodation.foodAmount || 200}
                      </Text>
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: textPrimary }}>
                        ₹{(Number(accommodation.technicalAmount || accommodation.amount || 600)) + (Number(accommodation.technicalFoodAmount || accommodation.foodAmount || 200))} / day
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#F59E0B' }}>
                        Cultural: Room ₹{accommodation.culturalAmount || accommodation.amount || 500} + Food ₹{accommodation.culturalFoodAmount || accommodation.foodAmount || 300}
                      </Text>
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: textPrimary }}>
                        ₹{(Number(accommodation.culturalAmount || accommodation.amount || 500)) + (Number(accommodation.culturalFoodAmount || accommodation.foodAmount || 300))} / day
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: textSecondary }}>
                        Base / Default: Room ₹{accommodation.amount || 600} + Food ₹{accommodation.foodAmount || 300}
                      </Text>
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: textPrimary }}>
                        ₹{(Number(accommodation.amount || 600)) + (Number(accommodation.foodAmount || 300))} / day
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: cardBorder, paddingTop: 6 }}>
                      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: textSecondary }}>
                        Base 3 Days Stay (Day 1–3)
                      </Text>
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: textPrimary }}>
                        ₹{((Number(accommodation.amount || 600)) + (Number(accommodation.foodAmount || 300))) * 3}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: textSecondary }}>
                        Base Full 5 Days Stay (Day 0–4)
                      </Text>
                      <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 13, color: accentColor }}>
                        ₹{((Number(accommodation.amount || 600)) + (Number(accommodation.foodAmount || 300))) * 5}
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

            {activeTab === 'screens' && (
              <View style={{ gap: 16 }}>
                <View
                  style={{
                    backgroundColor: cardBg,
                    borderWidth: 1,
                    borderColor: cardBorder,
                    borderRadius: 20,
                    padding: 20,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Layers size={22} color={accentColor} />
                    <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 17, color: textPrimary }}>
                      Admin Screen Role Permissions
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: textSecondary, marginBottom: 16 }}>
                    Configure which roles can view and access each admin screen on the fly. Changes apply immediately to the mobile app drawer without an app update.
                  </Text>

                  {screens.map((screen) => (
                    <View
                      key={screen.key}
                      style={{
                        backgroundColor: isDark ? '#23232D' : '#F9FAFB',
                        borderWidth: 1,
                        borderColor: cardBorder,
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 14,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: textPrimary }}>
                          {screen.label}
                        </Text>
                        <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 11, color: textSecondary }}>
                          {screen.route}
                        </Text>
                      </View>

                      <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 11, color: textSecondary, marginBottom: 8 }}>
                        Allowed Roles:
                      </Text>

                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {ALL_STAFF_ROLES.map((role) => {
                          const isAssigned = screen.requiredRoles.includes(role);
                          return (
                            <TouchableOpacity
                              key={role}
                              onPress={() => toggleRoleForScreen(screen.key, role)}
                              activeOpacity={0.75}
                              style={{
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 10,
                                backgroundColor: isAssigned
                                  ? (role === 'admin' ? '#EF4444' : role.includes('hospitality') ? '#14B8A6' : accentColor)
                                  : isDark ? '#1A1A22' : '#E5E7EB',
                                borderWidth: 1,
                                borderColor: isAssigned ? 'transparent' : cardBorder,
                              }}
                            >
                              <Text
                                style={{
                                  fontFamily: isAssigned ? 'Poppins_600SemiBold' : 'Poppins_400Regular',
                                  fontSize: 12,
                                  color: isAssigned ? '#FFFFFF' : textSecondary,
                                }}
                              >
                                {role}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={handleSaveScreens}
                    disabled={savingTab === 'screens'}
                    style={{
                      backgroundColor: accentColor,
                      paddingVertical: 14,
                      borderRadius: 14,
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 10,
                    }}
                    activeOpacity={0.8}
                  >
                    {savingTab === 'screens' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Save size={18} color="#FFFFFF" />
                        <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', fontSize: 15 }}>
                          Save Screen Permissions
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
