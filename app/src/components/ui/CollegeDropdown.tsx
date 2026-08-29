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
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredColleges, setFilteredColleges] = useState<string[]>([]);

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const results = searchColleges(searchQuery);
      setFilteredColleges(results);
    } else {
      setFilteredColleges([]);
    }
  }, [searchQuery]);

  const handleSelectCollege = (college: string) => {
    onSelect(college);
    setSearchQuery("");
    setShowDropdown(false);
  };

  const panGesture = Gesture.Pan().onChange(() => {});

  return (
    <View className={`relative ${className}`}>
      <Text style={{ fontFamily: "Outfit_500Medium" }} className="text-lg text-[#0C3572] mb-2">{label}</Text>

      <TouchableOpacity
        className="p-4 bg-transparent rounded-lg border border-[#0C3572] flex-row justify-between items-center"
        onPress={() => setShowDropdown(!showDropdown)}
      >
        <Text className={value ? "text-[#0C3572]" : "text-[#2175C0]"}>
          {value || placeholder}
        </Text>
        <Ionicons
          name={showDropdown ? "chevron-up" : "chevron-down"}
          size={20}
          color="#0C3572"
        />
      </TouchableOpacity>

      {showDropdown && (
        <View
          onStartShouldSetResponder={() => true}
          className="absolute top-[72px] left-0 right-0 bg-white border border-[#0C3572] rounded-lg shadow-lg z-20"
        >
          {/* Search Input */}
          <View className="p-3 border-b border-[#0C3572]">
            <TextInput
              className="p-3 bg-white border border-[#0C3572] rounded-lg text-[#0C3572]"
              placeholder="Type to search colleges..."
              placeholderTextColor="#2175C0"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>

          {/* Results List */}
          <GestureDetector gesture={panGesture}>
            <GestureScrollView
              className="max-h-60"
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              {filteredColleges.length > 0 ? (
                filteredColleges.map((college) => (
                  <GesturePressable
                    key={college}
                    style={{
                      marginBottom: 5,
                      borderWidth: value === college ? 2 : 0,
                      borderColor: value === college ? "#FFBA00" : "transparent",
                      borderStyle: "solid",
                      borderRadius: 8,
                    }}
                    onPress={() => handleSelectCollege(college)}
                  >
                    <View className="flex-row items-center justify-between p-3">
                      <Text
                        className={`text-sm flex-1 ${
                          value === college
                            ? "text-[#FFBA00] font-semibold"
                            : "text-[#0C3572]"
                        }`}
                        numberOfLines={2}
                      >
                        {college}
                      </Text>
                      {value === college && (
                        <Ionicons name="checkmark" size={20} color="#FFBA00" />
                      )}
                    </View>
                  </GesturePressable>
                ))
              ) : (
                <View className="p-4">
                  <Text className="text-gray-500 text-center">
                    {searchQuery.trim().length > 0
                      ? "No colleges found"
                      : "Start typing to search colleges"}
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
