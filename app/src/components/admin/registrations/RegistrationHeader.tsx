import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { Download } from "lucide-react-native";
import SearchBar from "../../admin/RegistrationSearchBar";

interface RegistrationHeaderProps {
  isExporting: boolean;
  displaySearchInput: string;
  activeSearchQuery: string;
  selectedStatus: string;
  statuses: string[];
  isTeamEvent: boolean;
  registrationCount: number;
  selectedCollegeFilter: string;
  onExport: () => void;
  onSearch: (searchTerm: string) => void;
  onClearSearch: () => void;
  onStatusChange: (status: string) => void;
  onCollegeFilterChange: (filter: string) => void;
}

const getStatusText = (status: string) => {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "awaited":
      return "Awaited";
    case "pending":
      return "Pending";
    case "payment_pending":
      return "Payment Pending";
    case "rejected":
      return "Rejected";
    default:
      return "Unknown";
  }
};

export default function RegistrationHeader({
  isExporting,
  displaySearchInput,
  activeSearchQuery,
  selectedStatus,
  statuses,
  isTeamEvent,
  registrationCount,
  selectedCollegeFilter,
  onExport,
  onSearch,
  onClearSearch,
  onStatusChange,
  onCollegeFilterChange,
}: RegistrationHeaderProps) {
  const collegeFilters = ["all", "thapar", "outside"];
  return (
    <View className="p-6 pb-0">
      {/* Export Button */}
      <TouchableOpacity
        className={`bg-[#FFBA00] rounded-2xl p-4 mb-4 flex-row items-center justify-center ${
          isExporting ? "opacity-50" : ""
        }`}
        onPress={onExport}
        disabled={isExporting}
        activeOpacity={0.7}
      >
        {isExporting ? (
          <ActivityIndicator size="small" color="#121212" />
        ) : (
          <Download size={20} color="#121212" />
        )}
        <Text className="text-[#121212] font-bold text-lg ml-2">
          {isExporting ? "Exporting..." : "Export to CSV"}
        </Text>
      </TouchableOpacity>

      {/* Search and Filter */}
      <View className="mb-4">
        <SearchBar
          searchInput={displaySearchInput}
          onSearch={onSearch}
          onClear={onClearSearch}
          searchQuery={activeSearchQuery}
        />

        {/* Status Filter */}
        <Text className="text-[#0C3572] text-xs font-semibold mb-2 mt-2">Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-3 mb-3">
            {statuses.map((status) => (
              <TouchableOpacity
                key={status}
                className={`px-4 py-2 rounded-full border ${
                  selectedStatus === status
                    ? "bg-[#0C3572] border-[#0C3572]"
                    : "bg-white border-gray-300"
                }`}
                onPress={() => onStatusChange(status)}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-sm font-semibold capitalize ${
                    selectedStatus === status ? "text-white" : "text-[#0C3572]"
                  }`}
                >
                  {status === "all" ? "All" : getStatusText(status)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* College Filter */}
        <Text className="text-[#0C3572] text-xs font-semibold mb-2">College</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-3">
            {collegeFilters.map((filter) => (
              <TouchableOpacity
                key={filter}
                className={`px-4 py-2 rounded-full border ${
                  selectedCollegeFilter === filter
                    ? "bg-[#0C3572] border-[#0C3572]"
                    : "bg-white border-gray-300"
                }`}
                onPress={() => onCollegeFilterChange(filter)}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-sm font-semibold capitalize ${
                    selectedCollegeFilter === filter ? "text-white" : "text-[#0C3572]"
                  }`}
                >
                  {filter === "all" ? "All" : filter === "thapar" ? "Thapar" : "Outside"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Results Count */}
      {registrationCount > 0 && (
        <Text className="text-[#0C3572] text-lg font-bold mb-4 px-6">
          {isTeamEvent
            ? `${registrationCount} Team${
                registrationCount !== 1 ? "s" : ""
              } ${activeSearchQuery ? "Found" : "Loaded"}`
            : `${registrationCount} Registration${
                registrationCount !== 1 ? "s" : ""
              } ${activeSearchQuery ? "Found" : "Loaded"}`}
        </Text>
      )}
    </View>
  );
}
