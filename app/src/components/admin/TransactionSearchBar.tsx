// src/components/admin/TransactionSearchBar.tsx
import React, { useState, useEffect } from "react";
import { View, TextInput, ActivityIndicator } from "react-native";
import { Search } from "lucide-react-native";

interface TransactionSearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  loading?: boolean;
}

const TransactionSearchBar: React.FC<TransactionSearchBarProps> = React.memo(
  ({ searchTerm, onSearchChange, loading = false }) => {
    const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);

    // Debounce search input - reduced for better responsiveness
    useEffect(() => {
      const timeoutId = setTimeout(() => {
        onSearchChange(localSearchTerm);
      }, 300); // Reduced to 300ms for better responsiveness

      return () => clearTimeout(timeoutId);
    }, [localSearchTerm, onSearchChange]);

    // Update local state when prop changes (for external updates)
    useEffect(() => {
      setLocalSearchTerm(searchTerm);
    }, [searchTerm]);

    return (
      <View className="px-4 py-3">
        <View className="bg-[#2C2C2C] rounded-xl px-4 py-3 flex-row items-center">
          <Search size={20} color="#6B7280" />
          <TextInput
            value={localSearchTerm}
            onChangeText={setLocalSearchTerm}
            placeholder="Search by Order ID, User ID, Event ID, Team Name..."
            placeholderTextColor="#6B7280"
            className="flex-1 ml-3 text-white text-base"
            style={{ fontFamily: "Outfit_400Regular" }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {loading && (
            <ActivityIndicator size="small" color="#FFBA00" className="ml-2" />
          )}
        </View>
      </View>
    );
  }
);

export default TransactionSearchBar;
