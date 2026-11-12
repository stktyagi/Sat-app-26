import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "@/state/themeStore";
import {
  HOSTEL_LIST,
  BOYS_HOSTELS,
  GIRLS_HOSTELS,
  HostelOption,
  findHostel,
  formatHostelName,
  getHostelItemLabels,
} from "@/data/hostels";

export interface HostelPickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedCode?: string | null;
  onSelect: (hostelCode: string) => void;
  title?: string;
}

export const HostelPickerModal: React.FC<HostelPickerModalProps> = ({
  visible,
  onClose,
  selectedCode,
  onSelect,
  title = "Select Hostel",
}) => {
  const { isDark } = useThemeStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeGender, setActiveGender] = useState<"all" | "boys" | "girls">("all");

  const modalBg = isDark ? "#1C1C20" : "#FFFFFF";
  const modalBorder = isDark ? "#2A2A30" : "#E5E7EB";
  const cardBg = isDark ? "#24242A" : "#F8FAFC";
  const cardBorder = isDark ? "#2E2E36" : "#E2E8F0";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#9CA3AF" : "#6B7280";
  const inputBg = isDark ? "#18181C" : "#F3F4F6";
  const accentBlue = "#41B8F0";

  // Filter hostels based on search and gender tab
  const filteredBoys = useMemo(() => {
    if (activeGender === "girls") return [];
    return BOYS_HOSTELS.filter((h) => matchHostel(h, searchQuery));
  }, [searchQuery, activeGender]);

  const filteredGirls = useMemo(() => {
    if (activeGender === "boys") return [];
    return GIRLS_HOSTELS.filter((h) => matchHostel(h, searchQuery));
  }, [searchQuery, activeGender]);

  const handleSelect = (code: string) => {
    onSelect(code);
    setSearchQuery("");
    onClose();
  };

  const handleClear = () => {
    onSelect("");
    setSearchQuery("");
    onClose();
  };

  const currentSelectedHostel = useMemo(
    () => findHostel(selectedCode),
    [selectedCode]
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
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
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <View>
              <Text
                style={{
                  fontFamily: "Poppins_700Bold",
                  color: textPrimary,
                  fontSize: 18,
                }}
              >
                {title}
              </Text>
              <Text
                style={{
                  fontFamily: "Poppins_400Regular",
                  color: textSecondary,
                  fontSize: 12,
                }}
              >
                Choose from allotted campus hostels
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                alignItems: "center",
                justifyContent: "center",
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color={textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: inputBg,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderWidth: 1,
              borderColor: cardBorder,
              marginBottom: 10,
            }}
          >
            <Ionicons name="search-outline" size={16} color={accentBlue} />
            <TextInput
              style={{
                fontFamily: "Poppins_400Regular",
                fontSize: 13,
                color: textPrimary,
                flex: 1,
                marginLeft: 8,
              }}
              placeholder="Search by new name, old name or code..."
              placeholderTextColor={textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={16} color={textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Gender Filter Tabs */}
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
            {(["all", "boys", "girls"] as const).map((tab) => {
              const isSelected = activeGender === tab;
              const label =
                tab === "all"
                  ? "All"
                  : tab === "boys"
                  ? "Boys' Hostels"
                  : "Girls' Hostels";
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveGender(tab)}
                  style={{
                    flex: 1,
                    paddingVertical: 7,
                    borderRadius: 8,
                    alignItems: "center",
                    backgroundColor: isSelected
                      ? accentBlue
                      : isDark
                      ? "rgba(255, 255, 255, 0.06)"
                      : "#F1F5F9",
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      fontSize: 11,
                      color: isSelected ? "#FFFFFF" : textSecondary,
                    }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Hostel Items List */}
          <ScrollView
            style={{ maxHeight: 340 }}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* Boys' Section */}
            {filteredBoys.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                  <Text
                    style={{
                      fontFamily: "Poppins_700Bold",
                      fontSize: 11,
                      color: accentBlue,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                    }}
                  >
                    Boys' Hostels ({filteredBoys.length})
                  </Text>
                </View>
                {filteredBoys.map((hostel) => (
                  <HostelRowItem
                    key={hostel.code}
                    hostel={hostel}
                    isSelected={
                      selectedCode === hostel.code ||
                      currentSelectedHostel?.code === hostel.code
                    }
                    onSelect={() => handleSelect(hostel.code)}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    accentBlue={accentBlue}
                  />
                ))}
              </View>
            )}

            {/* Girls' Section */}
            {filteredGirls.length > 0 && (
              <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                  <Text
                    style={{
                      fontFamily: "Poppins_700Bold",
                      fontSize: 11,
                      color: "#EC4899",
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                    }}
                  >
                    Girls' Hostels ({filteredGirls.length})
                  </Text>
                </View>
                {filteredGirls.map((hostel) => (
                  <HostelRowItem
                    key={hostel.code}
                    hostel={hostel}
                    isSelected={
                      selectedCode === hostel.code ||
                      currentSelectedHostel?.code === hostel.code
                    }
                    onSelect={() => handleSelect(hostel.code)}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    accentBlue={accentBlue}
                  />
                ))}
              </View>
            )}

            {filteredBoys.length === 0 && filteredGirls.length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 30 }}>
                <Ionicons name="search" size={32} color={textSecondary} />
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    fontSize: 13,
                    color: textSecondary,
                    marginTop: 8,
                  }}
                >
                  No hostels matching "{searchQuery}"
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Clear Selection Button if currently selected */}
          {selectedCode ? (
            <TouchableOpacity
              onPress={handleClear}
              style={{
                marginTop: 10,
                paddingVertical: 9,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: isDark ? "rgba(239, 68, 68, 0.12)" : "#FEE2E2",
                borderWidth: 1,
                borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#FCA5A5",
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 12,
                  color: "#EF4444",
                }}
              >
                Clear Hostel Allotment
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const HostelRowItem: React.FC<{
  hostel: HostelOption;
  isSelected: boolean;
  onSelect: () => void;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  accentBlue: string;
}> = ({
  hostel,
  isSelected,
  onSelect,
  cardBg,
  cardBorder,
  textPrimary,
  textSecondary,
  accentBlue,
}) => {
  const { primary, secondary } = getHostelItemLabels(hostel);

  return (
    <TouchableOpacity
      onPress={onSelect}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: isSelected ? "rgba(65, 184, 240, 0.14)" : cardBg,
        borderRadius: 12,
        paddingVertical: 9,
        paddingHorizontal: 12,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: isSelected ? accentBlue : cardBorder,
      }}
      activeOpacity={0.7}
    >
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text
          style={{
            fontFamily: "Poppins_600SemiBold",
            fontSize: 13,
            color: isSelected ? accentBlue : textPrimary,
          }}
          numberOfLines={1}
        >
          {primary}
        </Text>
        <Text
          style={{
            fontFamily: "Poppins_400Regular",
            fontSize: 11,
            color: textSecondary,
            marginTop: 1,
          }}
        >
          {secondary ? `${secondary} • ` : ""}Code: {hostel.code}
        </Text>
      </View>

      {isSelected ? (
        <Ionicons name="checkmark-circle" size={18} color={accentBlue} />
      ) : (
        <Ionicons name="chevron-forward" size={14} color={textSecondary} />
      )}
    </TouchableOpacity>
  );
};

function matchHostel(hostel: HostelOption, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();
  if (hostel.code.toLowerCase().includes(q)) return true;
  if (hostel.oldName.toLowerCase().includes(q)) return true;
  if (hostel.newName && hostel.newName.toLowerCase().includes(q)) return true;
  // Match single letter e.g. "A" -> "Hostel A"
  const letter = hostel.oldName.replace(/hostel/i, "").trim().toLowerCase();
  if (letter === q) return true;
  return false;
}
