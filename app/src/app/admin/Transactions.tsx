// src/screens/Admin/Transactions.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { ArrowLeft, CreditCard } from "lucide-react-native";
import { PaymentTransaction, TransactionFilters } from "@/types/adminTypes";
import {
  fetchTransactions,
  clearTransactionsCache,
  hasActiveFilters,
} from "@/api/admin";
import TransactionCard from "@/components/admin/TransactionCard";
import TransactionFiltersComponent from "@/components/admin/TransactionFilters";
import TransactionSearchBar from "@/components/admin/TransactionSearchBar";
import TransactionDetailModal from "@/components/admin/TransactionDetailModal";
import { showAlert } from "@/components";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";

interface TransactionsProps {
  navigation: any;
}

const Transactions: React.FC = () => {
  const navigation = useAdminNavigation();
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] =
    useState<PaymentTransaction | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [filters, setFilters] = useState<TransactionFilters>({
    searchTerm: "",
    statusFilter: "all",
    paymentTypeFilter: "all",
    dateRange: "all",
  });

  // Load transactions when filters change - with immediate UI feedback
  useEffect(() => {
    // Show loading immediately for better UX
    setSearchLoading(true);

    // Small delay to show loading state, then load
    const timeoutId = setTimeout(() => {
      loadTransactions(false);
    }, 50); // Very short delay just to show loading state

    return () => clearTimeout(timeoutId);
  }, [
    filters.statusFilter,
    filters.paymentTypeFilter,
    filters.dateRange,
    filters.searchTerm,
  ]);


  const loadTransactions = async (loadMore: boolean = false) => {
    if (loadMore && (loadingMore || !hasMore)) return;

    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setSearchLoading(true);
      }

      const result = await fetchTransactions(filters, loadMore);

      if (loadMore) {
        setTransactions((prev) => [...prev, ...result.transactions]);
      } else {
        setTransactions(result.transactions);
      }

      setHasMore(result.hasMore);
      setError(null);
    } catch (err) {
      console.error("Error loading transactions:", err);
      setError("Failed to load transactions. Please try again.");
      showAlert(
        "Error",
        "Failed to load transactions. Please check your connection and try again."
      );
    } finally {
      setSearchLoading(false);
      setLoadingMore(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    clearTransactionsCache();
    try {
      await loadTransactions(false);
    } catch (err) {
      console.error("Error refreshing:", err);
    } finally {
      setRefreshing(false);
    }
  }, [filters]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadTransactions(true);
    }
  };

  const handleFiltersChange = (newFilters: TransactionFilters) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({
      searchTerm: "",
      statusFilter: "all",
      paymentTypeFilter: "all",
      dateRange: "all",
    });
  };

  const handleTransactionPress = (transaction: PaymentTransaction) => {
    setSelectedTransaction(transaction);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedTransaction(null);
  };

  const renderEmptyState = () => {
    const hasFiltersActive = hasActiveFilters(filters);

    return (
      <View
        className="items-center justify-center py-20"
        style={{ minHeight: 400 }}
      >
        <CreditCard size={64} color="#6B7280" />
        <Text
          style={{ fontFamily: "Outfit_600SemiBold" }}
          className="text-[#2175C0] text-xl mt-4 text-center"
        >
          {hasFiltersActive ? "No transactions found" : "No transactions yet"}
        </Text>
        <Text
          style={{ fontFamily: "Outfit_400Regular" }}
          className="text-gray-500 text-center mt-2 px-8"
        >
          {hasFiltersActive
            ? "Try adjusting your filters or search terms"
            : "Transactions will appear here once users make payments"}
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-transparent">
      {/* Header */}
      <View className="bg-[#EEB170] pt-4 rounded-b-2xl pb-6 px-6 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.navigate("Dashboard")}
          className="mr-4"
          activeOpacity={0.7}
        >
          <ArrowLeft size={28} color="#121212" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text
            style={{ fontFamily: "Outfit_700Bold" }}
            className="text-[#121212] text-2xl"
          >
            Transactions
          </Text>
          <Text
            style={{ fontFamily: "Outfit_500Medium" }}
            className="text-[#121212] text-sm opacity-80"
          >
            {transactions.length > 0
              ? `${transactions.length} transactions loaded${
                  hasMore ? " (more available)" : ""
                }`
              : "Payment transaction history"}
          </Text>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#EEB170"]}
            tintColor="#EEB170"
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search Bar */}
        <TransactionSearchBar
          searchTerm={filters.searchTerm}
          onSearchChange={(term) =>
            setFilters((prev) => ({ ...prev, searchTerm: term }))
          }
          loading={searchLoading}
        />

        {/* Filters */}
        <TransactionFiltersComponent
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
        />

        {/* Search Loading Indicator */}
        {searchLoading && (
          <View className="flex-row items-center justify-center py-4 mx-4">
            <ActivityIndicator size="small" color="#EEB170" />
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-[#2175C0] ml-2"
            >
              Loading transactions...
            </Text>
          </View>
        )}

        {/* Transactions List */}
        {transactions.length > 0 ? (
          <>
            {transactions.map((transaction) => (
              <TransactionCard
                key={transaction.id}
                transaction={transaction}
                onPress={handleTransactionPress}
              />
            ))}

            {/* Load More Button */}
            {hasMore && (
              <View className="px-4 py-4">
                {/* Info message for first batch */}
                {transactions.length === 50 && (
                  <View className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-3 mb-3">
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-blue-400 text-center text-sm"
                    >
                      Showing first 50 results. Click below to load more.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleLoadMore}
                  className="bg-[#FFFFFF66] py-3 rounded-xl"
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <View className="flex-row items-center justify-center">
                      <ActivityIndicator size="small" color="#EEB170" />
                      <Text
                        style={{ fontFamily: "Outfit_500Medium" }}
                        className="text-[#2175C0] ml-2"
                      >
                        Loading 50 more transactions...
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={{ fontFamily: "Outfit_600SemiBold" }}
                      className="text-[#0C3572] text-center"
                    >
                      Load More Transactions (50 more)
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* End of results message */}
            {!hasMore && transactions.length > 0 && (
              <View className="px-4 py-4">
                <View className="bg-gray-500/20 border border-gray-500/30 rounded-xl p-3">
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className="text-[#2175C0] text-center text-sm"
                  >
                    All {transactions.length} transactions loaded
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : (
          !searchLoading && renderEmptyState()
        )}

        {/* Error State */}
        {error && (
          <View className="mx-4 mb-4">
            <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
              <Text
                style={{ fontFamily: "Outfit_500Medium" }}
                className="text-red-400 text-center"
              >
                {error}
              </Text>
              <TouchableOpacity
                onPress={() => loadTransactions(false)}
                className="mt-2 bg-red-500 py-2 px-4 rounded-lg"
              >
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-[#0C3572] text-center"
                >
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        visible={modalVisible}
        transaction={selectedTransaction}
        onClose={handleCloseModal}
      />
    </View>
  );
};

export default Transactions;
