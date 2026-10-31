import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserStore } from "@/state/userStore";
import { useThemeStore } from "@/state/themeStore";

interface FestDay {
  key: string;
  title: string;
  subtitle: string;
  dayOfMonth: number;
  month: number; // 0-indexed: 10 = Nov
}

const FESTIVAL_DAYS: FestDay[] = [
  { key: "day0", title: "19 Nov", subtitle: "Wednesday (from 8:00 PM)", dayOfMonth: 19, month: 10 },
  { key: "day1", title: "20 Nov", subtitle: "Thursday", dayOfMonth: 20, month: 10 },
  { key: "day2", title: "21 Nov", subtitle: "Friday", dayOfMonth: 21, month: 10 },
  { key: "day3", title: "22 Nov", subtitle: "Saturday", dayOfMonth: 22, month: 10 },
  { key: "day4", title: "23 Nov", subtitle: "Sunday", dayOfMonth: 23, month: 10 },
];

export default function MealPassScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const { userData: user, refreshUserProfile } = useUserStore();

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  // Fetch / refresh latest profile and update date when screen opens
  const loadData = useCallback(async () => {
    setLoading(true);
    setCurrentDate(new Date());
    try {
      await refreshUserProfile();
    } catch (err) {
      console.warn("Could not refresh user profile on meal pass screen:", err);
    } finally {
      setLoading(false);
    }
  }, [refreshUserProfile]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Determine current festival day key based on today's date
  const getTodayDayKey = (date: Date): string | null => {
    const month = date.getMonth(); // 10 = November
    const day = date.getDate();

    const matched = FESTIVAL_DAYS.find(
      (d) => d.month === month && d.dayOfMonth === day
    );

    return matched ? matched.key : null;
  };

  const todayDayKey = getTodayDayKey(currentDate);

  // Check whether the user has paid for today's meal
  const checkPaidForToday = (): boolean => {
    if (!user?.food) return false;

    // 1. Direct match with festival day key (e.g. day0, day1, day2...)
    if (todayDayKey && user.food[todayDayKey]) {
      return true;
    }

    // 2. Direct ISO date format check (e.g. YYYY-MM-DD)
    const isoDate = currentDate.toISOString().split("T")[0];
    if (user.food[isoDate]) {
      return true;
    }

    // 3. Fallback: Check standard date string formats
    const dayStr = `${currentDate.getDate()}-${currentDate.getMonth() + 1}`;
    if (user.food[dayStr]) {
      return true;
    }

    return false;
  };

  const hasPaidToday = checkPaidForToday();

  // Color palette
  const bgColor = isDark ? "#131316" : "#E0E0E0";
  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#9CA3AF" : "#6B7280";

  // Formatted date string
  const formattedToday = currentDate.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header Bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: Math.max(insets.top + 8, 16),
          paddingHorizontal: 16,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
          backgroundColor: bgColor,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.75}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: isDark ? "#1C1C20" : "#FFFFFF",
              borderWidth: 1,
              borderColor: cardBorder,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="arrow-back" size={22} color={textPrimary} />
          </TouchableOpacity>
          <View>
            <Text
              style={{
                fontFamily: "Talina",
                fontSize: 22,
                color: textPrimary,
                letterSpacing: 0.5,
              }}
            >
              Meal Pass
            </Text>
            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                fontSize: 12,
                color: "#41B8F0",
              }}
            >
              Daily Meal Verification
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={loadData}
          disabled={loading}
          activeOpacity={0.7}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: isDark ? "#1C1C20" : "#FFFFFF",
            borderWidth: 1,
            borderColor: cardBorder,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#41B8F0" />
          ) : (
            <Ionicons name="refresh" size={20} color={textPrimary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Today's Date Banner */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: cardBorder,
            padding: 16,
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: "rgba(65, 184, 240, 0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="calendar-outline" size={22} color="#41B8F0" />
            </View>
            <View>
              <Text
                style={{
                  fontFamily: "Poppins_400Regular",
                  fontSize: 12,
                  color: textSecondary,
                }}
              >
                Today's Date
              </Text>
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 15,
                  color: textPrimary,
                }}
              >
                {formattedToday}
              </Text>
            </View>
          </View>

          {todayDayKey && (
            <View
              style={{
                backgroundColor: "rgba(65, 184, 240, 0.2)",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 10,
              }}
            >
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 12,
                  color: "#41B8F0",
                  textTransform: "uppercase",
                }}
              >
                {todayDayKey}
              </Text>
            </View>
          )}
        </View>

        {/* Primary Status Card (Tick mark if Paid, Cross mark if Not Paid) */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 24,
            borderWidth: 2,
            borderColor: hasPaidToday
              ? "rgba(16, 185, 129, 0.5)"
              : "rgba(239, 68, 68, 0.5)",
            paddingVertical: 32,
            paddingHorizontal: 20,
            alignItems: "center",
            marginBottom: 20,
            shadowColor: hasPaidToday ? "#10B981" : "#EF4444",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: isDark ? 0.25 : 0.1,
            shadowRadius: 12,
            elevation: 4,
          }}
        >
          {/* Status Icon Indicator */}
          {hasPaidToday ? (
            <View
              style={{
                width: 110,
                height: 110,
                borderRadius: 55,
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                borderWidth: 3,
                borderColor: "#10B981",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 18,
              }}
            >
              <Ionicons name="checkmark" size={68} color="#10B981" />
            </View>
          ) : (
            <View
              style={{
                width: 110,
                height: 110,
                borderRadius: 55,
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                borderWidth: 3,
                borderColor: "#EF4444",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 18,
              }}
            >
              <Ionicons name="close" size={68} color="#EF4444" />
            </View>
          )}

          {/* Status Label */}
          <Text
            style={{
              fontFamily: "Talina",
              fontSize: 26,
              color: hasPaidToday ? "#10B981" : "#EF4444",
              marginBottom: 6,
              textAlign: "center",
            }}
          >
            {hasPaidToday ? "MEAL PAID" : "MEAL NOT PAID"}
          </Text>

          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              fontSize: 14,
              color: textSecondary,
              textAlign: "center",
              paddingHorizontal: 16,
              lineHeight: 20,
            }}
          >
            {hasPaidToday
              ? "You have a verified meal pass for today. Enjoy your meal!"
              : "No meal payment was found for today's date."}
          </Text>

          {/* Badge */}
          <View
            style={{
              marginTop: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: hasPaidToday
                ? "rgba(16, 185, 129, 0.12)"
                : "rgba(239, 68, 68, 0.12)",
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
            }}
          >
            <Ionicons
              name={hasPaidToday ? "shield-checkmark" : "alert-circle"}
              size={16}
              color={hasPaidToday ? "#10B981" : "#EF4444"}
            />
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 12,
                color: hasPaidToday ? "#10B981" : "#EF4444",
              }}
            >
              {hasPaidToday ? "Verified Active" : "Not Active Today"}
            </Text>
          </View>
        </View>

        {/* User Information Summary */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: cardBorder,
            padding: 18,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 15,
              color: textPrimary,
              marginBottom: 12,
            }}
          >
            User Details
          </Text>

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 13, color: textSecondary }}>
                Name
              </Text>
              <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 13, color: textPrimary }}>
                {user?.displayName || "N/A"}
              </Text>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 13, color: textSecondary }}>
                Email
              </Text>
              <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 13, color: textPrimary }}>
                {user?.email || "N/A"}
              </Text>
            </View>

            {user?.rollNumber ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 13, color: textSecondary }}>
                  Roll Number
                </Text>
                <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 13, color: textPrimary }}>
                  {user.rollNumber}
                </Text>
              </View>
            ) : null}

            {user?.collegeName ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 13, color: textSecondary }}>
                  College
                </Text>
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    fontSize: 13,
                    color: textPrimary,
                    maxWidth: "60%",
                    textAlign: "right",
                  }}
                  numberOfLines={1}
                >
                  {user.collegeName}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Festival Days Meal Breakdown */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: cardBorder,
            padding: 18,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 15,
              color: textPrimary,
              marginBottom: 4,
            }}
          >
            All Festival Days
          </Text>
          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              fontSize: 12,
              color: textSecondary,
              marginBottom: 14,
            }}
          >
            Meal pass status across festival dates
          </Text>

          <View style={{ gap: 10 }}>
            {FESTIVAL_DAYS.map((festDay) => {
              const isPaid = !!user?.food?.[festDay.key];
              const isCurrentDay = todayDayKey === festDay.key;

              return (
                <View
                  key={festDay.key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    backgroundColor: isCurrentDay
                      ? isDark
                        ? "rgba(65, 184, 240, 0.12)"
                        : "rgba(65, 184, 240, 0.08)"
                      : isDark
                      ? "#24242A"
                      : "#F3F4F6",
                    borderWidth: isCurrentDay ? 1 : 0,
                    borderColor: "#41B8F0",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text
                        style={{
                          fontFamily: "Poppins_600SemiBold",
                          fontSize: 14,
                          color: textPrimary,
                        }}
                      >
                        {festDay.title}
                      </Text>
                      {isCurrentDay && (
                        <View
                          style={{
                            backgroundColor: "#41B8F0",
                            paddingHorizontal: 6,
                            paddingVertical: 1,
                            borderRadius: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Poppins_700Bold",
                              fontSize: 10,
                              color: "#FFFFFF",
                            }}
                          >
                            TODAY
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={{
                        fontFamily: "Poppins_400Regular",
                        fontSize: 12,
                        color: textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {festDay.subtitle}
                    </Text>
                  </View>

                  {/* Tick mark or Cross mark */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: isPaid
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(239, 68, 68, 0.15)",
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 12,
                    }}
                  >
                    <Ionicons
                      name={isPaid ? "checkmark" : "close"}
                      size={16}
                      color={isPaid ? "#10B981" : "#EF4444"}
                    />
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        fontSize: 12,
                        color: isPaid ? "#10B981" : "#EF4444",
                      }}
                    >
                      {isPaid ? "Paid" : "Not Paid"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Accommodation / Food purchase shortcut if not paid */}
        {!hasPaidToday && !user?.isHostCollegeStudent && !user?.collegeName?.toLowerCase().includes("thapar") && !user?.email?.toLowerCase().endsWith("@thapar.edu") && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/profile/Accommodation")}
            style={{
              backgroundColor: "#41B8F0",
              paddingVertical: 14,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 15,
                color: "#FFFFFF",
              }}
            >
              Get Food & Accommodation Pass
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
