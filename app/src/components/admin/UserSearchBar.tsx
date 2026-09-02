// src/components/admin/UserSearchBar.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
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
    <View className="bg-[#2C2C2C] rounded-xl mx-4 mb-4 mt-4 flex-row items-center px-4 py-3">
      <TextInput
        className="flex-1 text-white text-base"
        style={{ fontFamily: "Outfit_500Medium" }}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
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
          className="ml-2 p-1 rounded-full bg-[#3C3C3C]"
          disabled={loading}
          style={{ opacity: loading ? 0.5 : 1 }}
        >
          <X size={16} color="#9CA3AF" />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={handleSearch}
        className="ml-2 p-2 rounded-lg bg-[#FFBA00]"
        disabled={loading || localSearchTerm.trim().length === 0}
        style={{ opacity: loading || localSearchTerm.trim().length === 0 ? 0.5 : 1 }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#1A1A1A" />
        ) : (
          <Search size={20} color="#1A1A1A" />
        )}
      </TouchableOpacity>
    </View>
  );
};

export default UserSearchBar;
