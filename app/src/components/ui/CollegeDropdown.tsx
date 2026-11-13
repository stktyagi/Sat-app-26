import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { searchColleges, loadCollegesAsync, subscribeToColleges } from "@/data/Colleges";
import { useThemeStore } from "@/state/themeStore";

interface CollegeDropdownProps {
  value: string;
  onSelect: (college: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export const CollegeDropdown: React.FC<CollegeDropdownProps> = ({
  value,
  onSelect,
  label = "College Name",
  placeholder = "Search and select your college",
  className = "",
}) => {
  const { isDark } = useThemeStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collegeVersion, setCollegeVersion] = useState(0);

  useEffect(() => {
    // Preload / sync colleges from backend on mount
    loadCollegesAsync().catch(() => {});
    const unsubscribe = subscribeToColleges(() => {
      setCollegeVersion((v) => v + 1);
    });
    return () => unsubscribe();
  }, []);

  // Whenever the dropdown opens, trigger a fresh fetch to ensure up-to-date data
  useEffect(() => {
    if (showDropdown) {
      loadCollegesAsync(true).catch(() => {});
    }
  }, [showDropdown]);

  const bg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.14)" : "#D1D5DB";
  const textColor = isDark ? "#FFFFFF" : "#111827";
  const labelColor = isDark ? "#FFFFFF" : "#111827";
  const placeholderColor = isDark ? "#9CA3AF" : "#6B7280";
  const searchBg = isDark ? "#131316" : "#F3F4F6";

  const filteredColleges = useMemo(
    () => (searchQuery.trim().length > 0 ? searchColleges(searchQuery) : []),
    [searchQuery, collegeVersion]
  );

  const close = () => {
    setShowDropdown(false);
    setSearchQuery("");
  };

  const handleSelectCollege = (college: string) => {
    onSelect(college);
    close();
  };

  return (
    <View className={`mb-4 ${className}`}>
      {label && (
        <Text
          style={{
            fontFamily: "Poppins_600SemiBold",
            color: labelColor,
            fontSize: 14,
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      )}

      <TouchableOpacity
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: bg,
          borderWidth: 1.5,
          borderColor: cardBorder,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          minHeight: 50,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.2 : 0.04,
          shadowRadius: 4,
          elevation: 1,
        }}
        onPress={() => setShowDropdown(true)}
        activeOpacity={0.8}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: "Poppins_500Medium",
            fontSize: 14.5,
            color: value ? textColor : placeholderColor,
            marginRight: 8,
          }}
        >
          {value || placeholder}
        </Text>
        <Ionicons
          name={showDropdown ? "chevron-up" : "chevron-down"}
          size={18}
          color={placeholderColor}
        />
      </TouchableOpacity>

      <Modal
        visible={showDropdown}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            className="flex-1 bg-black/60 justify-center items-center px-4"
            onPress={close}
          >
            <Pressable
              style={{
                backgroundColor: bg,
                borderRadius: 24,
                width: "100%",
                maxHeight: "75%",
                borderWidth: 1,
                borderColor: cardBorder,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.35,
                shadowRadius: 16,
                elevation: 8,
                overflow: "hidden",
              }}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 20,
                  paddingTop: 18,
                  paddingBottom: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: cardBorder,
                }}
              >
                <View>
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      fontSize: 17,
                      color: textColor,
                    }}
                  >
                    Select College
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Poppins_400Regular",
                      fontSize: 12,
                      color: placeholderColor,
                    }}
                  >
                    Search from over 1,000+ registered colleges
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={close}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={24} color={placeholderColor} />
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={{ padding: 16, paddingBottom: 10 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: searchBg,
                    borderWidth: 1,
                    borderColor: cardBorder,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    height: 46,
                  }}
                >
                  <Ionicons
                    name="search"
                    size={18}
                    color={placeholderColor}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    style={{
                      flex: 1,
                      fontFamily: "Poppins_500Medium",
                      fontSize: 14,
                      color: textColor,
                      paddingVertical: 4,
                    }}
                    placeholder="Type to search colleges..."
                    placeholderTextColor={placeholderColor}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <Ionicons name="close" size={18} color={placeholderColor} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* College Options */}
              <ScrollView
                style={{ maxHeight: 320, paddingHorizontal: 16 }}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                {filteredColleges.length > 0 ? (
                  filteredColleges.map((college) => {
                    const isSelected = value === college;
                    return (
                      <TouchableOpacity
                        key={college}
                        onPress={() => handleSelectCollege(college)}
                        activeOpacity={0.7}
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                          marginBottom: 8,
                          borderRadius: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          backgroundColor: isSelected
                            ? isDark
                              ? "rgba(255, 186, 0, 0.15)"
                              : "rgba(255, 186, 0, 0.12)"
                            : isDark
                            ? "#222227"
                            : "#F9FAFB",
                          borderWidth: isSelected ? 1.5 : 1,
                          borderColor: isSelected ? "#FFBA00" : cardBorder,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: isSelected
                              ? "Poppins_600SemiBold"
                              : "Poppins_400Regular",
                            fontSize: 14,
                            color: isSelected ? "#FFBA00" : textColor,
                            flex: 1,
                            marginRight: 8,
                          }}
                        >
                          {college}
                        </Text>
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color="#FFBA00"
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={{ paddingVertical: 28, alignItems: "center" }}>
                    <Ionicons
                      name="school-outline"
                      size={36}
                      color={placeholderColor}
                      style={{ marginBottom: 8, opacity: 0.6 }}
                    />
                    <Text
                      style={{
                        fontFamily: "Poppins_400Regular",
                        fontSize: 13,
                        color: placeholderColor,
                        textAlign: "center",
                      }}
                    >
                      {searchQuery.trim().length > 0
                        ? "No colleges found matching your search."
                        : "Start typing your college name to search."}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};
