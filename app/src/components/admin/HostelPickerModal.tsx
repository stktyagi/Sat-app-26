import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "@/state/themeStore";
import { AdminHostel, getHostels } from "@/api/admin";

export interface HostelPickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedCode?: string | null;
  onSelect: (hostelId: string) => void;
  title?: string;
  /** Pre-loaded hostels; when omitted the list is fetched on open. */
  hostels?: AdminHostel[];
  /** Participant gender; hostels that don't accept it are hidden. */
  userGender?: string;
  allowClear?: boolean;
}

const normGender = (g?: string) => {
  const v = (g || "").trim().toLowerCase();
  if (!v) return "";
  return v.startsWith("f") ? "female" : "male";
};

export const HostelPickerModal: React.FC<HostelPickerModalProps> = ({
  visible,
  onClose,
  selectedCode,
  onSelect,
  title = "Select Hostel",
  hostels: providedHostels,
  userGender,
  allowClear = false,
}) => {
  const { isDark } = useThemeStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeGender, setActiveGender] = useState<"all" | "male" | "female">("all");
  const [fetched, setFetched] = useState<AdminHostel[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalBg = isDark ? "#1C1C20" : "#FFFFFF";
  const modalBorder = isDark ? "#2A2A30" : "#E5E7EB";
  const cardBg = isDark ? "#24242A" : "#F8FAFC";
  const cardBorder = isDark ? "#2E2E36" : "#E2E8F0";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#9CA3AF" : "#6B7280";
  const inputBg = isDark ? "#18181C" : "#F3F4F6";
  const accentBlue = "#41B8F0";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getHostels();
      setFetched(res.hostels);
    } catch (e: any) {
      setError(e?.message || "Failed to load hostels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && !providedHostels) load();
  }, [visible, providedHostels, load]);

  const ug = normGender(userGender);
  const all = providedHostels ?? fetched ?? [];

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return all.filter((h) => {
      if (!h.active) return false;
      if (ug && h.gender !== "any" && h.gender !== ug) return false;
      if (activeGender !== "all" && h.gender !== "any" && h.gender !== activeGender) return false;
      if (q && !h.name.toLowerCase().includes(q) && !h.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, searchQuery, activeGender, ug]);

  const handleSelect = (id: string) => {
    onSelect(id);
    setSearchQuery("");
    onClose();
  };

  const tabs: { key: "all" | "male" | "female"; label: string }[] = ug
    ? [{ key: "all", label: ug === "female" ? "Girls" : "Boys" }]
    : [
        { key: "all", label: "All" },
        { key: "male", label: "Boys" },
        { key: "female", label: "Girls" },
      ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 40,
        }}
      >
        <View
          style={{
            backgroundColor: modalBg,
            borderRadius: 22,
            padding: 20,
            width: "100%",
            maxWidth: 380,
            maxHeight: "85%",
            borderWidth: 1,
            borderColor: modalBorder,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Text style={{ color: textPrimary, fontSize: 18, fontWeight: "700" }}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={textSecondary} />
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: inputBg,
              borderRadius: 12,
              paddingHorizontal: 12,
              marginBottom: 12,
            }}
          >
            <Ionicons name="search" size={16} color={textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search hostel"
              placeholderTextColor={textSecondary}
              style={{ flex: 1, color: textPrimary, paddingVertical: 10, paddingHorizontal: 8 }}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            {tabs.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setActiveGender(t.key)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: activeGender === t.key ? accentBlue : cardBg,
                  borderWidth: 1,
                  borderColor: activeGender === t.key ? accentBlue : cardBorder,
                }}
              >
                <Text style={{ color: activeGender === t.key ? "#fff" : textSecondary, fontWeight: "600", fontSize: 13 }}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color={accentBlue} style={{ marginVertical: 24 }} />
          ) : error ? (
            <TouchableOpacity onPress={load} style={{ paddingVertical: 20, alignItems: "center" }}>
              <Text style={{ color: "#EF4444", marginBottom: 6 }}>{error}</Text>
              <Text style={{ color: accentBlue, fontWeight: "600" }}>Tap to retry</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
              {filtered.length === 0 && (
                <Text style={{ color: textSecondary, textAlign: "center", paddingVertical: 20 }}>
                  No hostels available. EB can add hostels in Hospitality Control.
                </Text>
              )}
              {filtered.map((h) => {
                const selected = h.id === selectedCode;
                const disabled = h.isFull && !selected;
                const pct = h.capacity > 0 ? Math.min(1, h.occupied / h.capacity) : 1;
                const barColor = pct >= 1 ? "#EF4444" : pct >= 0.85 ? "#F59E0B" : "#22C55E";
                return (
                  <TouchableOpacity
                    key={h.id}
                    disabled={disabled}
                    onPress={() => handleSelect(h.id)}
                    style={{
                      backgroundColor: cardBg,
                      borderRadius: 14,
                      padding: 12,
                      borderWidth: 1.5,
                      borderColor: selected ? accentBlue : cardBorder,
                      opacity: disabled ? 0.45 : 1,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: textPrimary, fontWeight: "700", fontSize: 15 }}>{h.name}</Text>
                        <Text style={{ color: textSecondary, fontSize: 12, marginTop: 2 }}>
                          {h.gender === "any" ? "Any gender" : h.gender === "female" ? "Girls" : "Boys"} ·{" "}
                          {h.isFull ? "Full" : `${h.remaining} beds left`}
                        </Text>
                      </View>
                      <Text style={{ color: textPrimary, fontWeight: "700" }}>
                        {h.occupied}/{h.capacity}
                      </Text>
                      {selected && <Ionicons name="checkmark-circle" size={20} color={accentBlue} style={{ marginLeft: 8 }} />}
                    </View>
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: cardBorder, marginTop: 8, overflow: "hidden" }}>
                      <View style={{ width: `${pct * 100}%`, height: 4, backgroundColor: barColor }} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {allowClear && selectedCode ? (
            <TouchableOpacity onPress={() => handleSelect("")} style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={{ color: "#EF4444", fontWeight: "600" }}>Clear selection</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

export default HostelPickerModal;
