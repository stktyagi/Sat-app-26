import React from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import {
  X,
  CreditCard,
  Calendar,
  Tag,
  CheckCircle,
  DollarSign,
  Users,
  MapPin,
  FileText,
} from "lucide-react-native";
import { PaymentTransaction } from '@/types/adminTypes';

interface PaymentTransactionModalProps {
  visible: boolean;
  transaction: PaymentTransaction | null;
  loading: boolean;
  onClose: () => void;
}

const PaymentTransactionModal: React.FC<PaymentTransactionModalProps> = ({
  visible,
  transaction,
  loading,
  onClose,
}) => {
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
              Payment Details
            </Text>
            {transaction && (
              <Text
                style={{ fontFamily: "Outfit_500Medium" }}
                className="text-[#121212] text-sm opacity-80"
              >
                {transaction.merchantOrderId}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="ml-4"
            activeOpacity={0.7}
          >
            <X size={28} color="#121212" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#FFBA00" />
            <Text className="text-gray-600 mt-4">Loading transaction...</Text>
          </View>
        ) : !transaction ? (
          <View className="flex-1 items-center justify-center px-6">
            <FileText size={64} color="#555" />
            <Text className="text-gray-600 text-center mt-4 text-lg">
              No payment transaction found
            </Text>
            <Text className="text-gray-500 text-center mt-2">
              This registration may not have a completed payment or the payment status is not "completed"
            </Text>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 50 }}
          >
            {/* Status Section */}
            <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm">
              <View className="flex-row items-center justify-center mb-4">
                <CheckCircle size={20} color="#10B981" />
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className="ml-2 text-xl text-green-600"
                >
                  PAYMENT SUCCESS
                </Text>
              </View>

              {/* Amount Breakdown */}
              <View className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-[#121212] text-center text-3xl mb-2"
                >
                  {formatAmount(transaction.finalAmount)}
                </Text>

                {transaction.originalAmount !== transaction.finalAmount && (
                  <View className="items-center">
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-gray-500 text-base line-through"
                    >
                      {formatAmount(transaction.originalAmount)}
                    </Text>
                    {transaction.discountAmount > 0 && (
                      <Text
                        style={{ fontFamily: "Outfit_500Medium" }}
                        className="text-green-600 text-base"
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

            {/* Basic Transaction Details */}
            <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#121212] text-lg mb-4"
              >
                Transaction Information
              </Text>

              <DetailRow
                icon={<CreditCard size={18} color="#FFBA00" />}
                label="Merchant Order ID"
                value={transaction.merchantOrderId}
              />

              <DetailRow
                icon={<Tag size={18} color="#6B7280" />}
                label="Transaction ID"
                value={transaction.id}
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
              <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm">
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-[#121212] text-lg mb-4"
                >
                  Event Registration
                </Text>

                <DetailRow
                  icon={<MapPin size={18} color="#FFBA00" />}
                  label="Event ID"
                  value={transaction.processedIntentions.eventRegistration.eventId}
                />

                <DetailRow
                  icon={<Users size={18} color="#6B7280" />}
                  label="Event Type"
                  value={transaction.processedIntentions.eventRegistration.eventType.toUpperCase()}
                />

                {transaction.processedIntentions.eventRegistration.teamName && (
                  <DetailRow
                    icon={<Users size={18} color="#FFBA00" />}
                    label="Team Name"
                    value={
                      transaction.processedIntentions.eventRegistration.teamName
                    }
                  />
                )}

                {transaction.processedIntentions.eventRegistration.teamId && (
                  <DetailRow
                    icon={<Tag size={18} color="#6B7280" />}
                    label="Team ID"
                    value={transaction.processedIntentions.eventRegistration.teamId}
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

            {/* Accommodation Details */}
            {transaction.processedIntentions?.accommodation && (
              <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm">
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-[#121212] text-lg mb-4"
                >
                  Accommodation
                </Text>

                <DetailRow
                  icon={<DollarSign size={18} color="#6B7280" />}
                  label="Accommodation Total"
                  value={formatAmount(
                    transaction.processedIntentions.accommodation.amount || 0
                  )}
                />
              </View>
            )}

            {/* Food Details */}
            {transaction.processedIntentions?.food && (
              <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm">
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-[#121212] text-lg mb-4"
                >
                  Food
                </Text>

                <DetailRow
                  icon={<DollarSign size={18} color="#6B7280" />}
                  label="Food Total"
                  value={formatAmount(
                    transaction.processedIntentions.food.amount || 0
                  )}
                />
              </View>
            )}

            {/* Coupon Details */}
            {transaction.couponCode && transaction.couponDetails && (
              <View className="bg-[#2C2C2C] mx-4 mt-4 mb-4 rounded-xl p-4">
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
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

export default PaymentTransactionModal;
