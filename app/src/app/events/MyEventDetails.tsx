import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Share,
} from "react-native";
import { showAlert } from "@/components";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  Hotel,
  CheckCircle2,
  Trash2,
  XCircle,
  CreditCard,
  ChevronRight,
  Calendar,
  MapPin,
  Users,
  User,
  Share2,
  QrCode,
  ShieldCheck,
} from "lucide-react-native";
import QRCode from "react-native-qrcode-svg";
import { useUserStore } from "@/state/userStore";
import { useThemeStore } from "@/state/themeStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TeamDetailsCard from "@/components/registration/TeamDetailsCard";
import TeamSubmissionModal from "@/components/registration/TeamSubmissionModal";
import { useEventDetail } from "@/hooks/useEventDetail";
import {
  useDeleteTeam,
  useRemoveTeamMember,
  useUnregisterForEvent,
  useConfirmTeam,
} from "@/hooks/useEventMutations";
import { isPerIndividualPayment, isEventPaymentDue } from "@/utils/paymentHelpers";

const MyEventDetailsScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();

  const bgColor = isDark ? "#121216" : "#F4F5F7";
  const cardBg = isDark ? "#1A1A22" : "#FFFFFF";
  const cardBorder = isDark ? "#282834" : "#E2E8F0";
  const textPrimary = isDark ? "#FFFFFF" : "#0F172A";
  const textSecondary = isDark ? "#94A3B8" : "#64748B";
  const labelColor = isDark ? "#6B7280" : "#94A3B8";
  const dividerColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";

  const { eventId } = useLocalSearchParams() as { eventId: string };
  const { userData: userProfile } = useUserStore();
  const userId = userProfile?.userId || "";

  const { data: detailData, loading, refresh } = useEventDetail(eventId);
  const eventData = detailData?.event || null;
  const registration = detailData?.myRegistration || null;
  const teamData = detailData?.myTeam || null;

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const [submittingTeam, setSubmittingTeam] = useState(false);
  const [isSubmissionModalVisible, setIsSubmissionModalVisible] = useState(false);

  const deleteTeamMutation = useDeleteTeam();
  const removeTeamMemberMutation = useRemoveTeamMember();
  const unregisterMutation = useUnregisterForEvent();
  const confirmTeamMutation = useConfirmTeam();

  const isLeader = teamData?.leaderUserId === userId;
  const hasAccommodation =
    Object.values(userProfile?.accommodation || {}).some(Boolean) ||
    Object.values(userProfile?.food || {}).some(Boolean);

  const isHost = !!(
    userProfile?.isHostCollegeStudent ||
    userProfile?.collegeName?.toLowerCase().includes("thapar") ||
    userProfile?.email?.toLowerCase().endsWith("@thapar.edu")
  );

  let eventRegistrationFee = 0;
  if (eventData?.paymentRequired) {
    const isTeam = eventData.eventType?.toLowerCase() === 'team' || !!(eventData as any).isTeamEvent;
    const isPerInd = isPerIndividualPayment(eventData.paymentType);
    const hostFee = eventData.registrationFee?.host || 0;
    const otherFee = eventData.registrationFee?.other || 0;
    const myRate = isHost ? hostFee : otherFee;

    if (isTeam && isPerInd) {
      const teamMembers = teamData?.members || [];
      const unpaidMembers = teamMembers.filter((m: any) => m.paymentStatus !== 'success');

      const joinedFee = unpaidMembers.reduce((acc: number, m: any) => {
        return acc + (m.isHostCollegeStudent ? hostFee : otherFee);
      }, 0);

      const minSize = eventData.minTeamSize || 1;
      const currentMemberCount = teamMembers.length || 1;
      const unfilledSlots = Math.max(0, minSize - currentMemberCount);

      eventRegistrationFee = joinedFee + (unfilledSlots * myRate);
    } else {
      eventRegistrationFee = myRate;
    }
  }

  const requiresPayment = !!eventData?.paymentRequired && eventRegistrationFee > 0;

  const isPaymentDue = isEventPaymentDue({
    event: eventData,
    team: teamData,
    registration,
    userId,
  });
  const isPaid = !isPaymentDue;

  const handleRemoveMember = (memberUserId: string, memberName: string) => {
    if (!teamData) {
      showAlert("Error", "Team data not available");
      return;
    }

    showAlert("Remove Member", `Remove ${memberName} from the team?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          if (!teamData?.teamId) return;
          removeTeamMemberMutation.mutate(
            { teamRef: teamData.teamId, userId: memberUserId },
            {
              onError: (error: any) =>
                showAlert("Error", error.message || "Failed to remove member"),
            }
          );
        },
      },
    ]);
  };

  const handleDeleteTeam = () => {
    if (!teamData) {
      showAlert("Error", "Team data not available");
      return;
    }

    const isConfirmed = teamData.status === "confirmed";
    const title = isConfirmed ? "Delete Confirmed Team" : "Delete Team";
    const message = isConfirmed
      ? "Your team registration is currently confirmed. Deleting this team will cancel the registration for all members."
      : "Are you sure you want to delete this team? This will cancel the registration for the whole team.";

    showAlert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Delete Team",
        style: "destructive",
        onPress: () => {
          if (!teamData?.teamId) return;
          deleteTeamMutation.mutate(teamData.teamId, {
            onSuccess: () => router.back(),
            onError: (error: any) =>
              showAlert("Error", error.message || "Failed to delete team"),
          });
        },
      },
    ]);
  };

  const handleCancelRegistration = () => {
    showAlert(
      "Cancel Registration",
      "Are you sure you want to cancel your registration for this event?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: () => {
            unregisterMutation.mutate(eventId, {
              onSuccess: () => router.back(),
              onError: (error: any) =>
                showAlert("Error", error.message || "Failed to cancel registration"),
            });
          },
        },
      ]
    );
  };

  const handleCompleteRegistration = async () => {
    if (!eventData || !teamData) return;

    if (isPaymentDue) {
      showAlert(
        "Payment Required",
        "Payment is pending or due for this event. Please complete the registration payment before finalizing your registration.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Pay Now",
            onPress: () => {
              router.push({
                pathname: "/events/Payment",
                params: {
                  eventId,
                  ...(teamData?.teamId ? { teamId: teamData.teamId } : {}),
                },
              });
            },
          },
        ]
      );
      return;
    }

    if (
      eventData.minTeamSize &&
      (teamData.members?.length ?? 0) < eventData.minTeamSize
    ) {
      showAlert(
        "Insufficient Team Size",
        `Your team needs at least ${eventData.minTeamSize} members before registration can be finalized. Currently you have ${
          teamData.members?.length ?? 0
        } member(s).\n\nPlease share the invite code with your teammates.`
      );
      return;
    }

    showAlert(
      "Finalize Team Registration",
      "Are you satisfied with your team? Once confirmed, your team registration will be submitted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Registration",
          onPress: () => {
            if (!teamData?.teamId) return;
            setSubmittingTeam(true);
            confirmTeamMutation.mutate(teamData.teamId, {
              onSuccess: () => {
                showAlert("Success", "Team registration has been successfully confirmed!");
                refresh();
              },
              onError: (err: any) => {
                showAlert("Error", err.message || "Failed to complete team registration");
              },
              onSettled: () => {
                setSubmittingTeam(false);
              },
            });
          },
        },
      ]
    );
  };

  const handleSharePass = async () => {
    const title = eventData?.title || registration?.eventName || "Event Pass";
    try {
      await Share.share({
        message: `I'm attending ${title} at Saturnalia 2026! Check out the festival app for events and schedule.`,
      });
    } catch (e) {
      // share dismissed
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, alignItems: "center", justifyContent: "center" }}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <ActivityIndicator size="large" color="#41B8F0" />
      </View>
    );
  }

  if (!registration) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: isDark ? "rgba(239, 68, 68, 0.12)" : "#FEE2E2", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <AlertTriangle size={32} color="#EF4444" />
        </View>
        <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 18, color: textPrimary, textAlign: "center", marginBottom: 6 }}>
          Registration Not Found
        </Text>
        <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 13, color: textSecondary, textAlign: "center", marginBottom: 24 }}>
          We could not load your registration details for this event.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: "#41B8F0",
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
          }}
          activeOpacity={0.8}
        >
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", fontSize: 14 }}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Determine computed status
  const rawStatus =
    eventData?.eventType === "team" && teamData
      ? isPaymentDue
        ? "payment_pending"
        : teamData.status || "pending"
      : isPaymentDue
      ? "payment_pending"
      : registration.status || "confirmed";

  const getStatusBadge = () => {
    switch (rawStatus) {
      case "confirmed":
        return {
          icon: <CheckCircle2 size={13} color="#10B981" />,
          label: "Confirmed",
          color: "#10B981",
          bg: isDark ? "rgba(16, 185, 129, 0.12)" : "#DCFCE7",
          border: "rgba(16, 185, 129, 0.3)",
        };
      case "payment_pending":
        return {
          icon: <CreditCard size={13} color="#F59E0B" />,
          label: "Payment Due",
          color: "#F59E0B",
          bg: isDark ? "rgba(245, 158, 11, 0.12)" : "#FEF3C7",
          border: "rgba(245, 158, 11, 0.3)",
        };
      case "awaited":
        return {
          icon: <Clock size={13} color="#A855F7" />,
          label: "Under Review",
          color: "#A855F7",
          bg: isDark ? "rgba(168, 85, 247, 0.12)" : "#F3E8FF",
          border: "rgba(168, 85, 247, 0.3)",
        };
      case "rejected":
        return {
          icon: <XCircle size={13} color="#EF4444" />,
          label: "Declined",
          color: "#EF4444",
          bg: isDark ? "rgba(239, 68, 68, 0.12)" : "#FEE2E2",
          border: "rgba(239, 68, 68, 0.3)",
        };
      default:
        return {
          icon: <Clock size={13} color="#F59E0B" />,
          label: "Pending",
          color: "#F59E0B",
          bg: isDark ? "rgba(245, 158, 11, 0.12)" : "#FEF3C7",
          border: "rgba(245, 158, 11, 0.3)",
        };
    }
  };

  const statusBadge = getStatusBadge();

  // Date & Time formatting
  const formatDateTime = (dateString?: string) => {
    if (!dateString) return { date: "TBD", time: "TBD" };
    try {
      const d = new Date(dateString);
      const dateFormatted = d.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const timeFormatted = d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      return { date: dateFormatted, time: timeFormatted };
    } catch {
      return { date: "TBD", time: "TBD" };
    }
  };

  const { date, time } = formatDateTime(eventData?.startDateTime);

  // Pass Number & Attendee info
  const eventIdPart = (registration.eventId || eventData?.eventId || "").slice(0, 6).toUpperCase() || "EVT";
  const userIdPart = (registration.userId || userId).slice(0, 4).toUpperCase() || "USR";
  const passCode = `${eventIdPart}-${userIdPart}`;
  const attendeeName = registration.user?.name || userProfile?.displayName || "Participant";
  const qrData = registration.qrToken || `${registration.eventId || eventData?.eventId}_${registration.userId || userId}`;

  const isTeam = eventData?.eventType === "team";
  const categoryName = eventData?.category || registration.eventCategory || "Festival";

  // Payment status calculations
  const feeAmount =
    registration.paymentDetails?.amount ||
    registration.fee ||
    teamData?.paymentDetails?.amount ||
    eventRegistrationFee;

  const txnId =
    registration.paymentDetails?.txnId ||
    registration.paymentDetails?.easepayid ||
    registration.paymentDetails?.merchantOrderId ||
    teamData?.paymentDetails?.txnId ||
    teamData?.paymentDetails?.merchantOrderId;

  const paidDate =
    registration.paidAt ||
    registration.paymentDetails?.date ||
    registration.paymentDetails?.paidAt ||
    teamData?.paidAt;

  const formatPaidDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Top Navigation Bar */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
          backgroundColor: isDark ? "#16161C" : "#FFFFFF",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
            activeOpacity={0.7}
          >
            <ArrowLeft size={19} color={textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 16,
                color: textPrimary,
              }}
              numberOfLines={1}
            >
              Event Registration
            </Text>
            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                fontSize: 11,
                color: textSecondary,
              }}
            >
              Pass ID: {passCode}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSharePass}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9",
            alignItems: "center",
            justifyContent: "center",
          }}
          activeOpacity={0.7}
        >
          <Share2 size={17} color={textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + 40,
        }}
      >
        {/* HERO CARD: Clean Header & Event Information */}
        <View
          style={{
            backgroundColor: cardBg,
            borderColor: cardBorder,
            borderWidth: 1,
            borderRadius: 20,
            padding: 20,
            marginBottom: 16,
          }}
        >
          {/* Badges row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <View
                style={{
                  backgroundColor: isDark ? "rgba(65, 184, 240, 0.14)" : "rgba(65, 184, 240, 0.1)",
                  paddingHorizontal: 9,
                  paddingVertical: 3,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    fontSize: 11,
                    color: "#41B8F0",
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  {categoryName}
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9",
                  paddingHorizontal: 9,
                  paddingVertical: 3,
                  borderRadius: 8,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                {isTeam ? (
                  <Users size={11} color={textSecondary} style={{ marginRight: 4 }} />
                ) : (
                  <User size={11} color={textSecondary} style={{ marginRight: 4 }} />
                )}
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    fontSize: 11,
                    color: textSecondary,
                  }}
                >
                  {isTeam ? "Team Event" : "Individual"}
                </Text>
              </View>

              {isPaid && (
                <View
                  style={{
                    backgroundColor: isDark ? "rgba(16, 185, 129, 0.14)" : "rgba(16, 185, 129, 0.1)",
                    paddingHorizontal: 9,
                    paddingVertical: 3,
                    borderRadius: 8,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <CheckCircle2 size={11} color="#10B981" style={{ marginRight: 4 }} />
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      fontSize: 11,
                      color: "#10B981",
                    }}
                  >
                    {feeAmount > 0 ? `Paid ₹${feeAmount}` : "Paid"}
                  </Text>
                </View>
              )}
            </View>

            {/* Status badge */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: statusBadge.bg,
                borderColor: statusBadge.border,
                borderWidth: 1,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
              }}
            >
              {statusBadge.icon}
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 11,
                  color: statusBadge.color,
                  marginLeft: 5,
                }}
              >
                {statusBadge.label}
              </Text>
            </View>
          </View>

          {/* Event Title */}
          <Text
            style={{
              fontFamily: "Talina",
              fontSize: 22,
              color: textPrimary,
              letterSpacing: 0.4,
              lineHeight: 28,
              marginBottom: 16,
            }}
          >
            {eventData?.title || registration.eventName}
          </Text>

          {/* Schedule & Location Strip */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "#F8FAFC",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: dividerColor,
              paddingVertical: 12,
              paddingHorizontal: 14,
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                <Calendar size={12} color={labelColor} style={{ marginRight: 4 }} />
                <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 10, color: labelColor, textTransform: "uppercase" }}>
                  Date
                </Text>
              </View>
              <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 12, color: textPrimary }} numberOfLines={1}>
                {date}
              </Text>
            </View>

            <View style={{ width: 1, backgroundColor: dividerColor, marginHorizontal: 4 }} />

            <View style={{ flex: 1, marginHorizontal: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                <Clock size={12} color={labelColor} style={{ marginRight: 4 }} />
                <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 10, color: labelColor, textTransform: "uppercase" }}>
                  Time
                </Text>
              </View>
              <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 12, color: textPrimary }} numberOfLines={1}>
                {time}
              </Text>
            </View>

            <View style={{ width: 1, backgroundColor: dividerColor, marginHorizontal: 4 }} />

            <View style={{ flex: 1.2, marginLeft: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                <MapPin size={12} color={labelColor} style={{ marginRight: 4 }} />
                <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 10, color: labelColor, textTransform: "uppercase" }}>
                  Venue
                </Text>
              </View>
              <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 12, color: textPrimary }} numberOfLines={1}>
                {eventData?.venueName || "Venue TBA"}
              </Text>
            </View>
          </View>
        </View>

        {/* PAYMENT ACTION BANNER (Urgent status placed right at top when pending) */}
        {isPaymentDue && (
          <View
            style={{
              backgroundColor: isDark ? "rgba(245, 158, 11, 0.08)" : "#FFFBEB",
              borderColor: "rgba(245, 158, 11, 0.35)",
              borderWidth: 1,
              borderRadius: 18,
              padding: 18,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "rgba(245, 158, 11, 0.2)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 10,
                }}
              >
                <AlertTriangle size={17} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#F59E0B", fontSize: 14 }}>
                  {isTeam && !isLeader
                    ? "Pending Team Leader Payment"
                    : "Payment Required to Confirm"}
                </Text>
                <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 12 }}>
                  {isTeam && !isLeader
                    ? "Your team leader must complete the entry payment to finalize your registration."
                    : "Complete the transaction to secure your spot and generate your entry pass."}
                </Text>
              </View>
            </View>

            {(!isTeam || isLeader) && (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/events/Payment",
                    params: {
                      eventId,
                      ...(teamData?.teamId ? { teamId: teamData.teamId } : {}),
                    },
                  })
                }
                activeOpacity={0.85}
                style={{
                  backgroundColor: "#F59E0B",
                  borderRadius: 12,
                  height: 46,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 10,
                }}
              >
                <CreditCard size={16} color="#000000" style={{ marginRight: 8 }} />
                <Text style={{ fontFamily: "Poppins_700Bold", color: "#000000", fontSize: 14 }}>
                  Complete Payment Now
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* PAYMENT COMPLETED RECEIPT CARD */}
        {isPaid && (feeAmount > 0 || !!txnId) && (
          <View
            style={{
              backgroundColor: isDark ? "rgba(16, 185, 129, 0.08)" : "#F0FDF4",
              borderColor: isDark ? "rgba(16, 185, 129, 0.25)" : "#BBF7D0",
              borderWidth: 1,
              borderRadius: 18,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: txnId || paidDate ? 10 : 0,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: "rgba(16, 185, 129, 0.18)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                  }}
                >
                  <CheckCircle2 size={18} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      fontSize: 14,
                      color: textPrimary,
                    }}
                  >
                    Payment Completed
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Poppins_400Regular",
                      fontSize: 11,
                      color: textSecondary,
                    }}
                  >
                    Event registration fee verified & settled
                  </Text>
                </View>
              </View>

              <View
                style={{
                  backgroundColor: isDark ? "rgba(16, 185, 129, 0.16)" : "#DCFCE7",
                  borderColor: "rgba(16, 185, 129, 0.3)",
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 10,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    fontSize: 12,
                    color: "#10B981",
                  }}
                >
                  {feeAmount > 0 ? `₹${feeAmount}` : "Paid"}
                </Text>
              </View>
            </View>

            {(txnId || paidDate) && (
              <View
                style={{
                  borderTopWidth: 1,
                  borderColor: isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.06)",
                  paddingTop: 10,
                  marginTop: 2,
                }}
              >
                {txnId && (
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: paidDate ? 4 : 0,
                    }}
                  >
                    <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 11, color: labelColor }}>
                      Reference ID
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Poppins_500Medium",
                        fontSize: 11,
                        color: textSecondary,
                      }}
                      numberOfLines={1}
                    >
                      {txnId}
                    </Text>
                  </View>
                )}
                {paidDate && (
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 11, color: labelColor }}>
                      Paid On
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Poppins_500Medium",
                        fontSize: 11,
                        color: textSecondary,
                      }}
                    >
                      {formatPaidDate(paidDate)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* DIGITAL PASS TICKET (Clean, high-fidelity ticket) */}
        {registration.status !== "rejected" && (
          <View
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
              borderWidth: 1,
              borderRadius: 22,
              marginBottom: 16,
              overflow: "hidden",
            }}
          >
            {/* Top Ticket Header */}
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 18,
                paddingBottom: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "#FAFAFA",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ShieldCheck size={16} color="#10B981" style={{ marginRight: 6 }} />
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    fontSize: 12,
                    color: textPrimary,
                    letterSpacing: 0.5,
                  }}
                >
                  DIGITAL FESTIVAL PASS
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 12,
                  color: "#41B8F0",
                  letterSpacing: 0.6,
                }}
              >
                {passCode}
              </Text>
            </View>

            {/* Ticket Details */}
            <View style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 11, color: labelColor, marginBottom: 2 }}>
                    Attendee Name
                  </Text>
                  <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: textPrimary }} numberOfLines={1}>
                    {attendeeName}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 11, color: labelColor, marginBottom: 2 }}>
                    Pass Status
                  </Text>
                  <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: statusBadge.color }}>
                    {statusBadge.label}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: isTeam && teamData?.teamName ? 10 : 0,
                }}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 11, color: labelColor, marginBottom: 2 }}>
                    Entry Fee
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      fontSize: 13,
                      color: isPaid ? "#10B981" : requiresPayment ? "#F59E0B" : textSecondary,
                    }}
                    numberOfLines={1}
                  >
                    {isPaid
                      ? feeAmount > 0
                        ? `Paid (₹${feeAmount})`
                        : "Free Entry"
                      : requiresPayment
                      ? `₹${feeAmount} (Pending)`
                      : "Free Entry"}
                  </Text>
                </View>

                {isTeam && teamData?.teamName ? (
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 11, color: labelColor, marginBottom: 2 }}>
                      Team
                    </Text>
                    <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 13, color: textPrimary }} numberOfLines={1}>
                      {teamData.teamName}
                    </Text>
                  </View>
                ) : (
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 11, color: labelColor, marginBottom: 2 }}>
                      Category
                    </Text>
                    <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 13, color: textPrimary }} numberOfLines={1}>
                      {categoryName}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Perforated Divider */}
            <View
              style={{
                borderTopWidth: 1,
                borderStyle: "dashed",
                borderColor: dividerColor,
                marginHorizontal: 16,
              }}
            />

            {/* QR Code Presentation */}
            <View
              style={{
                alignItems: "center",
                paddingVertical: 20,
                paddingHorizontal: 16,
              }}
            >
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: isDark ? "#33333E" : "#E2E8F0",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <QRCode
                  value={qrData}
                  size={155}
                  color="#0F172A"
                  backgroundColor="#FFFFFF"
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 12,
                }}
              >
                <QrCode size={13} color={textSecondary} style={{ marginRight: 6 }} />
                <Text
                  style={{
                    fontFamily: "Poppins_400Regular",
                    fontSize: 11,
                    color: textSecondary,
                  }}
                >
                  Scan at registration desk & entry gates
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* TEAM DETAILS SECTION (For team events) */}
        {isTeam && teamData && (
          <TeamDetailsCard
            teamData={teamData}
            eventData={eventData}
            userId={userId}
            isLeader={isLeader}
            submittingTeam={submittingTeam}
            isPaymentDue={isPaymentDue}
            onPay={() =>
              router.push({
                pathname: "/events/Payment",
                params: {
                  eventId,
                  ...(teamData?.teamId ? { teamId: teamData.teamId } : {}),
                },
              })
            }
            onRemoveMember={handleRemoveMember}
            onSubmitTeam={handleCompleteRegistration}
          />
        )}

        {/* ACCOMMODATION & FOOD PASS CARD */}
        {!isHost && (
          <View
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
              borderWidth: 1,
              borderRadius: 18,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
                <View
                  style={{
                    backgroundColor: isDark ? "rgba(65, 184, 240, 0.15)" : "rgba(65, 184, 240, 0.1)",
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                  }}
                >
                  <Hotel size={16} color="#41B8F0" />
                </View>
                <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: textPrimary }}>
                  Hostel & Meals
                </Text>
              </View>

              {hasAccommodation && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(16, 185, 129, 0.12)",
                    borderColor: "rgba(16, 185, 129, 0.3)",
                    borderWidth: 1,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 10,
                  }}
                >
                  <CheckCircle2 size={11} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 11, color: "#10B981" }}>
                    Pass Active
                  </Text>
                </View>
              )}
            </View>

            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                fontSize: 12,
                color: textSecondary,
                lineHeight: 18,
                marginBottom: 12,
              }}
            >
              {hasAccommodation
                ? "You have active hostel accommodation or meal passes for Saturnalia. Manage or extend your stay anytime."
                : "Attending from outside campus? Reserve hostel accommodation (₹300/day) and festival meals (₹200/day)."}
            </Text>

            <TouchableOpacity
              onPress={() => router.push("/profile/Accommodation")}
              activeOpacity={0.8}
              style={{
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
                borderColor: cardBorder,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 10,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 12,
                  color: "#41B8F0",
                  marginRight: 4,
                }}
              >
                {hasAccommodation ? "Manage Pass" : "Book Accommodation & Meals"}
              </Text>
              <ChevronRight size={14} color="#41B8F0" />
            </TouchableOpacity>
          </View>
        )}

        {/* DECLINED NOTICE */}
        {registration.status === "rejected" && (
          <View
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              borderColor: "rgba(239, 68, 68, 0.3)",
              borderWidth: 1,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <XCircle size={16} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#EF4444", fontSize: 13 }}>
                Registration Not Approved
              </Text>
            </View>
            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                color: isDark ? "#FECACA" : "#991B1B",
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              Your registration was declined. Please reach out to the event coordinators for inquiries.
            </Text>
          </View>
        )}

        {/* MANAGEMENT & ACTIONS (Clean, secondary destructive buttons) */}
        {isTeam && teamData && isLeader && (
          <TouchableOpacity
            onPress={handleDeleteTeam}
            activeOpacity={0.7}
            style={{
              borderWidth: 1,
              borderColor: "rgba(239, 68, 68, 0.3)",
              backgroundColor: isDark ? "rgba(239, 68, 68, 0.06)" : "#FEF2F2",
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              marginBottom: 16,
            }}
          >
            <Trash2 size={14} color="#EF4444" style={{ marginRight: 6 }} />
            <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#EF4444", fontSize: 13 }}>
              Delete Team
            </Text>
          </TouchableOpacity>
        )}

        {!isTeam && registration.status !== "rejected" && (
          <TouchableOpacity
            onPress={handleCancelRegistration}
            activeOpacity={0.7}
            style={{
              borderWidth: 1,
              borderColor: "rgba(239, 68, 68, 0.3)",
              backgroundColor: isDark ? "rgba(239, 68, 68, 0.06)" : "#FEF2F2",
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              marginBottom: 16,
            }}
          >
            <XCircle size={14} color="#EF4444" style={{ marginRight: 6 }} />
            <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#EF4444", fontSize: 13 }}>
              Cancel Registration
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <TeamSubmissionModal
        visible={isSubmissionModalVisible}
        onClose={() => setIsSubmissionModalVisible(false)}
        event={eventData}
        teamData={teamData}
        onSubmitSuccess={() => {
          setIsSubmissionModalVisible(false);
          refresh();
        }}
      />
    </View>
  );
};

export default MyEventDetailsScreen;
