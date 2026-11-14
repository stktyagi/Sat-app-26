import React from 'react';
import { View, Text } from 'react-native';
import { Clock, CreditCard, CheckCircle2, XCircle } from 'lucide-react-native';
import { useThemeStore } from '@/state/themeStore';

interface TeamStatusMessageProps {
  status: 'pending' | 'awaited' | 'payment_pending' | 'confirmed' | 'rejected';
}

const TeamStatusMessage: React.FC<TeamStatusMessageProps> = ({ status }) => {
  const { isDark } = useThemeStore();

  if (status === 'pending') {
    return (
      <View
        style={{
          marginTop: 12,
          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
          borderColor: 'rgba(245, 158, 11, 0.35)',
          borderWidth: 1,
          borderRadius: 14,
          padding: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Clock size={16} color="#F59E0B" style={{ marginRight: 6 }} />
          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              fontSize: 13,
              color: '#F59E0B',
            }}
          >
            Team Incomplete
          </Text>
        </View>
        <Text
          style={{
            fontFamily: 'Poppins_400Regular',
            fontSize: 12,
            color: isDark ? '#FDE68A' : '#92400E',
            lineHeight: 18,
          }}
        >
          Your team does not have the minimum required members yet. Please complete your team before proceeding to payment and confirmation.
        </Text>
      </View>
    );
  }

  if (status === 'awaited') {
    return (
      <View
        style={{
          marginTop: 12,
          backgroundColor: isDark ? 'rgba(168, 85, 247, 0.12)' : 'rgba(168, 85, 247, 0.08)',
          borderColor: 'rgba(168, 85, 247, 0.3)',
          borderWidth: 1,
          borderRadius: 14,
          padding: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Clock size={16} color="#A855F7" style={{ marginRight: 6 }} />
          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              fontSize: 13,
              color: '#A855F7',
            }}
          >
            Team Submitted for Review
          </Text>
        </View>
        <Text
          style={{
            fontFamily: 'Poppins_400Regular',
            fontSize: 12,
            color: isDark ? '#D8B4FE' : '#6B21A8',
            lineHeight: 18,
          }}
        >
          Your team is currently under review by event coordinators. No changes can be made while under review.
        </Text>
      </View>
    );
  }

  if (status === 'payment_pending') {
    return (
      <View
        style={{
          marginTop: 12,
          backgroundColor: isDark ? 'rgba(255, 186, 0, 0.12)' : 'rgba(255, 186, 0, 0.1)',
          borderColor: 'rgba(255, 186, 0, 0.35)',
          borderWidth: 1,
          borderRadius: 14,
          padding: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <CreditCard size={16} color="#FFBA00" style={{ marginRight: 6 }} />
          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              fontSize: 13,
              color: '#FFBA00',
            }}
          >
            Payment Required
          </Text>
        </View>
        <Text
          style={{
            fontFamily: 'Poppins_400Regular',
            fontSize: 12,
            color: isDark ? '#FDE68A' : '#92400E',
            lineHeight: 18,
          }}
        >
          The registration fee must be completed by the team leader to confirm your team's entry.
        </Text>
      </View>
    );
  }

  if (status === 'confirmed') {
    return (
      <View
        style={{
          marginTop: 12,
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
          borderColor: 'rgba(16, 185, 129, 0.3)',
          borderWidth: 1,
          borderRadius: 14,
          padding: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <CheckCircle2 size={16} color="#10B981" style={{ marginRight: 6 }} />
          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              fontSize: 13,
              color: '#10B981',
            }}
          >
            Team Registration Confirmed!
          </Text>
        </View>
        <Text
          style={{
            fontFamily: 'Poppins_400Regular',
            fontSize: 12,
            color: isDark ? '#A7F3D0' : '#065F46',
            lineHeight: 18,
          }}
        >
          You're all set! Best of luck to your team at the event.
        </Text>
      </View>
    );
  }

  if (status === 'rejected') {
    return (
      <View
        style={{
          marginTop: 12,
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
          borderWidth: 1,
          borderRadius: 14,
          padding: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <XCircle size={16} color="#EF4444" style={{ marginRight: 6 }} />
          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              fontSize: 13,
              color: '#EF4444',
            }}
          >
            Registration Not Approved
          </Text>
        </View>
        <Text
          style={{
            fontFamily: 'Poppins_400Regular',
            fontSize: 12,
            color: isDark ? '#FECACA' : '#991B1B',
            lineHeight: 18,
          }}
        >
          Please get in touch with event coordinators for assistance or additional details.
        </Text>
      </View>
    );
  }

  return null;
};

export default TeamStatusMessage;
