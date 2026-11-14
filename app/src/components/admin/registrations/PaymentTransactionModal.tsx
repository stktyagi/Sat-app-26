// src/components/admin/registrations/PaymentTransactionModal.tsx
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
  FileText,
  Home,
  Utensils,
} from "lucide-react-native";
import { PaymentTransaction } from "@/types/adminTypes";
import { useThemeStore } from "@/state/themeStore";

interface PaymentTransactionModalProps {
  visible: boolean;
  transaction: PaymentTransaction | null;
  loading: boolean;
  onClose: () => void;
  onUpdateStatus?: (id: string, newStatus: string) => void;
}

const PaymentTransactionModal: React.FC<PaymentTransactionModalProps> = ({
  visible,
  transaction,
  loading,
  onClose,
  onUpdateStatus,
}) => {
  const { isDark } = useThemeStore();

  const getStatusConfig = (status: string = "pending") => {
    switch (status.toLowerCase()) {
      case "success":
      case "completed":
        return {
          pillBg: "bg-emerald-500/20 border-emerald-400/40",
          pillText: "text-emerald-300",
          icon: <CheckCircle size={16} color="#34D399" />,
          label: "SUCCESS",
        };
      case "failed":
      case "failure":
      case "rejected":
        return {
          pillBg: "bg-rose-500/20 border-rose-400/40",
          pillText: "text-rose-300",
          icon: <XCircle size={16} color="#FB7185" />,
          label: "FAILED",
        };
      case "pending":
      case "payment_pending":
      default:
        return {
          pillBg: "bg-amber-500/20 border-amber-400/40",
          pillText: "text-amber-300",
          icon: <Clock size={16} color="#FBBF24" />,
          label: status.toUpperCase(),
        };
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
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

  const formatAmount = (amount?: number) => {
    if (amount === undefined || amount === null) return "₹0";
    return `₹${amount.toLocaleString("en-IN")}`;
  };

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
      <View className={`flex-1 ${isDark ? "bg-[#131316]" : "bg-[#DBE2ED]"}`}>
        {/* Header - Matching Transactions.tsx Header */}
        <View className="bg-[#EEB170] pt-12 pb-6 px-6 flex-row rounded-b-3xl items-center justify-between">
          <View className="flex-1 mr-3">
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#121212] text-2xl"
            >
              Transaction Details
            </Text>
            {transaction?.merchantOrderId ? (
              <Text
                style={{ fontFamily: "Outfit_500Medium" }}
                className="text-[#121212] text-xs opacity-80 mt-0.5"
                numberOfLines={1}
              >
                {transaction.merchantOrderId}
              </Text>
            ) : (
              <Text
                style={{ fontFamily: "Outfit_500Medium" }}
                className="text-[#121212] text-xs opacity-80 mt-0.5"
              >
                Payment Verification
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="w-10 h-10 rounded-full bg-[#FFFFFF40] items-center justify-center"
            activeOpacity={0.7}
          >
            <X size={22} color="#121212" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center px-6">
            <ActivityIndicator size="large" color="#EEB170" />
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className={`mt-3 text-sm ${isDark ? "text-slate-400" : "text-[#0C3572]"}`}
            >
              Loading transaction details...
            </Text>
          </View>
        ) : !transaction ? (
          <View className="flex-1 items-center justify-center px-6">
            <View className="w-16 h-16 rounded-2xl bg-[#EEB170]/15 items-center justify-center mb-4">
              <FileText size={32} color="#EEB170" />
            </View>
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className={`text-lg text-center ${isDark ? "text-white" : "text-[#0C3572]"}`}
            >
              No Payment Transaction Found
            </Text>
            <Text
              style={{ fontFamily: "Outfit_400Regular" }}
              className={`text-center text-xs mt-2 px-8 leading-5 ${isDark ? "text-slate-400" : "text-slate-600"}`}
            >
              This registration might have been created via free entry, admin approval, or payment is still pending.
            </Text>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 60 }}
          >
            {/* Hero Amount & Status Card */}
            {(() => {
              const statusConfig = getStatusConfig(transaction.status);
              return (
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
                        {statusConfig.label}
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
              );
            })()}

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
                value={transaction.merchantOrderId || "N/A"}
              />

              <DetailRow
                icon={<User size={16} color="#2175C0" />}
                label="User ID"
                value={transaction.userId || "N/A"}
              />

              <DetailRow
                icon={<DollarSign size={16} color="#2175C0" />}
                label="Payment Type"
                value={(transaction.paymentType || "EVENT").replace(/_/g, " ").toUpperCase()}
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

              {transaction.easebuzzTxnId && (
                <DetailRow
                  icon={<Receipt size={16} color="#41B8F0" />}
                  label="Easebuzz Txn ID"
                  value={transaction.easebuzzTxnId}
                />
              )}

              <DetailRow
                icon={<Tag size={16} color="#94A3B8" />}
                label="Document ID"
                value={transaction.id || "N/A"}
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
                  value={transaction.eventId || transaction.processedIntentions.eventRegistration.eventId || "N/A"}
                />

                <DetailRow
                  icon={<Users size={16} color="#2175C0" />}
                  label="Event Type"
                  value={(transaction.processedIntentions.eventRegistration.eventType || "individual").toUpperCase()}
                />

                {transaction.processedIntentions.eventRegistration.teamName && (
                  <DetailRow
                    icon={<Users size={16} color="#2175C0" />}
                    label="Team Name"
                    value={transaction.processedIntentions.eventRegistration.teamName}
                  />
                )}

                {(transaction.teamId || transaction.processedIntentions.eventRegistration.teamId) && (
                  <DetailRow
                    icon={<Tag size={16} color="#2175C0" />}
                    label="Team ID"
                    value={transaction.teamId || transaction.processedIntentions.eventRegistration.teamId || ""}
                  />
                )}

                <DetailRow
                  icon={<DollarSign size={16} color="#2175C0" />}
                  label="Registration Portion"
                  value={formatAmount(transaction.processedIntentions.eventRegistration.amount)}
                  isLast
                />
              </View>
            )}

            {/* Accommodation Details */}
            {transaction.processedIntentions?.accommodation && (
              <View
                className="bg-white mx-4 mt-4 rounded-2xl p-4 border border-[#A0B3D0]/60"
                style={{ boxShadow: "0px 4px 12px rgba(12, 53, 114, 0.06)" } as any}
              >
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className="text-[#0C3572] text-base mb-2"
                >
                  Accommodation Details
                </Text>

                <DetailRow
                  icon={<Home size={16} color="#EEB170" />}
                  label="Accommodation Portion"
                  value={formatAmount(transaction.processedIntentions.accommodation.amount || 0)}
                  isLast
                />
              </View>
            )}

            {/* Food Details */}
            {transaction.processedIntentions?.food && (
              <View
                className="bg-white mx-4 mt-4 rounded-2xl p-4 border border-[#A0B3D0]/60"
                style={{ boxShadow: "0px 4px 12px rgba(12, 53, 114, 0.06)" } as any}
              >
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className="text-[#0C3572] text-base mb-2"
                >
                  Food Package
                </Text>

                <DetailRow
                  icon={<Utensils size={16} color="#EEB170" />}
                  label="Food Portion"
                  value={formatAmount(transaction.processedIntentions.food.amount || 0)}
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
        )}
      </View>
    </Modal>
  );
};

export default PaymentTransactionModal;
