import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, ActivityIndicator, TextInput, StatusBar } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '@/state/userStore';
import { useThemeStore } from '@/state/themeStore';
import { initiateEventPayment, getPaymentStatus, validateCoupon, CouponResponse } from '@/api/payments';
import { showAlert } from '@/components';
import { startEasebuzzPayment } from '@/services/easebuzz';
import { getAppAccommodation } from '@/api/appConfig';
import { getMyEvents } from '@/api/events';
import { resolveStayPrices, isHostStudent } from '@/utils/paymentHelpers';

interface DayInfo {
  key: string;
  title: string;
  date: string;
}

const FESTIVAL_DAYS: DayInfo[] = [
  { key: 'day0', title: '19 Nov', date: 'Wednesday (from 8:00 PM)' },
  { key: 'day1', title: '20 Nov', date: 'Thursday' },
  { key: 'day2', title: '21 Nov', date: 'Friday' },
  { key: 'day3', title: '22 Nov', date: 'Saturday' },
  { key: 'day4', title: '23 Nov', date: 'Sunday' },
];

export default function AccommodationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const { userData: user, refreshUserProfile } = useUserStore();

  const [accDayPrices, setAccDayPrices] = useState<Record<string, number>>({
    day0: 650, day1: 650, day2: 650, day3: 650, day4: 650,
  });
  const [foodDayPrices, setFoodDayPrices] = useState<Record<string, number>>({
    day0: 150, day1: 150, day2: 150, day3: 150, day4: 150,
  });
  const [registeredEventsCount, setRegisteredEventsCount] = useState<number | null>(null);

  const [phase, setPhase] = useState<'select' | 'initiating' | 'opening' | 'verifying'>('select');
  const [selectedAcc, setSelectedAcc] = useState<Record<string, boolean>>({
    day0: false, day1: false, day2: false, day3: false, day4: false,
  });
  const [selectedFood, setSelectedFood] = useState<Record<string, boolean>>({
    day0: false, day1: false, day2: false, day3: false, day4: false,
  });

  const [couponCode, setCouponCode] = useState('');
  const [validCoupon, setValidCoupon] = useState<CouponResponse | null>(null);
  const [couponError, setCouponError] = useState('');

  const bgColor = isDark ? '#131316' : '#E0E0E0';
  const cardBg = isDark ? '#1C1C20' : '#FFFFFF';
  const cardBorder = isDark ? '#2A2A30' : '#D5D5D5';
  const textColor = isDark ? '#FFFFFF' : '#111827';
  const subTextColor = isDark ? '#A0A0A0' : '#6B7280';
  const inputBg = isDark ? '#26262B' : '#F3F4F6';

  // Refresh profile on mount to ensure accommodation and food states are fresh
  useFocusEffect(
    useCallback(() => {
      refreshUserProfile().catch(() => {});
    }, [refreshUserProfile])
  );

  // Fetch dynamic accommodation & food price based on user's registered event categories
  useEffect(() => {
    Promise.all([
      getAppAccommodation().catch(() => null),
      getMyEvents().catch(() => []),
    ])
      .then(([res, myEvents]) => {
        const count = Array.isArray(myEvents) ? myEvents.length : 0;
        setRegisteredEventsCount(count);

        let hasTech = false;
        let hasCult = false;

        if (Array.isArray(myEvents)) {
          for (const item of myEvents) {
            const cat = item.event?.category;
            if (cat) {
              if (cat.toLowerCase() === 'technical') {
                hasTech = true;
              } else {
                // Any non-technical event is considered cultural
                hasCult = true;
              }
            }
          }
        }

        const { accDays, foodDays } = resolveStayPrices(res, hasTech, hasCult);
        setAccDayPrices(accDays);
        setFoodDayPrices(foodDays);
      })
      .catch(err => {
        console.error('Failed to fetch accommodation price:', err);
      });
  }, []);

  // Sync state with user's already owned days
  useEffect(() => {
    if (user?.accommodation) {
      setSelectedAcc(prev => ({ ...prev, ...user.accommodation }));
    }
    if (user?.food) {
      setSelectedFood(prev => ({ ...prev, ...user.food }));
    }
  }, [user]);

  const selectChoice = (day: string, choice: 'without_food' | 'with_food') => {
    if (user?.accommodation?.[day]) return;
    if (registeredEventsCount === 0) {
      showAlert(
        "Event Registration Required",
        "Campus accommodation is exclusively reserved for participants registered in festival events. Please register for an event first."
      );
      return;
    }

    const currentChoice = selectedAcc[day] ? (selectedFood[day] ? 'with_food' : 'without_food') : 'none';
    if (currentChoice === choice) {
      setSelectedAcc(prev => ({ ...prev, [day]: false }));
      setSelectedFood(prev => ({ ...prev, [day]: false }));
    } else if (choice === 'with_food') {
      setSelectedAcc(prev => ({ ...prev, [day]: true }));
      setSelectedFood(prev => ({ ...prev, [day]: true }));
    } else {
      setSelectedAcc(prev => ({ ...prev, [day]: true }));
      setSelectedFood(prev => ({ ...prev, [day]: false }));
    }
  };

  const clearChoice = (day: string) => {
    if (user?.accommodation?.[day]) return;
    setSelectedAcc(prev => ({ ...prev, [day]: false }));
    setSelectedFood(prev => ({ ...prev, [day]: false }));
  };

  const handleApplyCoupon = async () => {
    const trimmed = couponCode.trim().toUpperCase();
    if (!trimmed) return;
    try {
      setCouponError('');
      const res = await validateCoupon(trimmed, "");
      setValidCoupon(res);
      showAlert("Success", `Coupon "${res.code}" applied!`);
    } catch (err: any) {
      setCouponError(err.message || "Invalid coupon");
      setValidCoupon(null);
    }
  };

  const handleRemoveCoupon = () => {
    setValidCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  // Calculate fees only for newly selected (not yet owned) days
  const calculateTotal = () => {
    let total = 0;
    const allDays = new Set([...Object.keys(selectedAcc), ...Object.keys(selectedFood)]);
    allDays.forEach((day) => {
      const isAcc = selectedAcc[day] && !user?.accommodation?.[day];
      const isFood = selectedFood[day] && !user?.food?.[day];
      if (isAcc && isFood) {
        const accPrice = accDayPrices[day] || 650;
        const foodPrice = foodDayPrices[day] || 150;
        total += accPrice + foodPrice;
      } else if (isAcc) {
        total += (accDayPrices[day] || 650);
      } else if (isFood) {
        total += (foodDayPrices[day] || 150);
      }
    });
    return total;
  };

  const total = calculateTotal();

  const calculateDiscount = () => {
    if (!validCoupon) return 0;
    if (validCoupon.minCartValue && total < validCoupon.minCartValue) return 0;
    if (validCoupon.discountType === 'flat') {
      return validCoupon.discountValue > total ? total : validCoupon.discountValue;
    }
    return total * (validCoupon.discountValue / 100);
  };

  const discount = calculateDiscount();
  const finalAmount = Math.max(0, total - discount);

  const pollPaymentStatusWithRetry = async (
    merchantOrderId: string,
    maxAttempts = 4,
    delayMs = 1500
  ) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const payment = await getPaymentStatus(merchantOrderId);
        if (payment?.status === 'success' || payment?.status === 'failure') {
          return payment;
        }
      } catch (e) {}
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    return await getPaymentStatus(merchantOrderId);
  };

  const handlePay = async () => {
    if (total <= 0) {
      showAlert("Nothing Selected", "Please select at least one day for accommodation or food to continue.");
      return;
    }

    const accToPay: Record<string, boolean> = {};
    const foodToPay: Record<string, boolean> = {};

    Object.entries(selectedAcc).forEach(([day, selected]) => {
      if (selected && !user?.accommodation?.[day]) accToPay[day] = true;
    });
    Object.entries(selectedFood).forEach(([day, selected]) => {
      if (selected && !user?.food?.[day]) foodToPay[day] = true;
    });

    const hasAcc = Object.keys(accToPay).length > 0;
    const hasFood = Object.keys(foodToPay).length > 0;

    if (hasAcc && registeredEventsCount === 0) {
      showAlert(
        "Event Registration Required",
        "Campus accommodation is exclusively reserved for participants registered in festival events. Please register for an event before paying for accommodation."
      );
      return;
    }

    // The backend has no food-only type; food rides on accommodation_and_food.
    const paymentType = hasFood ? 'accommodation_and_food' : 'accommodation';

    let appliedCoupon: string | undefined = undefined;
    if (validCoupon) {
      if (validCoupon.minCartValue && total < validCoupon.minCartValue) {
        showAlert(
          "Coupon Condition Not Met",
          `Coupon "${validCoupon.code}" requires a minimum cart value of ₹${validCoupon.minCartValue}. Please select more options or remove the coupon.`
        );
        return;
      }
      appliedCoupon = validCoupon.code;
    }

    try {
      setPhase('initiating');

      const res = await initiateEventPayment({
        paymentType,
        couponCode: appliedCoupon,
        accommodation: accToPay,
        food: foodToPay,
      });

      // Never open the gateway for an amount other than the one on screen.
      if (res.bill?.final != null && res.bill.final !== Math.round(finalAmount)) {
        setPhase('select');
        showAlert("Price Updated", `The server total is ₹${res.bill.final}, not ₹${finalAmount}. Please review your selection and try again.`);
        await refreshUserProfile();
        return;
      }

      // Only the backend's record decides the outcome; the client SDK/redirect is not solely trusted.
      const orderId = res.merchantOrderId;
      setPhase('opening');

      const checkoutResult = await startEasebuzzPayment({
        paymentUrl: res.paymentUrl,
        merchantOrderId: res.merchantOrderId,
        accessKey: res.accessKey,
        payMode: res.payMode,
      });

      setPhase('verifying');
      const payment = await pollPaymentStatusWithRetry(orderId);
      const status = payment?.status || 'pending';

      setPhase('select');

      if (status === 'success') {
        await refreshUserProfile();
        showAlert(
          "Booking Confirmed!",
          "Your accommodation and food pass payment was successful. Details have been updated on your profile."
        );
      } else if (status === 'failure') {
        showAlert(
          "Payment Failed",
          "Your transaction could not be processed. Please try again."
        );
      } else {
        if (checkoutResult.status === 'cancelled') {
          showAlert(
            "Payment Cancelled",
            "The payment window was closed before completion. If your payment was deducted, it will update shortly; otherwise you can try again."
          );
        } else {
          showAlert(
            "Payment Processing",
            "Your payment is still being processed. Please refresh your profile shortly."
          );
        }
      }
    } catch (err: any) {
      setPhase('select');
      showAlert("Payment Error", err.message || "Failed to initiate payment");
    }
  };

  const bookedDaysList = FESTIVAL_DAYS.filter(
    d => user?.accommodation?.[d.key] || user?.food?.[d.key]
  );
  const isHostCollegeStudent = isHostStudent(user);

  if (isHostCollegeStudent) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: isDark ? 'rgba(65, 184, 240, 0.15)' : '#E0F2FE', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Ionicons name="home-outline" size={44} color="#41B8F0" />
        </View>
        <Text style={{ fontFamily: 'Talina', color: textColor, fontSize: 22, textAlign: 'center', marginBottom: 12 }}>
          NOT APPLICABLE
        </Text>
        <Text style={{ fontFamily: 'Poppins_400Regular', color: subTextColor, textAlign: 'center', marginBottom: 32, lineHeight: 22, fontSize: 14 }}>
          Campus festival accommodation is reserved for outstation participants. As a Thapar student, festival accommodation is not applicable.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ backgroundColor: '#41B8F0', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 }}
        >
          <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', fontSize: 15 }}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Top Header */}
      <View
        style={{
          paddingTop: Math.max(insets.top + 8, 44),
          paddingBottom: 16,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: bgColor,
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: cardBorder,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={textColor} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontFamily: "Talina", fontSize: 24, color: textColor, letterSpacing: 0.5 }}
          >
            ACCOMMODATION & MEALS
          </Text>
          <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 13, color: '#41B8F0' }}>
            Campus Hostel & Food Passes
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Existing Booking Summary Card */}
        {bookedDaysList.length > 0 ? (
          <View
            style={{
              backgroundColor: isDark ? 'rgba(34, 197, 94, 0.12)' : '#DCFCE7',
              borderColor: '#22c55e',
              borderWidth: 1,
              padding: 16,
              borderRadius: 20,
              marginBottom: 20,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <Ionicons name="checkmark-done-circle" size={20} color="#22c55e" />
              <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#22c55e', fontSize: 15, marginLeft: 8 }}>
                Active Campus Pass
              </Text>
            </View>
            <Text style={{ fontFamily: 'Poppins_400Regular', color: textColor, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
              Hostel room keys and meal verification will be issued at the hospitality desk upon arrival.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {bookedDaysList.map(d => (
                <View key={d.key} style={{ backgroundColor: cardBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: cardBorder }}>
                  <Text style={{ fontFamily: 'Poppins_600SemiBold', color: textColor, fontSize: 11 }}>
                    {d.title}: {user?.accommodation?.[d.key] ? "Hostel" : ""}{user?.accommodation?.[d.key] && user?.food?.[d.key] ? " + " : ""}{user?.food?.[d.key] ? "Meals" : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: isDark ? 'rgba(65, 184, 240, 0.12)' : 'rgba(65, 184, 240, 0.1)',
              borderColor: '#41B8F0',
              borderWidth: 1,
              padding: 16,
              borderRadius: 20,
              marginBottom: 20,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <Ionicons name="information-circle" size={18} color="#41B8F0" />
              <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#41B8F0', fontSize: 14, marginLeft: 8 }}>
                Campus Stay & Dining
              </Text>
            </View>
            <Text style={{ fontFamily: 'Poppins_400Regular', color: textColor, fontSize: 12, lineHeight: 18 }}>
              Select festival days you need campus hostel accommodation and 3 meals/day dining pass.
            </Text>
          </View>
        )}

        {/* Event Registration Notice for Accommodation */}
        {registeredEventsCount === 0 && (
          <View
            style={{
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7',
              borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#FCD34D',
              borderWidth: 1,
              padding: 16,
              borderRadius: 20,
              marginBottom: 20,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <Ionicons name="warning" size={20} color="#f59e0b" />
              <Text style={{ fontFamily: 'Poppins_600SemiBold', color: isDark ? '#FBBF24' : '#B45309', fontSize: 15, marginLeft: 8 }}>
                Event Registration Required
              </Text>
            </View>
            <Text style={{ fontFamily: 'Poppins_400Regular', color: textColor, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
              Campus hostel accommodation is exclusively reserved for participants registered in at least one festival event. Please register for an event first to unlock accommodation.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/events' as any)}
              style={{
                backgroundColor: '#f59e0b',
                paddingHorizontal: 16,
                paddingVertical: 9,
                borderRadius: 12,
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', fontSize: 13 }}>
                Explore Events
              </Text>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Day by Day Cards */}
        {FESTIVAL_DAYS.map((day) => {
          const accLocked = user?.accommodation?.[day.key] || false;
          const foodLocked = user?.food?.[day.key] || false;
          const dayAccPrice = accDayPrices[day.key] || 600;
          const dayFoodPrice = foodDayPrices[day.key] || 200;
          const withoutFoodPrice = dayAccPrice;
          const withFoodPrice = dayAccPrice + dayFoodPrice;

          const isWithoutSelected = selectedAcc[day.key] && !selectedFood[day.key];
          const isWithSelected = selectedAcc[day.key] && selectedFood[day.key];
          const hasSelection = selectedAcc[day.key];

          return (
            <View
              key={day.key}
              style={{
                backgroundColor: cardBg,
                borderWidth: 1,
                borderColor: hasSelection ? (isDark ? '#41B8F0' : '#3B82F6') : cardBorder,
                borderRadius: 20,
                padding: 18,
                marginBottom: 14,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontFamily: 'Poppins_600SemiBold', color: textColor, fontSize: 16 }}>
                    {day.title}
                  </Text>
                  <Text style={{ fontFamily: 'Poppins_400Regular', color: subTextColor, fontSize: 12 }}>
                    {day.date}
                  </Text>
                </View>

                {accLocked ? (
                  <View style={{ backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                    <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#22c55e', fontSize: 11, marginLeft: 4 }}>
                      Paid {foodLocked ? "(With Food)" : "(Without Food)"}
                    </Text>
                  </View>
                ) : hasSelection ? (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => clearChoice(day.key)}
                    style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                  >
                    <Text style={{ fontFamily: 'Poppins_500Medium', color: isDark ? '#EF4444' : '#DC2626', fontSize: 12 }}>
                      Clear
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {registeredEventsCount === 0 && !accLocked && (
                <Text style={{ fontFamily: 'Poppins_500Medium', color: '#f59e0b', fontSize: 11, marginBottom: 10 }}>
                  Requires event registration to book
                </Text>
              )}

              {/* Radio 1: Without Food */}
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={accLocked}
                onPress={() => selectChoice(day.key, 'without_food')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: isWithoutSelected
                    ? '#41B8F0'
                    : (isDark ? '#2E2E35' : '#E5E7EB'),
                  backgroundColor: isWithoutSelected
                    ? (isDark ? 'rgba(65, 184, 240, 0.12)' : '#EFF6FF')
                    : (isDark ? '#24242A' : '#F9FAFB'),
                  marginBottom: 10,
                  opacity: accLocked ? 0.6 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: isWithoutSelected ? '#41B8F0' : (isDark ? '#52525B' : '#9CA3AF'),
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    {isWithoutSelected && (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: '#41B8F0',
                        }}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Poppins_500Medium', color: textColor, fontSize: 14 }}>
                      Without Food
                    </Text>
                    <Text style={{ fontFamily: 'Poppins_400Regular', color: subTextColor, fontSize: 11 }}>
                      Hostel stay only
                    </Text>
                  </View>
                </View>
                <Text style={{ fontFamily: 'Poppins_600SemiBold', color: isWithoutSelected ? '#41B8F0' : textColor, fontSize: 15 }}>
                  ₹{withoutFoodPrice}
                </Text>
              </TouchableOpacity>

              {/* Radio 2: With Food */}
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={accLocked}
                onPress={() => selectChoice(day.key, 'with_food')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: isWithSelected
                    ? '#41B8F0'
                    : (isDark ? '#2E2E35' : '#E5E7EB'),
                  backgroundColor: isWithSelected
                    ? (isDark ? 'rgba(65, 184, 240, 0.12)' : '#EFF6FF')
                    : (isDark ? '#24242A' : '#F9FAFB'),
                  opacity: accLocked ? 0.6 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: isWithSelected ? '#41B8F0' : (isDark ? '#52525B' : '#9CA3AF'),
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    {isWithSelected && (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: '#41B8F0',
                        }}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Poppins_500Medium', color: textColor, fontSize: 14 }}>
                      With Food
                    </Text>
                    <Text style={{ fontFamily: 'Poppins_400Regular', color: subTextColor, fontSize: 11 }}>
                      Hostel stay + 3 meals included
                    </Text>
                  </View>
                </View>
                <Text style={{ fontFamily: 'Poppins_600SemiBold', color: isWithSelected ? '#41B8F0' : textColor, fontSize: 15 }}>
                  ₹{withFoodPrice}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Promo Code Card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: cardBorder,
            borderRadius: 20,
            padding: 18,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontFamily: 'Poppins_600SemiBold', color: textColor, fontSize: 15, marginBottom: 12 }}>
            Have a promo code?
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              value={couponCode}
              onChangeText={setCouponCode}
              placeholder="ENTER PROMO CODE"
              placeholderTextColor={subTextColor}
              autoCapitalize="characters"
              style={{
                flex: 1,
                backgroundColor: inputBg,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: cardBorder,
                paddingHorizontal: 16,
                paddingVertical: 12,
                color: textColor,
                fontFamily: 'Poppins_500Medium',
                fontSize: 14,
              }}
            />
            {validCoupon ? (
              <TouchableOpacity
                onPress={handleRemoveCoupon}
                style={{
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
                  paddingHorizontal: 18,
                  justifyContent: 'center',
                  borderRadius: 14,
                }}
              >
                <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#ef4444', fontSize: 14 }}>Remove</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleApplyCoupon}
                style={{
                  backgroundColor: '#41B8F0',
                  paddingHorizontal: 20,
                  justifyContent: 'center',
                  borderRadius: 14,
                }}
              >
                <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', fontSize: 14 }}>Apply</Text>
              </TouchableOpacity>
            )}
          </View>
          {couponError ? (
            <Text style={{ fontFamily: 'Poppins_400Regular', color: '#ef4444', marginTop: 8, fontSize: 12 }}>
              {couponError}
            </Text>
          ) : null}
          {validCoupon ? (
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(34, 197, 94, 0.12)' : '#DCFCE7', padding: 12, borderRadius: 12 }}>
                <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#22c55e', marginLeft: 8, fontSize: 13 }}>
                  Coupon applied: -₹{discount.toFixed(2)}
                </Text>
              </View>
              {validCoupon.minCartValue && total < validCoupon.minCartValue ? (
                <Text style={{ fontFamily: 'Poppins_400Regular', color: '#f59e0b', fontSize: 12, marginTop: 6 }}>
                  Requires minimum cart value of ₹{validCoupon.minCartValue} (current: ₹{total}).
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Floating Bottom Bar */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: cardBg,
          borderTopWidth: 1,
          borderTopColor: cardBorder,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom + 12, 28),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.3 : 0.08,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontFamily: 'Poppins_500Medium', color: subTextColor, fontSize: 13 }}>
              Total to Pay
            </Text>
            <Text style={{ fontFamily: 'Talina', color: textColor, fontSize: 28 }}>
              ₹{finalAmount.toFixed(2)}
            </Text>
            {discount > 0 && (
              <Text style={{ fontFamily: 'Poppins_400Regular', color: subTextColor, fontSize: 12, textDecorationLine: 'line-through' }}>
                Original: ₹{total.toFixed(2)}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handlePay}
            disabled={phase !== 'select' || total === 0}
            style={{
              paddingHorizontal: 32,
              paddingVertical: 15,
              borderRadius: 16,
              backgroundColor: total === 0 || phase !== 'select' ? (isDark ? '#2A2A30' : '#E5E7EB') : '#41B8F0',
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            {phase !== 'select' && (
              <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
            )}
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize: 16,
                color: total === 0 || phase !== 'select' ? subTextColor : '#FFFFFF',
              }}
            >
              {phase === 'initiating' ? 'Initiating...' :
               phase === 'opening' ? 'Opening...' :
               phase === 'verifying' ? 'Verifying...' :
               total === 0 ? 'Select Days' : 'Pay Now'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
