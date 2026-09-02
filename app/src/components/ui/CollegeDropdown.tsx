import React, { useMemo, useState } from "react";
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

  const filteredColleges = useMemo(
    () => (searchQuery.trim().length > 0 ? searchColleges(searchQuery) : []),
    [searchQuery]
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
    <View className={className}>
      <Text style={{ fontFamily: "Outfit_500Medium" }} className="text-lg text-[#0C3572] mb-2">
        {label}
      </Text>

      <TouchableOpacity
        className="p-4 bg-transparent rounded-lg border border-[#0C3572] flex-row justify-between items-center"
        onPress={() => setShowDropdown(true)}
        activeOpacity={0.7}
      >
        <Text className={value ? "text-[#0C3572] flex-1 pr-2" : "text-[#2175C0] flex-1 pr-2"}>
          {value || placeholder}
        </Text>
        <Ionicons
          name={showDropdown ? "chevron-up" : "chevron-down"}
          size={20}
          color="#0C3572"
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
            className="flex-1 bg-black/50 justify-center items-center"
            onPress={close}
          >
            <Pressable
              className="bg-[#DBE2ED] rounded-xl w-4/5 max-h-[70%] overflow-hidden border-2 border-[#0C3572]"
              onPress={(e) => e.stopPropagation()}
            >
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

              <ScrollView
                className="max-h-80 p-4"
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                {filteredColleges.length > 0 ? (
                  filteredColleges.map((college) => (
                    <TouchableOpacity
                      key={college}
                      onPress={() => handleSelectCollege(college)}
                      className={`p-3 mb-2 rounded-lg flex-row items-center justify-between ${
                        value === college
                          ? "border-2 border-[#FFBA00] bg-[#FFF7E6]"
                          : "border border-[#0C3572] bg-white"
                      }`}
                    >
                      <Text
                        style={{
                          fontFamily:
                            value === college ? "Outfit_600SemiBold" : "Outfit_400Regular",
                        }}
                        className={`text-base flex-1 ${
                          value === college ? "text-black" : "text-[#0C3572]"
                        }`}
                      >
                        {college}
                      </Text>
                      {value === college && (
                        <Ionicons name="checkmark-circle" size={24} color="#FFBA00" />
                      )}
                    </TouchableOpacity>
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
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};
