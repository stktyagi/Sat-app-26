// src/components/admin/UserFilters.tsx
import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { X, Filter } from "lucide-react-native";
import { UserFilters } from '@/types/adminTypes';
import CampusFilterDropdown from "./CampusFilterDropdown";

interface UserFiltersProps {
  filters: UserFilters;
  onFiltersChange: (filters: UserFilters) => void;
  onClearFilters: () => void;
}

const UserFiltersComponent: React.FC<UserFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
}) => {
  const ambassadorOptions = [
    { value: "all", label: "All Users" },
    { value: "ambassadors", label: "Ambassadors" },
    { value: "non-ambassadors", label: "Non-Ambassadors" },
  ];

  const handleCampusFilter = (value: string) => {
    onFiltersChange({ ...filters, campusFilter: value });
  };

  const handleAmbassadorFilter = (value: string) => {
    onFiltersChange({ ...filters, ambassadorFilter: value as any });
  };

  const hasActiveFilters =
    filters.campusFilter !== "all" ||
    filters.ambassadorFilter !== "all" ||
    filters.searchTerm.trim() !== "";

  return (
    <View className="bg-[#1A1A1A] px-4 py-3">
      {/* Filter Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Filter size={16} color="#FFBA00" />
          <Text
            style={{ fontFamily: "Outfit_600SemiBold" }}
            className="text-white ml-2 text-base"
          >
            Filters
          </Text>
        </View>

        {hasActiveFilters && (
          <TouchableOpacity
            onPress={onClearFilters}
            className="flex-row items-center bg-red-500/20 px-3 py-1 rounded-full"
          >
            <X size={14} color="#EF4444" />
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-red-400 ml-1 text-sm"
            >
              Clear All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Campus Filter */}
      <View className="mb-3">
        <Text
          style={{ fontFamily: "Outfit_500Medium" }}
          className="text-gray-400 text-sm mb-2"
        >
          Campus
        </Text>
        <CampusFilterDropdown
          value={filters.campusFilter}
          onSelect={handleCampusFilter}
        />
      </View>

      {/* Ambassador Filter */}
      <View>
        <Text
          style={{ fontFamily: "Outfit_500Medium" }}
          className="text-gray-400 text-sm mb-2"
        >
          Role
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row space-x-2">
            {ambassadorOptions.map((option) => {
              const isSelected = filters.ambassadorFilter === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => handleAmbassadorFilter(option.value)}
                  className={`px-4 py-2 rounded-full border ${
                    isSelected
                      ? "bg-purple-500 border-purple-500"
                      : "bg-[#2C2C2C] border-[#3C3C3C]"
                  }`}
                >
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className={`text-sm ${
                      isSelected ? "text-white" : "text-gray-300"
                    }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <View className="mt-3 pt-3 border-t border-gray-700">
          <Text
            style={{ fontFamily: "Outfit_400Regular" }}
            className="text-gray-500 text-xs"
          >
            Active filters: {filters.campusFilter !== "all" && "Campus"}
            {filters.ambassadorFilter !== "all" && " • Role"}
            {filters.searchTerm.trim() && " • Search"}
          </Text>
        </View>
      )}
    </View>
  );
};

export default UserFiltersComponent;
