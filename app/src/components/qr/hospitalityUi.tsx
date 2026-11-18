import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "@/state/themeStore";
import { findHostel, formatHostelDisplay } from "@/data/hostels";

export const DAY_KEYS = ["day0", "day1", "day2", "day3", "day4"] as const;
export const DAY_LABELS: Record<string, string> = {
  day0: "19 Nov",
  day1: "20 Nov",
  day2: "21 Nov",
  day3: "22 Nov",
  day4: "23 Nov",
};

export const MEAL_SLOT_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export const MEAL_REASON_TEXT: Record<string, string> = {
  not_fest_day: "Today is not a fest day.",
  wrong_day: "This mess QR is for a different day.",
  no_food_today: "No meal pass for today.",
  no_active_slot: "No meal is being served right now.",
  already_availed: "Meal already availed for this slot.",
  log_failed: "Could not record the meal. Try again.",
};

/** Friendly name for a hostel id; falls back to the legacy static list. */
export const hostelLabel = (id?: string | null, hostels?: { id: string; name: string }[]) => {
  if (!id) return "";
  const dyn = hostels?.find((h) => h.id === id);
  if (dyn) return dyn.name;
  return findHostel(id) ? formatHostelDisplay(id) : id;
};

export function useHospitalityColors() {
  const { isDark } = useThemeStore();
  return {
    isDark,
    modalBg: isDark ? "#1C1C20" : "#FFFFFF",
    modalBorder: isDark ? "#2A2A30" : "#D5D5D5",
    cardBg: isDark ? "#131316" : "#F3F4F6",
    cardBorder: isDark ? "#2A2A30" : "#E5E7EB",
    textPrimary: isDark ? "#FFFFFF" : "#111827",
    textSecondary: isDark ? "#9CA3AF" : "#6B7280",
    inputBg: isDark ? "#18181C" : "#FFFFFF",
    accent: "#41B8F0",
    success: "#10B981",
    danger: "#EF4444",
    warning: "#F59E0B",
  };
}

export const Card: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => {
  const c = useHospitalityColors();
  return (
    <View
      style={{
        backgroundColor: c.cardBg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.cardBorder,
        padding: 14,
        marginBottom: 12,
      }}
    >
      {title ? (
        <Text style={{ fontFamily: "Poppins_600SemiBold", color: c.textSecondary, fontSize: 12, marginBottom: 8, letterSpacing: 0.5 }}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      {children}
    </View>
  );
};

export const InfoRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
  const c = useHospitalityColors();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, gap: 12 }}>
      <Text style={{ fontFamily: "Poppins_400Regular", color: c.textSecondary, fontSize: 13 }}>{label}</Text>
      <Text
        style={{ fontFamily: "Poppins_600SemiBold", color: c.textPrimary, fontSize: 13, flexShrink: 1, textAlign: "right" }}
        selectable
      >
        {value || "—"}
      </Text>
    </View>
  );
};

export const DayChips: React.FC<{ label: string; days?: Record<string, boolean> }> = ({ label, days }) => {
  const c = useHospitalityColors();
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={{ fontFamily: "Poppins_400Regular", color: c.textSecondary, fontSize: 12, marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {DAY_KEYS.map((d) => {
          const on = Boolean(days?.[d]);
          return (
            <View
              key={d}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: on ? "rgba(16,185,129,0.15)" : "transparent",
                borderWidth: 1,
                borderColor: on ? "rgba(16,185,129,0.4)" : c.cardBorder,
              }}
            >
              <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 11, color: on ? c.success : c.textSecondary }}>
                {DAY_LABELS[d]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export const ToggleRow: React.FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}> = ({ label, value, onChange, disabled, icon }) => {
  const c = useHospitalityColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon ? <Ionicons name={icon} size={18} color={c.textSecondary} /> : null}
        <Text style={{ fontFamily: "Poppins_500Medium", color: c.textPrimary, fontSize: 14 }}>{label}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: c.success }} />
    </View>
  );
};

export const ActionButton: React.FC<{
  label: string;
  onPress: () => void;
  color?: string;
  variant?: "solid" | "outline";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}> = ({ label, onPress, color, variant = "solid", loading, disabled, icon }) => {
  const c = useHospitalityColors();
  const col = color || c.accent;
  const solid = variant === "solid";
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        backgroundColor: solid ? col : "transparent",
        borderWidth: 1.5,
        borderColor: col,
        borderRadius: 14,
        paddingVertical: 13,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        opacity: disabled ? 0.5 : 1,
        marginTop: 8,
      }}
    >
      {loading ? (
        <ActivityIndicator color={solid ? "#fff" : col} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={solid ? "#fff" : col} /> : null}
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: solid ? "#fff" : col, fontSize: 15 }}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export const StatusPill: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <View
    style={{
      alignSelf: "center",
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: color + "22",
      borderWidth: 1,
      borderColor: color + "66",
    }}
  >
    <Text style={{ fontFamily: "Poppins_600SemiBold", color, fontSize: 12 }}>{label}</Text>
  </View>
);

export const Banner: React.FC<{ text: string; tone: "success" | "warning" | "danger" }> = ({ text, tone }) => {
  const c = useHospitalityColors();
  const col = tone === "success" ? c.success : tone === "warning" ? c.warning : c.danger;
  return (
    <View
      style={{
        backgroundColor: col + "22",
        borderWidth: 1,
        borderColor: col + "55",
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontFamily: "Poppins_600SemiBold", color: col, textAlign: "center", fontSize: 13 }}>{text}</Text>
    </View>
  );
};
