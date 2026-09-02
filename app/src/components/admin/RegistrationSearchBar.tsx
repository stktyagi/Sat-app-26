import React, { memo } from "react";
import { View, TextInput } from "react-native";

interface RegistrationSearchBarProps {
  searchInput: string; // Controlled value from parent
  onSearch: (term: string) => void; // Called on every change
  onClear: () => void; // Not used anymore but kept for compatibility
  searchQuery: string; // Not used anymore but kept for compatibility
}

const SearchBar = memo(
  ({ searchInput, onSearch }: RegistrationSearchBarProps) => {
    const handleTextChange = (text: string) => {
      // Search on every keystroke
      onSearch(text);
    };

    return (
      <View className="flex-row items-center justify-center mb-4">
        <View className="flex-1">
          <TextInput
            value={searchInput}
            onChangeText={handleTextChange}
            placeholder="Search by name, email, or team name..."
            placeholderTextColor="#9CA3AF"
            className="border border-[#2C2C2C] rounded-xl px-4 py-3 bg-[#1a1a1a] text-white"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      </View>
    );
  }
);

// Add display name for better debugging
SearchBar.displayName = "SearchBar";

export default SearchBar;