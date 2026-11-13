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
import { searchColleges, loadCollegesAsync, subscribeToColleges } from "@/data/Colleges";

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
    loadCollegesAsync().catch(() => {});
    const unsubscribe = subscribeToColleges(() => {
      if (searchQuery.trim().length > 0) {
        setFilteredColleges(searchColleges(searchQuery));
      }
    });
    return () => unsubscribe();
  }, [searchQuery]);

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
    if (predefined) {
      return predefined.label;
    }
    return value || "Filter by Campus";
  };

  const renderContent = () => {
    return (
      <View
        className="w-full bg-[#1A1A1E] rounded-2xl border border-white/10 overflow-hidden"
        style={{
          maxHeight: 400,
        }}
      >
        {/* Search Bar */}
        <View className="p-3 border-b border-white/10">
          <View className="flex-row items-center bg-[#2A2A2E] rounded-xl px-3 py-2">
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search colleges..."
              placeholderTextColor="#9CA3AF"
              className="flex-1 ml-2 text-white font-medium text-sm"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Options List */}
        <GestureScrollView
          className="max-h-80"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {/* Predefined Options (only show when not searching) */}
          {searchQuery.trim().length === 0 && (
            <View className="p-2 border-b border-white/5">
              <Text className="text-xs font-semibold text-gray-400 px-3 py-1 uppercase tracking-wider">
                Quick Filters
              </Text>
              {predefinedOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => handleSelectOption(option.value)}
                  className={`flex-row items-center justify-between px-3 py-2.5 rounded-xl ${
                    value === option.value ? "bg-[#FFBA00]/20" : ""
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      value === option.value
                        ? "text-[#FFBA00]"
                        : "text-white"
                    }`}
                  >
                    {option.label}
                  </Text>
                  {value === option.value && (
                    <Ionicons name="checkmark" size={18} color="#FFBA00" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Colleges List */}
          <View className="p-2">
            {searchQuery.trim().length > 0 && (
              <Text className="text-xs font-semibold text-gray-400 px-3 py-1 uppercase tracking-wider">
                Colleges ({filteredColleges.length})
              </Text>
            )}
            {filteredColleges.length > 0 ? (
              filteredColleges.map((college) => (
                <TouchableOpacity
                  key={college}
                  onPress={() => handleSelectOption(college)}
                  className={`flex-row items-center justify-between px-3 py-2.5 rounded-xl ${
                    value === college ? "bg-[#FFBA00]/20" : ""
                  }`}
                >
                  <Text
                    className={`text-sm font-medium flex-1 mr-2 ${
                      value === college ? "text-[#FFBA00]" : "text-white"
                    }`}
                    numberOfLines={1}
                  >
                    {college}
                  </Text>
                  {value === college && (
                    <Ionicons name="checkmark" size={18} color="#FFBA00" />
                  )}
                </TouchableOpacity>
              ))
            ) : searchQuery.trim().length > 0 ? (
              <View className="py-8 items-center">
                <Ionicons name="school-outline" size={32} color="#6B7280" />
                <Text className="text-gray-400 text-sm mt-2">
                  No colleges found
                </Text>
              </View>
            ) : null}
          </View>
        </GestureScrollView>
      </View>
    );
  };

  return (
    <View className={`relative ${className}`}>
      {/* Trigger Button */}
      <TouchableOpacity
        onPress={() => setShowDropdown(!showDropdown)}
        className="flex-row items-center justify-between bg-[#1A1A1E] border border-white/10 rounded-xl px-4 py-3"
      >
        <View className="flex-row items-center flex-1 mr-2">
          <Ionicons name="school-outline" size={20} color="#FFBA00" />
          <Text
            className="text-white font-medium text-sm ml-2 flex-1"
            numberOfLines={1}
          >
            {getDisplayLabel()}
          </Text>
        </View>
        <Ionicons
          name={showDropdown ? "chevron-up" : "chevron-down"}
          size={18}
          color="#9CA3AF"
        />
      </TouchableOpacity>

      {/* Dropdown Modal/Overlay */}
      {showDropdown && (
        <View className="absolute top-full left-0 right-0 mt-2 z-50">
          <GestureDetector
            gesture={Gesture.Tap().onEnd(() => {
              setShowDropdown(false);
            })}
          >
            <GesturePressable
              style={{
                position: "absolute",
                top: -1000,
                bottom: -1000,
                left: -1000,
                right: -1000,
              }}
            />
          </GestureDetector>
          {renderContent()}
        </View>
      )}
    </View>
  );
};

export default CampusFilterDropdown;
