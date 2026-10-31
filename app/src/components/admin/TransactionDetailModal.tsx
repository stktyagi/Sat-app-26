// src/components/admin/TransactionDetailModal.tsx
import React from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
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
  Sparkles,
  ShieldAlert,
  Receipt,
} from "lucide-react-native";
import { PaymentTransaction } from "@/types/adminTypes";

interface TransactionDetailModalProps {
  visible: boolean;
  transaction: PaymentTransaction | null;
  onClose: () => void;
  onUpdateStatus?: (id: string, newStatus: string) => void;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  visible,
  transaction,
  onClose,
  onUpdateStatus,
}) => {
  if (!transaction) return null;

  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case "success":
        return {
          pillBg: "bg-emerald-500/20 border-emerald-400/40",
          pillText: "text-emerald-300",
          icon: <CheckCircle size={16} color="#34D399" />,
        };
      case "failed":
      case "failure":
        return {
          pillBg: "bg-rose-500/20 border-rose-400/40",
          pillText: "text-rose-300",
          icon: <XCircle size={16} color="#FB7185" />,
        };
      case "pending":
        return {
          pillBg: "bg-amber-500/20 border-amber-400/40",
          pillText: "text-amber-300",
          icon: <Clock size={16} color="#FBBF24" />,
        };
      default:
        return {
          pillBg: "bg-slate-500/20 border-slate-400/40",
          pillText: "text-slate-300",
          icon: <Clock size={16} color="#94A3B8" />,
        };
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
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

  const statusConfig = getStatusConfig(transaction.status);

  const DetailRow = ({
    icon,
    label,
    value,
    valueColor = "text-[#0C3572]",
    isLast = false,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    valueColor?: string;
    isLast?: boolean;
  }) => (
    <View
      className={`flex-row items-center py-2.5 ${
        isLast ? "" : "border-b border-slate-100"
      }`}
    >
      <View className="w-8 h-8 rounded-lg bg-[#EEB170]/15 items-center justify-center mr-3">
        {icon}
      </View>
      <View className="flex-1">
        <Text
          style={{ fontFamily: "Outfit_600SemiBold" }}
          className="text-[#2175C0] text-xs uppercase tracking-wider mb-0.5"
        >
          {label}
        </Text>
        <Text
          style={{ fontFamily: "Outfit_600SemiBold" }}
          className={`text-sm ${valueColor}`}
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
      <View className="flex-1 bg-[#DBE2ED]">
        {/* Header */}
        <View className="bg-[#EEB170] pt-12 pb-6 px-6 flex-row rounded-b-3xl items-center justify-between">
          <View className="flex-1 mr-3">
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#121212] text-2xl"
            >
              Transaction Details
            </Text>
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-[#121212] text-xs opacity-80 mt-0.5"
              numberOfLines={1}
            >
              {transaction.merchantOrderId}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="w-10 h-10 rounded-full bg-[#FFFFFF40] items-center justify-center"
            activeOpacity={0.7}
          >
            <X size={22} color="#121212" />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          {/* Hero Amount & Status Card */}
          <View
            className="bg-[#0C3572] mx-4 mt-4 rounded-2xl p-5"
            style={{ boxShadow: "0px 6px 16px rgba(12, 53, 114, 0.18)" } as any}
          >
            {/* Status Pill */}
            <View className="items-center mb-3">
              <View
                className={`flex-row items-center px-3 py-1 rounded-full border ${statusConfig.pillBg}`}
              >
                {statusConfig.icon}
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className={`ml-1.5 text-xs uppercase ${statusConfig.pillText}`}
                >
                  {transaction.status}
                </Text>
              </View>
            </View>

            {/* Final Amount */}
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#EEB170] text-center text-4xl mb-1"
            >
              {formatAmount(transaction.finalAmount)}
            </Text>

            {/* Breakdown */}
            {transaction.originalAmount !== transaction.finalAmount && (
              <View className="items-center mt-1">
                <Text
                  style={{ fontFamily: "Outfit_400Regular" }}
                  className="text-blue-200 text-sm"
                >
                  Base Amount: {formatAmount(transaction.originalAmount)}
                </Text>
                {transaction.discountAmount > 0 && (
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-emerald-300 text-sm mt-0.5"
                  >
                    Discount Applied: -{formatAmount(transaction.discountAmount)}
                  </Text>
                )}
              </View>
            )}

            {transaction.transactionFees > 0 && (
              <Text
                style={{ fontFamily: "Outfit_400Regular" }}
                className="text-blue-300/70 text-center text-xs mt-1"
              >
                Payment Gateway Fees: +{formatAmount(transaction.transactionFees)}
              </Text>
            )}
          </View>

          {/* Transaction Info Card */}
          <View
            className="bg-white mx-4 mt-4 rounded-2xl p-4 border border-[#A0B3D0]/60"
            style={{ boxShadow: "0px 4px 12px rgba(12, 53, 114, 0.06)" } as any}
          >
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#0C3572] text-base mb-2"
            >
              Payment Information
            </Text>

            <DetailRow
              icon={<CreditCard size={16} color="#EEB170" />}
              label="Merchant Order ID"
              value={transaction.merchantOrderId}
            />

            <DetailRow
              icon={<User size={16} color="#2175C0" />}
              label="User ID"
              value={transaction.userId}
            />

            <DetailRow
              icon={<DollarSign size={16} color="#2175C0" />}
              label="Payment Type"
              value={transaction.paymentType.replace(/_/g, " ").toUpperCase()}
            />

            <DetailRow
              icon={<Calendar size={16} color="#94A3B8" />}
              label="Created At"
              value={formatDate(transaction.createdAt)}
            />

            {transaction.completedAt && (
              <DetailRow
                icon={<Calendar size={16} color="#10B981" />}
                label="Completed At"
                value={formatDate(transaction.completedAt)}
              />
            )}

            <DetailRow
              icon={<Tag size={16} color="#94A3B8" />}
              label="Document ID"
              value={transaction.id}
              isLast
            />
          </View>

          {/* Event Registration Details */}
          {transaction.processedIntentions?.eventRegistration && (
            <View
              className="bg-white mx-4 mt-4 rounded-2xl p-4 border border-[#A0B3D0]/60"
              style={{ boxShadow: "0px 4px 12px rgba(12, 53, 114, 0.06)" } as any}
            >
              <Text
                style={{ fontFamily: "Outfit_700Bold" }}
                className="text-[#0C3572] text-base mb-2"
              >
                Event Registration
              </Text>

              <DetailRow
                icon={<MapPin size={16} color="#EEB170" />}
                label="Event ID"
                value={transaction.eventId}
              />

              <DetailRow
                icon={<Users size={16} color="#2175C0" />}
                label="Event Type"
                value={transaction.processedIntentions.eventRegistration.eventType.toUpperCase()}
              />

              {transaction.processedIntentions.eventRegistration.teamName && (
                <DetailRow
                  icon={<Users size={16} color="#2175C0" />}
                  label="Team Name"
                  value={
                    transaction.processedIntentions.eventRegistration.teamName
                  }
                />
              )}

              {transaction.teamId && (
                <DetailRow
                  icon={<Tag size={16} color="#2175C0" />}
                  label="Team ID"
                  value={transaction.teamId}
                />
              )}

              <DetailRow
                icon={<DollarSign size={16} color="#2175C0" />}
                label="Registration Portion"
                value={formatAmount(
                  transaction.processedIntentions.eventRegistration.amount
                )}
                isLast
              />
            </View>
          )}

          {/* Coupon Details */}
          {transaction.couponCode && transaction.couponDetails && (
            <View
              className="bg-white mx-4 mt-4 rounded-2xl p-4 border border-[#A0B3D0]/60"
              style={{ boxShadow: "0px 4px 12px rgba(12, 53, 114, 0.06)" } as any}
            >
              <Text
                style={{ fontFamily: "Outfit_700Bold" }}
                className="text-[#0C3572] text-base mb-2"
              >
                Coupon Details
              </Text>

              <DetailRow
                icon={<Sparkles size={16} color="#059669" />}
                label="Coupon Code"
                value={transaction.couponCode}
                valueColor="text-emerald-700"
              />

              <DetailRow
                icon={<DollarSign size={16} color="#059669" />}
                label="Discount Type"
                value={transaction.couponDetails.discountType.toUpperCase()}
              />

              <DetailRow
                icon={<DollarSign size={16} color="#059669" />}
                label="Discount Value"
                value={
                  transaction.couponDetails.discountType === "flat"
                    ? formatAmount(transaction.couponDetails.discountValue)
                    : `${transaction.couponDetails.discountValue}%`
                }
                isLast
              />
            </View>
          )}

          {/* Bill Map Breakdown */}
          {transaction.bill && (
            <View
              className="bg-white mx-4 mt-4 rounded-2xl p-4 border border-[#A0B3D0]/60"
              style={{ boxShadow: "0px 4px 12px rgba(12, 53, 114, 0.06)" } as any}
            >
              <View className="flex-row items-center mb-2">
                <Receipt size={18} color="#0C3572" />
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className="text-[#0C3572] text-base ml-2"
                >
                  Bill Breakdown
                </Text>
              </View>

              {transaction.bill.event !== undefined && (
                <DetailRow
                  icon={<DollarSign size={16} color="#2175C0" />}
                  label="Event Amount"
                  value={formatAmount(Number(transaction.bill.event))}
                />
              )}

              {transaction.bill.accommodation !== undefined && (
                <DetailRow
                  icon={<DollarSign size={16} color="#EEB170" />}
                  label="Accommodation Amount"
                  value={formatAmount(Number(transaction.bill.accommodation))}
                />
              )}

              {transaction.bill.accommodation_days && typeof transaction.bill.accommodation_days === "object" && (
                <View className="py-2 pl-11 border-b border-slate-100">
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-slate-500 text-xs uppercase mb-1"
                  >
                    Accommodation Days
                  </Text>
                  {Object.entries(transaction.bill.accommodation_days).map(([day, price]) => (
                    <View key={day} className="flex-row justify-between py-0.5">
                      <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-slate-600 text-xs capitalize">
                        {day}
                      </Text>
                      <Text style={{ fontFamily: "Outfit_600SemiBold" }} className="text-slate-700 text-xs">
                        {formatAmount(Number(price))}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {transaction.bill.food !== undefined && (
                <DetailRow
                  icon={<DollarSign size={16} color="#10B981" />}
                  label="Food Amount"
                  value={formatAmount(Number(transaction.bill.food))}
                />
              )}

              {transaction.bill.food_days && typeof transaction.bill.food_days === "object" && (
                <View className="py-2 pl-11 border-b border-slate-100">
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-slate-500 text-xs uppercase mb-1"
                  >
                    Food Days
                  </Text>
                  {Object.entries(transaction.bill.food_days).map(([day, price]) => (
                    <View key={day} className="flex-row justify-between py-0.5">
                      <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-slate-600 text-xs capitalize">
                        {day}
                      </Text>
                      <Text style={{ fontFamily: "Outfit_600SemiBold" }} className="text-slate-700 text-xs">
                        {formatAmount(Number(price))}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {transaction.bill.total !== undefined && (
                <DetailRow
                  icon={<CreditCard size={16} color="#0C3572" />}
                  label="Total Accumulated"
                  value={formatAmount(Number(transaction.bill.total))}
                  valueColor="text-[#0C3572] font-bold"
                />
              )}

              {transaction.bill.discount !== undefined && Number(transaction.bill.discount) > 0 && (
                <DetailRow
                  icon={<Sparkles size={16} color="#059669" />}
                  label="Discount"
                  value={`-${formatAmount(Number(transaction.bill.discount))}`}
                  valueColor="text-emerald-700"
                />
              )}

              {transaction.bill.final !== undefined && (
                <DetailRow
                  icon={<CreditCard size={16} color="#EEB170" />}
                  label="Final Charged"
                  value={formatAmount(Number(transaction.bill.final))}
                  valueColor="text-[#EEB170] font-bold"
                  isLast
                />
              )}
            </View>
          )}

          {/* Admin Override Controls */}
          {onUpdateStatus && (
            <View
              className="bg-white mx-4 mt-4 mb-6 rounded-2xl p-5 border border-[#A0B3D0]/60"
              style={{ boxShadow: "0px 4px 12px rgba(12, 53, 114, 0.06)" } as any}
            >
              <View className="flex-row items-center mb-2">
                <ShieldAlert size={20} color="#0C3572" />
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className="text-[#0C3572] text-base ml-2"
                >
                  Admin Payment Controls
                </Text>
              </View>

              <Text
                style={{ fontFamily: "Outfit_400Regular" }}
                className="text-slate-600 text-xs leading-4 mb-4"
              >
                Override status manually. Marking as success will settle the
                payment, confirm the participant registration, and lock stay/food.
              </Text>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => onUpdateStatus(transaction.merchantOrderId || transaction.id, "success")}
                  className="flex-1 bg-emerald-600 py-3.5 rounded-xl flex-row items-center justify-center shadow-sm"
                  activeOpacity={0.7}
                >
                  <CheckCircle size={18} color="#FFFFFF" />
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-white text-sm ml-2"
                  >
                    Mark Success
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => onUpdateStatus(transaction.merchantOrderId || transaction.id, "failed")}
                  className="flex-1 bg-rose-50 border border-rose-200 py-3.5 rounded-xl flex-row items-center justify-center"
                  activeOpacity={0.7}
                >
                  <XCircle size={18} color="#E11D48" />
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-rose-600 text-sm ml-2"
                  >
                    Mark Failed
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

export default TransactionDetailModal;
