// src/components/admin/TransactionCard.tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import {
  CreditCard,
  Calendar,
  User,
  Tag,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react-native";
import { PaymentTransaction } from '@/types/adminTypes';

interface TransactionCardProps {
  transaction: PaymentTransaction;
  onPress: (transaction: PaymentTransaction) => void;
}

const TransactionCard: React.FC<TransactionCardProps> = React.memo(
  ({ transaction, onPress }) => {
    const getStatusColor = (status: string) => {
      switch (status.toLowerCase()) {
        case "success":
          return "text-green-400";
        case "failed":
          return "text-red-400";
        case "pending":
          return "text-yellow-400";
        default:
          return "text-gray-400";
      }
    };

    const getStatusIcon = (status: string) => {
      switch (status.toLowerCase()) {
        case "success":
          return <CheckCircle size={16} color="#10B981" />;
        case "failed":
          return <XCircle size={16} color="#EF4444" />;
        case "pending":
          return <Clock size={16} color="#F59E0B" />;
        default:
          return <Clock size={16} color="#6B7280" />;
      }
    };

    const formatDate = (dateString: string) => {
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        return "Invalid Date";
      }
    };

    const formatAmount = (amount: number) => {
      return `₹${amount.toLocaleString("en-IN")}`;
    };

    return (
      <TouchableOpacity
        onPress={() => onPress(transaction)}
        className="bg-[#2C2C2C] rounded-xl p-4 mx-4 mb-3"
        activeOpacity={0.7}
      >
        {/* Header Row */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <CreditCard size={20} color="#FFBA00" />
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-white text-base ml-2 flex-1"
              numberOfLines={1}
            >
              {transaction.merchantOrderId}
            </Text>
          </View>
          <View className="flex-row items-center">
            {getStatusIcon(transaction.status)}
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className={`ml-1 text-sm ${getStatusColor(transaction.status)}`}
            >
              {transaction.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Amount Row */}
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-white text-xl"
            >
              {formatAmount(transaction.finalAmount)}
            </Text>
            {transaction.originalAmount !== transaction.finalAmount && (
              <View className="flex-row items-center">
                <Text
                  style={{ fontFamily: "Outfit_400Regular" }}
                  className="text-gray-400 text-sm"
                >
                  {formatAmount(transaction.originalAmount)}
                </Text>
                {transaction.discountAmount > 0 && (
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className="text-green-400 text-sm ml-2"
                  >
                    -{formatAmount(transaction.discountAmount)}
                  </Text>
                )}
              </View>
            )}
          </View>

          <View className="items-end">
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-gray-300 text-sm capitalize"
            >
              {transaction.paymentType}
            </Text>
            {transaction.transactionFees > 0 && (
              <Text
                style={{ fontFamily: "Outfit_400Regular" }}
                className="text-gray-300 text-sm"
              >
                +₹{transaction.transactionFees} fees
              </Text>
            )}
          </View>
        </View>

        {/* Event/Team Info */}
        {transaction.processedIntentions?.eventRegistration && (
          <View className="bg-[#1A1A1A] rounded-lg p-3 mb-3">
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-gray-300 text-sm mb-1"
            >
              Event Registration
            </Text>
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-white text-sm"
              numberOfLines={1}
            >
              {transaction.eventId}
            </Text>
            {transaction.processedIntentions.eventRegistration.teamName && (
              <Text
                style={{ fontFamily: "Outfit_400Regular" }}
                className="text-gray-400 text-sm"
                numberOfLines={1}
              >
                Team:{" "}
                {transaction.processedIntentions.eventRegistration.teamName}
              </Text>
            )}
          </View>
        )}

        {/* Coupon Info */}
        {transaction.couponCode && (
          <View className="flex-row items-center mb-3">
            <Tag size={14} color="#10B981" />
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-green-400 text-sm ml-1"
            >
              {transaction.couponCode}
            </Text>
          </View>
        )}

        {/* Footer Row */}
        <View className="flex-row items-center justify-between pt-2 border-t border-gray-600">
          <View className="flex-row items-center">
            <User size={14} color="#6B7280" />
            <Text
              style={{ fontFamily: "Outfit_400Regular" }}
              className="text-gray-400 text-xs ml-1"
              numberOfLines={1}
            >
              {transaction.userId}
            </Text>
          </View>

          <View className="flex-row items-center">
            <Calendar size={14} color="#6B7280" />
            <Text
              style={{ fontFamily: "Outfit_400Regular" }}
              className="text-gray-400 text-xs ml-1"
            >
              {formatDate(transaction.createdAt)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }
);

export default TransactionCard;
