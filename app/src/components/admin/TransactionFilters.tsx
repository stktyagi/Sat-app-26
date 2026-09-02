// src/components/admin/TransactionFilters.tsx
import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Filter, X } from "lucide-react-native";
import { TransactionFilters } from '@/types/adminTypes';

interface TransactionFiltersProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
  onClearFilters: () => void;
}

const TransactionFiltersComponent: React.FC<TransactionFiltersProps> =
  React.memo(({ filters, onFiltersChange, onClearFilters }) => {
    const statusOptions = [
      { value: "all", label: "All Status" },
      { value: "success", label: "Success" },
      { value: "failed", label: "Failed" },
      { value: "pending", label: "Pending" },
    ];

    const paymentTypeOptions = [
      { value: "all", label: "All Types" },
      { value: "event", label: "Event" },
      { value: "accommodation", label: "Accommodation" },
      { value: "food", label: "Food" },
    ];

    const dateRangeOptions = [
      { value: "all", label: "All Time" },
      { value: "today", label: "Today" },
      { value: "week", label: "Last 7 Days" },
      { value: "month", label: "Last 30 Days" },
    ];

    const hasActiveFilters =
      filters.statusFilter !== "all" ||
      filters.paymentTypeFilter !== "all" ||
      filters.dateRange !== "all";

    const getFilterChipColor = (isActive: boolean) => {
      return isActive
        ? "bg-[#FFBA00] text-[#121212]"
        : "bg-[#2C2C2C] text-gray-300";
    };

    return (
      <View className="px-4 py-3">
        {/* Filter Header */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <Filter size={18} color="#FFBA00" />
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-white text-base ml-2"
            >
              Filters
            </Text>
          </View>

          {hasActiveFilters && (
            <TouchableOpacity
              onPress={onClearFilters}
              className="flex-row items-center bg-red-500/20 px-3 py-1 rounded-lg"
              activeOpacity={0.7}
            >
              <X size={14} color="#EF4444" />
              <Text
                style={{ fontFamily: "Outfit_500Medium" }}
                className="text-red-400 text-sm ml-1"
              >
                Clear
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filter */}
        <View className="mb-3">
          <Text
            style={{ fontFamily: "Outfit_500Medium" }}
            className="text-gray-300 text-sm mb-2"
          >
            Status
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row">
              {statusOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() =>
                    onFiltersChange({
                      ...filters,
                      statusFilter: option.value as any,
                    })
                  }
                  className={`px-4 py-2 rounded-full mr-2 ${getFilterChipColor(
                    filters.statusFilter === option.value
                  )}`}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className={`text-sm ${
                      filters.statusFilter === option.value
                        ? "text-[#121212]"
                        : "text-gray-300"
                    }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Payment Type Filter */}
        <View className="mb-3">
          <Text
            style={{ fontFamily: "Outfit_500Medium" }}
            className="text-gray-300 text-sm mb-2"
          >
            Payment Type
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row">
              {paymentTypeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() =>
                    onFiltersChange({
                      ...filters,
                      paymentTypeFilter: option.value as any,
                    })
                  }
                  className={`px-4 py-2 rounded-full mr-2 ${getFilterChipColor(
                    filters.paymentTypeFilter === option.value
                  )}`}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className={`text-sm ${
                      filters.paymentTypeFilter === option.value
                        ? "text-[#121212]"
                        : "text-gray-300"
                    }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Date Range Filter */}
        <View>
          <Text
            style={{ fontFamily: "Outfit_500Medium" }}
            className="text-gray-300 text-sm mb-2"
          >
            Date Range
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row">
              {dateRangeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() =>
                    onFiltersChange({
                      ...filters,
                      dateRange: option.value as any,
                    })
                  }
                  className={`px-4 py-2 rounded-full mr-2 ${getFilterChipColor(
                    filters.dateRange === option.value
                  )}`}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className={`text-sm ${
                      filters.dateRange === option.value
                        ? "text-[#121212]"
                        : "text-gray-300"
                    }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  });

export default TransactionFiltersComponent;
