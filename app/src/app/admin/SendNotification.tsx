// src/screens/Admin/SendNotification.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { showAlert } from '@/components';
import { useAdminNavigation } from '@/hooks/useAdminNavigation';
import { Ionicons } from '@expo/vector-icons';
import {
  ArrowLeft,
  Bell,
  Send,
  TestTube,
  Clock,
  Users,
  Filter,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  UserCheck,
  X,
} from 'lucide-react-native';
import { searchUsers } from '@/api/admin';
import { getToken } from '@/api/auth';
import { API_BASE_URL } from '@/config/api';
import { useThemeStore } from '@/state/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TargetMode = 'broadcast' | 'roles' | 'users' | 'filter';

type PickedUser = { userId: string; displayName: string; email: string };

const parseEmails = (raw: string) =>
  Array.from(new Set(raw.split(/[\s,;]+/).map((e) => e.trim()).filter((e) => e.includes('@'))));

const AVAILABLE_ROLES = [
  { id: 'admin', label: 'Admin / Core EC' },
  { id: 'core_hospitality', label: 'Core Hospitality' },
  { id: 'eb_hospitality', label: 'EB Hospitality' },
  { id: 'ec_hospitality', label: 'EC Hospitality' },
  { id: 'eb_events', label: 'EB Events' },
  { id: 'event_poc', label: 'Event Coordinators / POC' },
  { id: 'eb_outreach', label: 'EB Outreach' },
  { id: 'eb_finance', label: 'EB Finance' },
  { id: 'eb_media', label: 'EB Media' },
];

