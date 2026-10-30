import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, ScrollView, Switch, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { initiateEventPayment, getPaymentStatus, validateCoupon, CouponResponse } from '@/api/payments';
import { startEasebuzzPayment } from '@/services/easebuzz';
import { showAlert } from '@/components';
import { useEventDetail } from '@/hooks/useEventDetail';
import { useUserStore } from '@/state/userStore';
import { useThemeStore } from '@/state/themeStore';
import { getAppAccommodation } from '@/api/appConfig';
import { getMyEvents } from '@/api/events';
import { isPerIndividualPayment, resolveStayPrices } from '@/utils/paymentHelpers';

const PaymentScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { eventId, teamId } = useLocalSearchParams<{ eventId: string; teamId?: string }>();
  const { userData: user } = useUserStore();
  const { data: eventData, loading: eventLoading } = useEventDetail(eventId);

  const isHost =
    user?.isHostCollegeStudent ||
    user?.collegeName?.toLowerCase().includes('thapar') ||
    user?.email?.toLowerCase().endsWith('@thapar.edu') ||
    false;

  const [phase, setPhase] = useState<'checkout' | 'initiating' | 'opening' | 'verifying' | 'done'>('checkout');
  const [errorMessage, setErrorMessage] = useState('');

  const [accommodation, setAccommodation] = useState<Record<string, boolean>>({
    day0: false, day1: false, day2: false, day3: false, day4: false,
  });
  const [food, setFood] = useState<Record<string, boolean>>({
    day0: false, day1: false, day2: false, day3: false, day4: false,
  });

  const [accDayPrices, setAccDayPrices] = useState<Record<string, number>>({
    day0: 0, day1: 650, day2: 650, day3: 650, day4: 0,
  });
  const [foodDayPrices, setFoodDayPrices] = useState<Record<string, number>>({
    day0: 150, day1: 150, day2: 150, day3: 150, day4: 150,
  });

  const [couponCode, setCouponCode] = useState('');
  const [validCoupon, setValidCoupon] = useState<CouponResponse | null>(null);
  const [couponError, setCouponError] = useState('');

  // Fetch accommodation & food pricing based on event category and user registrations
  useEffect(() => {
    Promise.all([
      getAppAccommodation().catch(() => null),
      getMyEvents().catch(() => []),
    ]).then(([accConfig, myEvents]) => {
      let hasTech = false;
      let hasCult = false;

      // Current event category
      const currentCat = eventData?.event?.category;
      if (currentCat) {
        if (currentCat.toLowerCase() === 'technical') {
          hasTech = true;
        } else {
          // Any non-technical event is considered cultural
          hasCult = true;
        }
      }

      // User's other registered events
      if (Array.isArray(myEvents)) {
        for (const item of myEvents) {
          const cat = item.event?.category;
          if (cat) {
            if (cat.toLowerCase() === 'technical') {
              hasTech = true;
            } else {
              hasCult = true;
            }
          }
        }
      }

      const { accDays, foodDays } = resolveStayPrices(accConfig, hasTech, hasCult);
      setAccDayPrices(accDays);
      setFoodDayPrices(foodDays);
    });
  }, [eventData]);

  // Lock already paid days from user profile
  useEffect(() => {
    if (user?.accommodation) {
      setAccommodation(prev => ({ ...prev, ...user.accommodation }));
    }
    if (user?.food) {
      setFood(prev => ({ ...prev, ...user.food }));
    }
  }, [user]);

  const toggleAcc = (day: string) => {
    if (user?.accommodation?.[day]) return;
    setAccommodation(prev => ({ ...prev, [day]: !prev[day] }));
  };

  const toggleFood = (day: string) => {
    if (user?.food?.[day]) return;
    setFood(prev => ({ ...prev, [day]: !prev[day] }));
  };

  const handleApplyCoupon = async () => {
    const trimmed = couponCode.trim().toUpperCase();
    if (!trimmed) return;
    try {
      setCouponError('');
      const res = await validateCoupon(trimmed, eventId);
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

  const getBaseEventFee = () => {
    let fee = 0;
    if (eventData?.event?.paymentRequired) {
      if (
        eventData.event.eventType === 'team' &&
        isPerIndividualPayment(eventData.event.paymentType) &&
        eventData.myTeam?.members?.length
      ) {
        const totalRosterFee = eventData.myTeam.members.reduce((acc: number, m: any) => {
          return acc + (m.isHostCollegeStudent ? (eventData.event.registrationFee?.host || 0) : (eventData.event.registrationFee?.other || 0));
        }, 0);
        fee = Math.max(0, totalRosterFee - (eventData.myTeam.paidTill || 0));
      } else if (eventData.event.eventType === 'team') {
        const flatFee = isHost ? (eventData.event.registrationFee?.host || 0) : (eventData.event.registrationFee?.other || 0);
        fee = Math.max(0, flatFee - (eventData.myTeam?.paidTill || 0));
      } else {
        fee = isHost ? (eventData.event.registrationFee?.host || 0) : (eventData.event.registrationFee?.other || 0);
      }
    }
    return fee;
  };

  const baseEventFee = getBaseEventFee();

  const calculateTotal = () => {
    let accFoodFee = 0;
    Object.entries(accommodation).forEach(([day, selected]) => {
      if (selected && !user?.accommodation?.[day]) accFoodFee += (accDayPrices[day] ?? 0);
    });
    Object.entries(food).forEach(([day, selected]) => {
      if (selected && !user?.food?.[day]) accFoodFee += (foodDayPrices[day] ?? 0);
    });

    return baseEventFee + accFoodFee;
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
      } catch (e) {
        // ignore intermediate network error and retry
      }
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    return await getPaymentStatus(merchantOrderId);
  };

  const startPayment = async () => {
    if (finalAmount <= 0) return;
    try {
      setPhase('initiating');
      setErrorMessage('');

      const accToPay: Record<string, boolean> = {};
      const foodToPay: Record<string, boolean> = {};

      Object.entries(accommodation).forEach(([day, selected]) => {
        if (selected && !user?.accommodation?.[day]) accToPay[day] = true;
      });
      Object.entries(food).forEach(([day, selected]) => {
        if (selected && !user?.food?.[day]) foodToPay[day] = true;
      });

      let pType = 'event';
      const hasAcc = Object.keys(accToPay).length > 0;
      const hasFood = Object.keys(foodToPay).length > 0;
      const hasEventFee = baseEventFee > 0;

      if (hasEventFee) {
        if (hasAcc && hasFood) pType = 'event_and_accommodation_and_food';
        else if (hasAcc) pType = 'event_and_accommodation';
        else if (hasFood) pType = 'event_and_accommodation_and_food';
        else pType = 'event';
      } else {
        if (hasAcc && hasFood) pType = 'accommodation_and_food';
        else if (hasAcc) pType = 'accommodation';
        else if (hasFood) pType = 'accommodation_and_food';
        else pType = 'event';
      }

      // Check coupon minCartValue
      let appliedCoupon: string | undefined = undefined;
      if (validCoupon) {
        if (validCoupon.minCartValue && total < validCoupon.minCartValue) {
          showAlert(
            "Coupon Condition Not Met",
            `Coupon "${validCoupon.code}" requires a minimum cart value of ₹${validCoupon.minCartValue}. Please add more options or remove the coupon to proceed.`
          );
          setPhase('checkout');
          return;
        }
        appliedCoupon = validCoupon.code;
      }

      const res = await initiateEventPayment({
        eventId,
        teamId: teamId || eventData?.myTeam?.teamId || undefined,
        paymentType: pType,
        couponCode: appliedCoupon,
        accommodation: accToPay,
        food: foodToPay,
      });

      // Never open the gateway for an amount other than the one on screen.
      if (res.bill?.final != null && res.bill.final !== Math.round(finalAmount)) {
        setPhase('checkout');
        showAlert('Price Updated', `The server total is ₹${res.bill.final}, not ₹${finalAmount}. Please review your selection and try again.`);
        await useUserStore.getState().refreshUserProfile();
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
      await pollAndFinish(orderId, checkoutResult.status === 'cancelled');
    } catch (err: any) {
      setPhase('checkout');
      setErrorMessage(err?.message || 'Failed to start payment');
      showAlert('Payment Error', err?.message || 'Failed to start payment');
    }
  };

  const pollAndFinish = async (
    merchantOrderId: string,
    isCancelled: boolean,
  ) => {
    try {
      const payment = await pollPaymentStatusWithRetry(merchantOrderId);
      const status = payment?.status || 'pending';

      if (status === 'success') {
        await useUserStore.getState().refreshUserProfile();
        queryClient.invalidateQueries({ queryKey: ['events'] });
        setPhase('done');
        showAlert(
          'Payment Successful',
          'Your registration is now confirmed!',
          [{
            text: 'View Registration',
            onPress: () => {
              router.dismissAll();
              router.push({ pathname: '/events/MyEventDetails', params: { eventId } });
            }
          }]
        );
      } else if (status === 'failure') {
        setPhase('checkout');
        showAlert(
          'Payment Failed',
          'Your payment could not be processed by the gateway. Please try again.',
          [{ text: 'Try Again', onPress: () => setPhase('checkout') }]
        );
      } else {
        if (isCancelled) {
          setPhase('checkout');
          showAlert(
            'Payment Incomplete',
            'The payment window was closed before completion. If your payment was deducted, it will update shortly; otherwise you can retry.',
            [{ text: 'Try Again', onPress: () => setPhase('checkout') }]
          );
        } else {
          setPhase('checkout');
          showAlert(
            'Payment Processing',
            'Your payment is still being processed. Please check your registration status in a few moments.',
            [{
              text: 'View Registration',
              onPress: () => {
                queryClient.invalidateQueries({ queryKey: ['events'] });
                router.dismissAll();
                router.push({ pathname: '/events/MyEventDetails', params: { eventId } });
              }
            }]
          );
        }
      }
    } catch (err: any) {
      setPhase('checkout');
      showAlert(
        'Notice',
        'Could not confirm payment status automatically. If your account was debited, it will update shortly; otherwise you can retry.',
        [{ text: 'OK', onPress: () => setPhase('checkout') }]
      );
    }
  };

  const bgColor = isDark ? '#131316' : '#E0E0E0';
  const cardBg = isDark ? '#1C1C20' : '#FFFFFF';
  const cardBorder = isDark ? '#2A2A30' : '#D5D5D5';
  const textColor = isDark ? '#FFFFFF' : '#111827';
  const subTextColor = isDark ? '#A0A0A0' : '#6B7280';
  const inputBg = isDark ? '#26262B' : '#F3F4F6';

  if (eventLoading || (phase !== 'checkout' && phase !== 'done')) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <ActivityIndicator size="large" color="#41B8F0" style={{ marginBottom: 16 }} />
        <Text style={{ fontFamily: 'Poppins_600SemiBold', color: textColor, fontSize: 16, textAlign: 'center' }}>
          {phase === 'initiating' ? 'Preparing Checkout...' :
           phase === 'opening' ? 'Opening Payment Gateway...' :
           phase === 'verifying' ? 'Verifying Payment Outcome...' : 'Loading Event Details...'}
        </Text>
      </View>
    );
  }

  // 1. Check if user/team has ALREADY PAID for the event
  const isPerInd = isPerIndividualPayment(eventData?.event?.paymentType);
  const isTeam = eventData?.event?.eventType === 'team';
  const isLeader = eventData?.myTeam ? eventData.myTeam.leaderUserId === user?.userId : true;

  let isAlreadyPaid = false;
  if (!eventData?.event?.paymentRequired) {
    isAlreadyPaid = true;
  } else if (isTeam && eventData?.myTeam) {
    if (isPerInd) {
      if (isLeader) {
        const hasUnpaid = eventData.myTeam.members?.some((m: any) => m.paymentStatus !== 'success');
        isAlreadyPaid = !!eventData.myTeam.paid && !hasUnpaid;
      } else {
        isAlreadyPaid = eventData.myRegistration?.paymentStatus === 'success';
      }
    } else {
      isAlreadyPaid = !!eventData.myTeam.paid;
    }
  } else {
    isAlreadyPaid = eventData?.myRegistration?.paymentStatus === 'success';
  }

  if (isAlreadyPaid) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
        </View>
        <Text style={{ fontFamily: 'Talina', color: textColor, fontSize: 24, textAlign: 'center', marginBottom: 8 }}>
          REGISTRATION ALREADY PAID
        </Text>
        <Text style={{ fontFamily: 'Poppins_400Regular', color: subTextColor, textAlign: 'center', marginBottom: 32, lineHeight: 22, fontSize: 14 }}>
          {isHost
            ? 'Your registration for this event is confirmed.'
            : 'You have already completed payment for this event and your registration is confirmed. If you need to book or update accommodation, you can manage it from the Accommodation page.'}
        </Text>
        {!isHost && (
          <TouchableOpacity
            onPress={() => router.replace('/profile/Accommodation')}
            style={{ backgroundColor: '#41B8F0', width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12 }}
          >
            <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', fontSize: 15 }}>
              Manage Accommodation & Food
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => {
            router.dismissAll();
            router.push({ pathname: '/events/MyEventDetails', params: { eventId } });
          }}
          style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1, width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: 'Poppins_600SemiBold', color: textColor, fontSize: 15 }}>
            View Registration
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 2. Check if user is a team member who is NOT the leader
  const isTeamMemberNotLeader =
    eventData?.event?.eventType === 'team' &&
    !!eventData?.myTeam &&
    eventData.myTeam.leaderUserId !== user?.userId;

  if (isTeamMemberNotLeader) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Ionicons name="people" size={44} color="#f59e0b" />
        </View>
        <Text style={{ fontFamily: 'Talina', color: textColor, fontSize: 22, textAlign: 'center', marginBottom: 8 }}>
          TEAM LEADER PAYMENT ONLY
        </Text>
        <Text style={{ fontFamily: 'Poppins_400Regular', color: subTextColor, textAlign: 'center', marginBottom: 32, lineHeight: 22, fontSize: 14 }}>
          Only your team leader can complete the registration fee payment for the team.
          You can book your individual accommodation and food passes from the Accommodation page.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/profile/Accommodation')}
          style={{ backgroundColor: '#41B8F0', width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12 }}
        >
          <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', fontSize: 15 }}>
            Book My Accommodation & Food
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            router.dismissAll();
            router.push({ pathname: '/events/MyEventDetails', params: { eventId } });
          }}
          style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1, width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: 'Poppins_600SemiBold', color: textColor, fontSize: 15 }}>
            View Team Status
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isTeamEvent = eventData?.event?.eventType === 'team';

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
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
          <Text style={{ fontFamily: 'Talina', fontSize: 24, color: textColor, letterSpacing: 0.5 }}>
            CHECKOUT
          </Text>
          <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 13, color: '#41B8F0' }} numberOfLines={1}>
            {eventData?.event?.title || (eventData?.event as any)?.name || 'Event Registration'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Event Fee Card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: cardBorder,
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#41B8F0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            {isTeamEvent ? 'Team Registration Fee' : 'Registration Fee'}
          </Text>
          <Text style={{ fontFamily: 'Talina', color: textColor, fontSize: 32 }}>
            ₹{baseEventFee}
          </Text>
          {isTeamEvent && (
            <Text style={{ fontFamily: 'Poppins_400Regular', color: subTextColor, fontSize: 12, marginTop: 4 }}>
              Covers all registered members of your team.
            </Text>
          )}
        </View>

        {/* Accommodation Section (Only for non-host participants) */}
        {!isHost && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontFamily: 'Poppins_600SemiBold', color: textColor, fontSize: 18, marginBottom: 2 }}>
              Stay & Food (Optional)
            </Text>
            <Text style={{ fontFamily: 'Poppins_400Regular', color: subTextColor, fontSize: 13, marginBottom: 14 }}>
              Add accommodation or food pass.
            </Text>

          {isTeamEvent && (
            <View
              style={{
                backgroundColor: isDark ? 'rgba(65, 184, 240, 0.12)' : 'rgba(65, 184, 240, 0.1)',
                borderColor: '#41B8F0',
                borderWidth: 1,
                padding: 14,
                borderRadius: 16,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Ionicons name="information-circle" size={20} color="#41B8F0" />
              <Text style={{ fontFamily: 'Poppins_400Regular', color: textColor, fontSize: 12, marginLeft: 10, flex: 1 }}>
                Accommodation selected here is for you (Team Leader) only. Other team members can book their stay individually from their profile.
              </Text>
            </View>
          )}

          {['day0', 'day1', 'day2', 'day3', 'day4'].map((day) => {
            const accLocked = user?.accommodation?.[day] || false;
            const foodLocked = user?.food?.[day] || false;
            const dayAccPrice = accDayPrices[day] ?? 0;
            const dayFoodPrice = foodDayPrices[day] ?? 0;
            return (
              <View
                key={day}
                style={{
                  backgroundColor: cardBg,
                  borderWidth: 1,
                  borderColor: cardBorder,
                  borderRadius: 20,
                  padding: 18,
                  marginBottom: 14,
                }}
              >
                <Text style={{ fontFamily: 'Poppins_600SemiBold', color: textColor, fontSize: 16, marginBottom: 14, textTransform: 'capitalize' }}>
                  {day}
                </Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontFamily: 'Poppins_500Medium', color: textColor, fontSize: 14 }}>Hostel Accommodation</Text>
                    <Text style={{ fontFamily: 'Poppins_400Regular', color: subTextColor, fontSize: 12 }}>
                      Campus Hostel {dayAccPrice === 0 ? '(Free)' : `(₹${dayAccPrice}/day)`}
                    </Text>
                  </View>
                  {accLocked ? (
                    <View style={{ backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#22c55e', fontSize: 12, marginLeft: 4 }}>Paid</Text>
                    </View>
                  ) : (
                    <Switch
                      value={accommodation[day]}
                      onValueChange={() => toggleAcc(day)}
                      thumbColor="#FFFFFF"
                      trackColor={{ true: '#41B8F0', false: isDark ? '#323238' : '#D1D5DB' }}
                    />
                  )}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontFamily: 'Poppins_500Medium', color: textColor, fontSize: 14 }}>Meals Pass</Text>
                    <Text style={{ fontFamily: 'Poppins_400Regular', color: subTextColor, fontSize: 12 }}>
                      3 Meals Included {dayFoodPrice === 0 ? '(Free)' : `(₹${dayFoodPrice}/day)`}
                    </Text>
                  </View>
                  {foodLocked ? (
                    <View style={{ backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#22c55e', fontSize: 12, marginLeft: 4 }}>Paid</Text>
                    </View>
                  ) : (
                    <Switch
                      value={food[day]}
                      onValueChange={() => toggleFood(day)}
                      thumbColor="#FFFFFF"
                      trackColor={{ true: '#41B8F0', false: isDark ? '#323238' : '#D1D5DB' }}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>
        )}

        {/* Coupon Code Card */}
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
            Have a promo coupon?
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
                  Note: Requires a minimum cart value of ₹{validCoupon.minCartValue} (current: ₹{total}).
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
            onPress={
              total <= 0
                ? () => router.replace({ pathname: '/events/MyEventDetails', params: { eventId } })
                : startPayment
            }
            disabled={total > 0 && finalAmount <= 0}
            style={{
              paddingHorizontal: 32,
              paddingVertical: 15,
              borderRadius: 16,
              backgroundColor: total > 0 && finalAmount <= 0 ? (isDark ? '#2A2A30' : '#E5E7EB') : '#41B8F0',
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize: 16,
                color: total > 0 && finalAmount <= 0 ? subTextColor : '#FFFFFF',
              }}
            >
              {total <= 0 ? 'View Event' : 'Pay Now'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default PaymentScreen;
