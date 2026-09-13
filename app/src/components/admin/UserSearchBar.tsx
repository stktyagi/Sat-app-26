// src/components/admin/UserSearchBar.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Text,
} from "react-native";
import { Search, X } from "lucide-react-native";

interface UserSearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  placeholder?: string;
  loading?: boolean;
}

const UserSearchBar: React.FC<UserSearchBarProps> = ({
  searchTerm,
  onSearchChange,
  placeholder = "Enter exact email address...",
  loading = false,
}) => {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);

  // Update local state when external searchTerm changes
  useEffect(() => {
    setLocalSearchTerm(searchTerm);
  }, [searchTerm]);

  const handleSearch = () => {
    onSearchChange(localSearchTerm.trim());
  };

  const handleClear = () => {
    setLocalSearchTerm("");
    onSearchChange("");
  };

  return (
    <View className="bg-white border border-[#2175C0] rounded-xl mx-4 mb-4 mt-4 flex-row items-center px-4 py-3 shadow-sm">
      <Search size={20} color="#2175C0" className="opacity-90" />
      <TextInput
        className="flex-1 text-[#3B3B3B] text-base ml-3"
        style={{ fontFamily: "Outfit_500Medium", backgroundColor: "transparent" }}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={localSearchTerm}
        onChangeText={setLocalSearchTerm}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={handleSearch}
      />

      {localSearchTerm.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          className="mx-2 p-1 rounded-full bg-gray-100"
          disabled={loading}
          style={{ opacity: loading ? 0.5 : 1 }}
        >
          <X size={16} color="#6B7280" />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={handleSearch}
        className="ml-1 px-4 py-2 rounded-lg bg-[#EEB170] flex-row items-center justify-center"
        disabled={loading || localSearchTerm.trim().length === 0}
        style={{ 
          opacity: loading || localSearchTerm.trim().length === 0 ? 0.5 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#121212" />
        ) : (
          <Text style={{ fontFamily: "Outfit_600SemiBold" }} className="text-[#121212] text-sm">
            Search
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default UserSearchBar;
