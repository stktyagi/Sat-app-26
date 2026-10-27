import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Trash2, Crown } from 'lucide-react-native';
import { useThemeStore } from '@/state/themeStore';

interface TeamMember {
  userId: string;
  name?: string;
  displayName?: string;
  email?: string;
  collegeName?: string;
  paymentStatus?: string;
}

interface TeamMemberItemProps {
  member: TeamMember;
  isCurrentUser: boolean;
  isLeader: boolean;
  leaderUserId: string;
  canRemove: boolean;
  onRemove: () => void;
}

const TeamMemberItem: React.FC<TeamMemberItemProps> = ({
  member,
  isCurrentUser,
  isLeader,
  leaderUserId,
  canRemove,
  onRemove,
}) => {
  const { isDark } = useThemeStore();

  const itemBg = isDark ? '#22222A' : '#F8FAFC';
  const itemBorder = isDark ? '#2F2F3B' : '#E2E8F0';
  const textPrimary = isDark ? '#FFFFFF' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';

  const isMemberLeader = member.userId === leaderUserId;

  return (
    <View
      style={{
        backgroundColor: itemBg,
        borderColor: itemBorder,
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize: 15,
                color: textPrimary,
              }}
            >
              {member.name || member.displayName || 'Member'}
            </Text>

            {isCurrentUser && (
              <View
                style={{
                  backgroundColor: 'rgba(65, 184, 240, 0.15)',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 10,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Poppins_500Medium',
                    fontSize: 11,
                    color: '#41B8F0',
                  }}
                >
                  You
                </Text>
              </View>
            )}

            {isMemberLeader && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 186, 0, 0.15)',
                  borderColor: 'rgba(255, 186, 0, 0.3)',
                  borderWidth: 1,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 10,
                }}
              >
                <Crown size={11} color="#FFBA00" style={{ marginRight: 3 }} />
                <Text
                  style={{
                    fontFamily: 'Poppins_600SemiBold',
                    fontSize: 11,
                    color: '#FFBA00',
                  }}
                >
                  Leader
                </Text>
              </View>
            )}

            {member.paymentStatus === 'success' && (
              <View
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                  borderWidth: 1,
                  paddingHorizontal: 7,
                  paddingVertical: 1,
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 10, color: '#10B981' }}>
                  Paid
                </Text>
              </View>
            )}

            {member.paymentStatus === 'pending' && (
              <View
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  borderColor: 'rgba(245, 158, 11, 0.3)',
                  borderWidth: 1,
                  paddingHorizontal: 7,
                  paddingVertical: 1,
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 10, color: '#F59E0B' }}>
                  Unpaid
                </Text>
              </View>
            )}
          </View>

          {member.email ? (
            <Text
              style={{
                fontFamily: 'Poppins_400Regular',
                fontSize: 12,
                color: textSecondary,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {member.email}
            </Text>
          ) : null}

          {member.collegeName ? (
            <Text
              style={{
                fontFamily: 'Poppins_400Regular',
                fontSize: 12,
                color: textSecondary,
                marginTop: 1,
              }}
              numberOfLines={1}
            >
              {member.collegeName}
            </Text>
          ) : null}
        </View>

        {canRemove && (
          <TouchableOpacity
            onPress={onRemove}
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              borderColor: 'rgba(239, 68, 68, 0.25)',
              borderWidth: 1,
              padding: 8,
              borderRadius: 10,
              marginLeft: 10,
            }}
            activeOpacity={0.7}
          >
            <Trash2 size={16} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default TeamMemberItem;
