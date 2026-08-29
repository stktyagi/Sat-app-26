// src/components/admin/TransactionDetailModal.tsx
import React from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import {
  X,
  CreditCard,
  User,
  Calendar,
  Tag,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Users,
  MapPin,
} from "lucide-react-native";
import { PaymentTransaction } from '@/types/adminTypes';

interface TransactionDetailModalProps {
  visible: boolean;
  transaction: PaymentTransaction | null;
  onClose: () => void;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  visible,
  transaction,
  onClose,
}) => {
  if (!transaction) return null;

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
        return <CheckCircle size={20} color="#10B981" />;
      case "failed":
        return <XCircle size={20} color="#EF4444" />;
      case "pending":
        return <Clock size={20} color="#F59E0B" />;
      default:
        return <Clock size={20} color="#6B7280" />;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "Invalid Date";
    }
  };

  const formatAmount = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const DetailRow = ({
    icon,
    label,
    value,
    valueColor = "text-white",
  }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    valueColor?: string;
  }) => (
    <View className="flex-row items-start py-3 border-b border-gray-700">
      <View className="mr-3 mt-1">{icon}</View>
      <View className="flex-1">
        <Text
          style={{ fontFamily: "Outfit_500Medium" }}
          className="text-gray-400 text-sm mb-1"
        >
          {label}
        </Text>
        <Text
          style={{ fontFamily: "Outfit_600SemiBold" }}
          className={`text-base ${valueColor}`}
          selectable
        >
          {value}
        </Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-[#121212]">
        {/* Header */}
        <View className="bg-[#FFBA00] pt-12 pb-6 px-6 flex-row rounded-b-2xl items-center justify-between">
          <View className="flex-1">
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#121212] text-2xl"
            >
              Transaction Details
            </Text>
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-[#121212] text-sm opacity-80"
            >
              {transaction.merchantOrderId}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="ml-4"
            activeOpacity={0.7}
          >
            <X size={28} color="#121212" />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 50 }}
        >
          {/* Status Section */}
          <View className="bg-[#2C2C2C] mx-4 mt-4 rounded-xl p-4">
            <View className="flex-row items-center justify-center mb-4">
              {getStatusIcon(transaction.status)}
              <Text
                style={{ fontFamily: "Outfit_700Bold" }}
                className={`ml-2 text-xl ${getStatusColor(transaction.status)}`}
              >
                {transaction.status.toUpperCase()}
              </Text>
            </View>

            {/* Amount Breakdown */}
            <View className="bg-[#1A1A1A] rounded-lg p-4">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-white text-center text-3xl mb-2"
              >
                {formatAmount(transaction.finalAmount)}
              </Text>

              {transaction.originalAmount !== transaction.finalAmount && (
                <View className="items-center">
                  <Text
                    style={{ fontFamily: "Outfit_400Regular" }}
                    className="text-gray-400 text-lg"
                  >
                    {formatAmount(transaction.originalAmount)} + {" "}
                    {formatAmount(transaction.transactionFees)}
                  </Text>
                  {transaction.discountAmount > 0 && (
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-green-400 text-base"
                    >
                      Discount: -{formatAmount(transaction.discountAmount)}
                    </Text>
                  )}
                </View>
              )}

              {transaction.transactionFees > 0 && (
                <Text
                  style={{ fontFamily: "Outfit_400Regular" }}
                  className="text-gray-500 text-center text-sm mt-1"
                >
                  Transaction Fees: +{formatAmount(transaction.transactionFees)}
                </Text>
              )}
            </View>
          </View>

          {/* Basic Details */}
          <View className="bg-[#2C2C2C] mx-4 mt-4 rounded-xl p-4">
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-white text-lg mb-4"
            >
              Transaction Information
            </Text>

            <DetailRow
              icon={<CreditCard size={18} color="#FFBA00" />}
              label="Merchant Order ID"
              value={transaction.merchantOrderId}
            />

            <DetailRow
              icon={<User size={18} color="#6B7280" />}
              label="User ID"
              value={transaction.userId}
            />

            <DetailRow
              icon={<DollarSign size={18} color="#6B7280" />}
              label="Payment Type"
              value={transaction.paymentType.toUpperCase()}
            />

            <DetailRow
              icon={<Calendar size={18} color="#6B7280" />}
              label="Created At"
              value={formatDate(transaction.createdAt)}
            />

            {transaction.completedAt && (
              <DetailRow
                icon={<Calendar size={18} color="#10B981" />}
                label="Completed At"
                value={formatDate(transaction.completedAt)}
              />
            )}
          </View>

          {/* Event Registration Details */}
          {transaction.processedIntentions?.eventRegistration && (
            <View className="bg-[#2C2C2C] mx-4 mt-4 rounded-xl p-4">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-white text-lg mb-4"
              >
                Event Registration
              </Text>

              <DetailRow
                icon={<MapPin size={18} color="#FFBA00" />}
                label="Event ID"
                value={transaction.eventId}
              />

              <DetailRow
                icon={<Users size={18} color="#6B7280" />}
                label="Event Type"
                value={transaction.processedIntentions.eventRegistration.eventType.toUpperCase()}
              />

              {transaction.processedIntentions.eventRegistration.teamName && (
                <DetailRow
                  icon={<Users size={18} color="#6B7280" />}
                  label="Team Name"
                  value={
                    transaction.processedIntentions.eventRegistration.teamName
                  }
                />
              )}

              {transaction.teamId && (
                <DetailRow
                  icon={<Tag size={18} color="#6B7280" />}
                  label="Team ID"
                  value={transaction.teamId}
                />
              )}

              <DetailRow
                icon={<DollarSign size={18} color="#6B7280" />}
                label="Registration Amount"
                value={formatAmount(
                  transaction.processedIntentions.eventRegistration.amount
                )}
              />
            </View>
          )}

          {/* Coupon Details */}
          {transaction.couponCode && transaction.couponDetails && (
            <View className="bg-[#2C2C2C] mx-4 mt-4 rounded-xl p-4">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-white text-lg mb-4"
              >
                Coupon Applied
              </Text>

              <DetailRow
                icon={<Tag size={18} color="#10B981" />}
                label="Coupon Code"
                value={transaction.couponCode}
                valueColor="text-green-400"
              />

              <DetailRow
                icon={<DollarSign size={18} color="#10B981" />}
                label="Discount Type"
                value={transaction.couponDetails.discountType.toUpperCase()}
              />

              <DetailRow
                icon={<DollarSign size={18} color="#10B981" />}
                label="Discount Value"
                value={
                  transaction.couponDetails.discountType === "flat"
                    ? formatAmount(transaction.couponDetails.discountValue)
                    : `${transaction.couponDetails.discountValue}%`
                }
              />
            </View>
          )}

          {/* Transaction ID for Reference */}
          <View className="bg-[#2C2C2C] mx-4 mt-4 mb-4 rounded-xl p-4">
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-white text-lg mb-4"
            >
              Reference Information
            </Text>

            <DetailRow
              icon={<Tag size={18} color="#6B7280" />}
              label="Document ID"
              value={transaction.id}
            />

            {transaction.teamId && (
              <DetailRow
                icon={<Users size={18} color="#6B7280" />}
                label="Team ID"
                value={transaction.teamId}
              />
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

export default TransactionDetailModal;
