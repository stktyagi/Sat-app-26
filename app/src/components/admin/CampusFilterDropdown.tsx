// src/components/admin/CampusFilterDropdown.tsx
import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import {
  Gesture,
  Pressable as GesturePressable,
  ScrollView as GestureScrollView,
} from "react-native-gesture-handler";
import { GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { searchColleges } from '@/data/Colleges';

interface CampusFilterDropdownProps {
  value: string;
  onSelect: (campus: string) => void;
  className?: string;
}

const CampusFilterDropdown: React.FC<CampusFilterDropdownProps> = ({
  value,
  onSelect,
  className = "",
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredColleges, setFilteredColleges] = useState<string[]>([]);

  // Predefined options
  const predefinedOptions = [
    { value: "all", label: "All Colleges" },
    { value: "host", label: "Host College" },
    { value: "external", label: "External Colleges" },
  ];

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const results = searchColleges(searchQuery);
      setFilteredColleges(results);
    } else {
      setFilteredColleges([]);
    }
  }, [searchQuery]);

  const handleSelectOption = (optionValue: string) => {
    onSelect(optionValue);
    setSearchQuery("");
    setShowDropdown(false);
  };

  const getDisplayLabel = () => {
    const predefined = predefinedOptions.find((opt) => opt.value === value);
    if (predefined) return predefined.label;
    return value || "All Colleges";
  };

  const panGesture = Gesture.Pan().onChange(() => {});

  return (
    <View className={`relative ${className}`}>
      <TouchableOpacity
        className={`px-4 py-2 rounded-full border ${
          value !== "all"
            ? "bg-[#FFBA00] border-[#FFBA00]"
            : "bg-[#2C2C2C] border-[#3C3C3C]"
        } flex-row justify-between items-center min-w-[120px]`}
        onPress={() => setShowDropdown(!showDropdown)}
      >
        <Text
          style={{ fontFamily: "Outfit_500Medium" }}
          className={`text-sm ${
            value !== "all" ? "text-black" : "text-gray-300"
          }`}
          numberOfLines={1}
        >
          {getDisplayLabel()}
        </Text>
        <Ionicons
          name={showDropdown ? "chevron-up" : "chevron-down"}
          size={16}
          color={value !== "all" ? "#121212" : "#9CA3AF"}
          style={{ marginLeft: 8 }}
        />
      </TouchableOpacity>

      {showDropdown && (
        <View
          onStartShouldSetResponder={() => true}
          className="absolute top-[40px] left-0 right-0 bg-[#1A1A1A] border border-[#3C3C3C] rounded-xl shadow-lg z-50 min-w-[250px]"
          style={{ minWidth: 250 }}
        >
          {/* Search Input */}
          <View className="p-3 border-b border-[#3C3C3C]">
            <TextInput
              className="p-3 bg-[#2C2C2C] rounded-lg text-white"
              style={{ fontFamily: "Outfit_400Regular" }}
              placeholder="Search colleges..."
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={false}
            />
          </View>

          {/* Results List */}
          <GestureDetector gesture={panGesture}>
            <GestureScrollView
              className="max-h-60"
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Predefined Options */}
              {searchQuery.trim().length === 0 && (
                <>
                  {predefinedOptions.map((option) => (
                    <GesturePressable
                      key={option.value}
                      style={{
                        backgroundColor:
                          value === option.value ? "#FFBA00" : "transparent",
                        marginHorizontal: 8,
                        marginVertical: 2,
                        borderRadius: 8,
                      }}
                      onPress={() => handleSelectOption(option.value)}
                    >
                      <View className="flex-row items-center justify-between p-3">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className={`text-sm flex-1 ${
                            value === option.value
                              ? "text-black font-semibold"
                              : "text-white"
                          }`}
                        >
                          {option.label}
                        </Text>
                        {value === option.value && (
                          <Ionicons
                            name="checkmark"
                            size={20}
                            color="#121212"
                          />
                        )}
                      </View>
                    </GesturePressable>
                  ))}

                  {/* Separator */}
                  <View className="h-px bg-[#3C3C3C] mx-3 my-2" />

                  <View className="px-3 py-2">
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-gray-400 text-xs uppercase tracking-wide"
                    >
                      Specific Colleges
                    </Text>
                  </View>
                </>
              )}

              {/* College Search Results */}
              {searchQuery.trim().length > 0 ? (
                filteredColleges.length > 0 ? (
                  filteredColleges.map((college) => (
                    <GesturePressable
                      key={college}
                      style={{
                        backgroundColor:
                          value === college ? "#FFBA00" : "transparent",
                        marginHorizontal: 8,
                        marginVertical: 2,
                        borderRadius: 8,
                      }}
                      onPress={() => handleSelectOption(college)}
                    >
                      <View className="flex-row items-center justify-between p-3">
                        <Text
                          style={{ fontFamily: "Outfit_400Regular" }}
                          className={`text-sm flex-1 ${
                            value === college
                              ? "text-black font-semibold"
                              : "text-white"
                          }`}
                          numberOfLines={2}
                        >
                          {college}
                        </Text>
                        {value === college && (
                          <Ionicons
                            name="checkmark"
                            size={20}
                            color="#121212"
                          />
                        )}
                      </View>
                    </GesturePressable>
                  ))
                ) : (
                  <View className="p-4">
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-gray-500 text-center"
                    >
                      No colleges found for "{searchQuery}"
                    </Text>
                  </View>
                )
              ) : (
                <View className="p-4">
                  <Text
                    style={{ fontFamily: "Outfit_400Regular" }}
                    className="text-gray-500 text-center text-sm"
                  >
                    Type to search for specific colleges
                  </Text>
                </View>
              )}
            </GestureScrollView>
          </GestureDetector>
        </View>
      )}
    </View>
  );
};

export default CampusFilterDropdown;