const SendNotification = () => {
  const navigation = useAdminNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();

  const [targetMode, setTargetMode] = useState<TargetMode>('broadcast');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [topic, setTopic] = useState('all');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['core_hospitality']);
  const [filterType, setFilterType] = useState<'checkoutDueToday' | 'inHouse' | 'hasAccommodation'>('checkoutDueToday');
  
  const [pickedUsers, setPickedUsers] = useState<PickedUser[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<PickedUser[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [emailsText, setEmailsText] = useState('');

  const [sending, setSending] = useState(false);
  const [runningSummary, setRunningSummary] = useState(false);

  const bgColor = isDark ? "#131316" : "#E0E0E0";
  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "#2A2A30" : "#D5D5D5";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#A0A0A0" : "#6B7280";

  const NOTIFICATION_API = `${API_BASE_URL}/admin/notifications`;

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const handleSearchUsers = async () => {
    if (!userQuery.trim()) return;
    setSearchingUsers(true);
    try {
      const results = await searchUsers(userQuery);
      setUserResults(
        (results || [])
          .filter((u: any) => u.userId)
          .map((u: any) => ({ userId: u.userId, displayName: u.displayName || '', email: u.email || '' }))
      );
    } catch {
      setUserResults([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  const togglePickedUser = (u: PickedUser) => {
    setPickedUsers((prev) =>
      prev.some((p) => p.userId === u.userId) ? prev.filter((p) => p.userId !== u.userId) : [...prev, u]
    );
  };

  const handleSendNotification = async () => {
    if (!title.trim() || !body.trim()) {
      showAlert('Error', 'Please enter both title and message');
      return;
    }

    if (targetMode === 'roles' && selectedRoles.length === 0) {
      showAlert('Error', 'Please select at least one role to target');
      return;
    }

    const pastedEmails = parseEmails(emailsText);
    if (targetMode === 'users' && pickedUsers.length === 0 && pastedEmails.length === 0) {
      showAlert('Error', 'Pick at least one user or paste some emails');
      return;
    }

    const token = await getToken();

    let targetDesc = '';
    if (targetMode === 'broadcast') {
      targetDesc = `Topic: ${topic}`;
    } else if (targetMode === 'roles') {
      targetDesc = `Roles: ${selectedRoles.join(', ')}`;
    } else if (targetMode === 'users') {
      targetDesc = `${pickedUsers.length + pastedEmails.length} specific user(s)`;
    } else {
      targetDesc = `Filter: ${filterType === 'checkoutDueToday' ? 'Guests checking out today' : filterType === 'inHouse' ? 'All In-House guests' : 'All guests with accommodation'}`;
    }

    showAlert(
      'Send Notification',
      `Send notification to ${targetDesc}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              setSending(true);

              const payload: any = {
                title: title.trim(),
                body: body.trim(),
              };

              if (targetMode === 'broadcast') {
                payload.audience = topic;
              } else if (targetMode === 'roles') {
                payload.audience = 'roles';
                payload.roles = selectedRoles;
              } else if (targetMode === 'users') {
                payload.audience = 'users';
                payload.userIds = pickedUsers.map((u) => u.userId);
                payload.emails = pastedEmails;
              } else if (targetMode === 'filter') {
                payload.audience = 'filter';
                payload.filter = {
                  hasAccommodation: filterType === 'hasAccommodation',
                  inHouse: filterType === 'inHouse',
                  checkoutDueToday: filterType === 'checkoutDueToday',
                };
              }

              const response = await fetch(NOTIFICATION_API, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
              });

              const responseData = await response.json().catch(() => ({} as any));

              if (response.ok) {
                const lines = [responseData.message || 'Notification sent successfully!'];
                if (typeof responseData.recipientCount === 'number') {
                  lines.push(
                    '',
                    `• Users reached: ${responseData.recipientCount}`,
                    `• Devices delivered: ${responseData.deliveredCount ?? 0}`,
                    `• Failed: ${responseData.failedCount ?? 0}`
                  );
                }
                if (Array.isArray(responseData.unmatched) && responseData.unmatched.length > 0) {
                  lines.push('', `Not found: ${responseData.unmatched.join(', ')}`);
                }
                showAlert('Success 🎉', lines.join('\n'));
                setTitle('');
                setBody('');
              } else {
                throw new Error(
                  responseData?.error?.message || responseData?.message || 'Failed to send notification'
                );
              }
            } catch (error: any) {
              showAlert('Error', error.message || 'Failed to send notification. Please try again.');
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  // Trigger automated daily hospitality summary manually
  const handleTriggerDailySummary = async () => {
    const token = await getToken();

    showAlert(
      'Trigger 10 PM Hospitality Summary',
      'This will calculate incoming guests for tomorrow and outgoing checkouts for today, notifying Core/EC/EB Hospitality staff and reminding outgoing guests. Run now?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Daily Summary',
          onPress: async () => {
            setRunningSummary(true);
            try {
              const res = await fetch(`${API_BASE_URL}/admin/notifications/hospitality-summary`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
              });

              const data = await res.json();
              if (res.ok) {
                const s = data.data || {};
                showAlert(
                  'Daily Summary Dispatched! 🚀',
                  `Report sent successfully!\n\n• Incoming Tomorrow: ${s.incomingTomorrow ?? 0}\n• Outgoing Today: ${s.outgoingToday ?? 0}\n• Staff & Admins Notified: ${s.staffNotified ?? 0}\n• Attendees Notified: ${s.attendeesNotified ?? 0}`
                );
              } else {
                throw new Error(data?.error?.message || data?.message || 'Could not trigger summary');
              }
            } catch (e: any) {
              showAlert('Trigger Failed', e.message || 'Could not trigger daily summary');
            } finally {
              setRunningSummary(false);
            }
          },
        },
      ]
    );
  };

  const handleTestNotification = () => {
    if (!title.trim() || !body.trim()) {
      showAlert('Error', 'Please enter both title and message to test');
      return;
    }

    showAlert(
      'Test Preview',
      `Title: ${title}\nMessage: ${body}\nTarget Mode: ${targetMode}`,
      [{ text: 'OK' }]
    );
  };

  const topicOptions = [
    { label: 'All Users', value: 'all', description: 'Sends to all registered app users' },
    { label: 'Host College Students', value: 'host', description: 'Sends only to host college students' },
    { label: 'Visiting Students', value: 'outside', description: 'Sends to outside participants only' },
    { label: 'All Hospitality Staff', value: 'hospitality_staff', description: 'Sends to Admins + EB, EC & Core Hospitality' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 16,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
          backgroundColor: bgColor,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.navigate("Dashboard")}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.06)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: "Talina",
              fontSize: 22,
              color: textPrimary,
              letterSpacing: 0.5,
            }}
          >
            Push Notifications
          </Text>
          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              fontSize: 12,
              color: "#41B8F0",
              marginTop: 1,
            }}
          >
            Automated schedules & custom targeted dispatch
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Automated Daily Hospitality 10 PM Card */}
        <View
          style={{
            backgroundColor: isDark ? "rgba(65, 184, 240, 0.08)" : "#E0F2FE",
            borderWidth: 1,
            borderColor: isDark ? "rgba(65, 184, 240, 0.25)" : "#BAE6FD",
            borderRadius: 18,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Clock size={20} color="#0284C7" />
              <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 15, color: isDark ? "#E0F2FE" : "#0369A1" }}>
                Daily 10:00 PM Automation
              </Text>
            </View>
            <View style={{ backgroundColor: "#22c55e20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
              <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 11, color: "#16a34a" }}>
                Active
              </Text>
            </View>
          </View>

          <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: isDark ? "#BAE6FD" : "#0369A1", lineHeight: 18, marginBottom: 12 }}>
            Every night at 10:00 PM IST, the backend automatically calculates incoming arrivals for tomorrow and checkouts due today. It notifies Admins, Core, EC, and EB Hospitality staff and sends a checkout reminder to departing attendees.
          </Text>

          <TouchableOpacity
            onPress={handleTriggerDailySummary}
            disabled={runningSummary}
            activeOpacity={0.8}
            style={{
              backgroundColor: "#0284C7",
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {runningSummary ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <RefreshCw size={15} color="#FFFFFF" />
                <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", fontSize: 13 }}>
                  Trigger Daily Summary Now
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Section Heading */}
        <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 16, color: textPrimary, marginBottom: 12 }}>
          Send One-Time Notification
        </Text>

        {/* Mode Selector Tabs */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {[
            { key: 'broadcast', label: 'Broadcast', icon: Bell },
            { key: 'roles', label: 'Roles', icon: Users },
            { key: 'users', label: 'Users', icon: UserCheck },
            { key: 'filter', label: 'Filter', icon: Filter },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = targetMode === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setTargetMode(tab.key as TargetMode)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: isSelected ? "#41B8F0" : cardBg,
                  borderWidth: 1,
                  borderColor: isSelected ? "#41B8F0" : cardBorder,
                }}
                activeOpacity={0.8}
              >
                <Icon size={14} color={isSelected ? "#FFFFFF" : textSecondary} />
                <Text
                  style={{
                    fontFamily: isSelected ? "Poppins_600SemiBold" : "Poppins_500Medium",
                    fontSize: 12,
                    color: isSelected ? "#FFFFFF" : textPrimary,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Target: Broadcast Mode */}
        {targetMode === 'broadcast' && (          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 13, marginBottom: 8 }}>
              Select Broadcast Audience
            </Text>
            {topicOptions.map((option) => {
              const isSelected = topic === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 14,
                    borderRadius: 14,
                    marginBottom: 8,
                    backgroundColor: isSelected ? (isDark ? "rgba(65, 184, 240, 0.15)" : "#E0F2FE") : cardBg,
                    borderWidth: 1,
                    borderColor: isSelected ? "#41B8F0" : cardBorder,
                  }}
                  onPress={() => setTopic(option.value)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isSelected ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={isSelected ? "#41B8F0" : textSecondary}
                  />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ fontFamily: "Poppins_600SemiBold", color: isSelected ? "#41B8F0" : textPrimary, fontSize: 13 }}>
                      {option.label}
                    </Text>
                    <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 11 }}>
                      {option.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Target: Role Mode */}
        {targetMode === 'roles' && (
          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 13, marginBottom: 8 }}>
              Select Roles to Target (Multi-select)
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {AVAILABLE_ROLES.map((role) => {
                const isSelected = selectedRoles.includes(role.id);
                return (
                  <TouchableOpacity
                    key={role.id}
                    onPress={() => toggleRole(role.id)}
                    activeOpacity={0.75}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 10,
                      backgroundColor: isSelected ? "#41B8F0" : cardBg,
                      borderWidth: 1,
                      borderColor: isSelected ? "#41B8F0" : cardBorder,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {isSelected && <CheckCircle2 size={12} color="#FFFFFF" />}
                    <Text
                      style={{
                        fontFamily: isSelected ? "Poppins_600SemiBold" : "Poppins_400Regular",
                        fontSize: 12,
                        color: isSelected ? "#FFFFFF" : textPrimary,
                      }}
                    >
                      {role.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Target: Specific Users Mode */}
        {targetMode === 'users' && (
          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 13, marginBottom: 8 }}>
              Search Users
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: cardBg,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: textPrimary,
                  borderWidth: 1,
                  borderColor: cardBorder,
                  fontFamily: "Poppins_400Regular",
                  fontSize: 13,
                }}
                placeholder="Name, email or phone"
                placeholderTextColor={textSecondary}
                value={userQuery}
                onChangeText={setUserQuery}
                onSubmitEditing={handleSearchUsers}
                returnKeyType="search"
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={handleSearchUsers}
                disabled={searchingUsers}
                activeOpacity={0.8}
                style={{ backgroundColor: "#41B8F0", borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" }}
              >
                {searchingUsers ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", fontSize: 13 }}>Search</Text>
                )}
              </TouchableOpacity>
            </View>

            {userResults.map((u) => {
              const isSelected = pickedUsers.some((p) => p.userId === u.userId);
              return (
                <TouchableOpacity
                  key={u.userId}
                  onPress={() => togglePickedUser(u)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 12,
                    marginBottom: 6,
                    backgroundColor: isSelected ? (isDark ? "rgba(65, 184, 240, 0.15)" : "#E0F2FE") : cardBg,
                    borderWidth: 1,
                    borderColor: isSelected ? "#41B8F0" : cardBorder,
                  }}
                >
                  <Ionicons
                    name={isSelected ? "checkbox" : "square-outline"}
                    size={18}
                    color={isSelected ? "#41B8F0" : textSecondary}
                  />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 13 }}>
                      {u.displayName || 'Unnamed user'}
                    </Text>
                    <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 11 }}>
                      {u.email}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {pickedUsers.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6, marginBottom: 4 }}>
                {pickedUsers.map((u) => (
                  <TouchableOpacity
                    key={u.userId}
                    onPress={() => togglePickedUser(u)}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 10,
                      backgroundColor: "#41B8F0",
                    }}
                  >
                    <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 12, color: "#FFFFFF" }}>
                      {u.displayName || u.email}
                    </Text>
                    <X size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 13, marginTop: 12, marginBottom: 8 }}>
              Or paste emails
            </Text>
            <TextInput
              style={{
                backgroundColor: cardBg,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: textPrimary,
                borderWidth: 1,
                borderColor: cardBorder,
                fontFamily: "Poppins_400Regular",
                fontSize: 13,
                minHeight: 70,
                textAlignVertical: "top",
              }}
              placeholder="one@example.com, two@example.com"
              placeholderTextColor={textSecondary}
              value={emailsText}
              onChangeText={setEmailsText}
              multiline
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 11, marginTop: 6 }}>
              {pickedUsers.length} picked · {parseEmails(emailsText).length} pasted
            </Text>
          </View>
        )}

        {/* Target: User Model Filter Mode */}
        {targetMode === 'filter' && (
          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 13, marginBottom: 8 }}>
              Target by Accommodation Status
            </Text>
            {[
              { id: 'checkoutDueToday', title: 'Guests Due for Checkout Today', desc: 'In-house guests whose booked accommodation ends today' },
              { id: 'inHouse', title: 'Currently In-House (Checked In)', desc: 'All guests currently occupying a hostel bed' },
              { id: 'hasAccommodation', title: 'All Accommodation Bookings', desc: 'Any user with an accommodation pass across any fest day' },
            ].map((f) => {
              const isSelected = filterType === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 14,
                    borderRadius: 14,
                    marginBottom: 8,
                    backgroundColor: isSelected ? (isDark ? "rgba(65, 184, 240, 0.15)" : "#E0F2FE") : cardBg,
                    borderWidth: 1,
                    borderColor: isSelected ? "#41B8F0" : cardBorder,
                  }}
                  onPress={() => setFilterType(f.id as any)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isSelected ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={isSelected ? "#41B8F0" : textSecondary}
                  />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ fontFamily: "Poppins_600SemiBold", color: isSelected ? "#41B8F0" : textPrimary, fontSize: 13 }}>
                      {f.title}
                    </Text>
                    <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 11 }}>
                      {f.desc}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Notification Title */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 13, marginBottom: 8 }}>
            Notification Title
          </Text>
          <TextInput
            style={{
              backgroundColor: cardBg,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 12,
              color: textPrimary,
              borderWidth: 1,
              borderColor: cardBorder,
              fontFamily: "Poppins_500Medium",
              fontSize: 14,
            }}
            placeholder="e.g. Important Festival Update..."
            placeholderTextColor={textSecondary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </View>

        {/* Notification Body */}
        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 13, marginBottom: 8 }}>
            Message Body
          </Text>
          <TextInput
            style={{
              backgroundColor: cardBg,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 12,
              color: textPrimary,
              borderWidth: 1,
              borderColor: cardBorder,
              fontFamily: "Poppins_400Regular",
              fontSize: 14,
              minHeight: 100,
              textAlignVertical: "top",
            }}
            placeholder="Write your push notification message..."
            placeholderTextColor={textSecondary}
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={4}
            maxLength={300}
          />
        </View>

        {/* Action Buttons */}
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            style={{
              backgroundColor: isDark ? "rgba(65, 184, 240, 0.15)" : "#E0F2FE",
              borderWidth: 1,
              borderColor: "#41B8F0",
              borderRadius: 14,
              paddingVertical: 13,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              opacity: !title.trim() || !body.trim() ? 0.5 : 1,
            }}
            onPress={handleTestNotification}
            disabled={!title.trim() || !body.trim()}
            activeOpacity={0.8}
          >
            <TestTube size={16} color="#41B8F0" />
            <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", marginLeft: 8, fontSize: 13 }}>
              Test Preview
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: "#41B8F0",
              borderRadius: 14,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              opacity: sending || !title.trim() || !body.trim() ? 0.5 : 1,
            }}
            onPress={handleSendNotification}
            disabled={sending || !title.trim() || !body.trim()}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Send size={16} color="#FFFFFF" />
                <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", marginLeft: 8, fontSize: 14 }}>
                  Send Push Notification
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default SendNotification;
