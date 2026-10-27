import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { showAlert } from "../index";
import { Copy, Users, Check, Send, CheckCircle2, AlertTriangle, CreditCard } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { FirebaseEvent, TeamRegistrationData } from '@/types/models';
import TeamMemberItem from "./TeamMemberItem";
import TeamStatusMessage from "./TeamStatusMessage";
import { useThemeStore } from "@/state/themeStore";

interface TeamDetailsCardProps {
  teamData: TeamRegistrationData;
  eventData: FirebaseEvent | null;
  userId: string;
  isLeader: boolean;
  submittingTeam?: boolean;
  isPaymentDue?: boolean;
  onPay?: () => void;
  onRemoveMember: (memberUserId: string, memberName: string) => void;
  onSubmitTeam?: () => void;
}

const TeamDetailsCard: React.FC<TeamDetailsCardProps> = ({
  teamData,
  eventData,
  userId,
  isLeader,
  submittingTeam,
  isPaymentDue = false,
  onPay,
  onRemoveMember,
  onSubmitTeam,
}) => {
  const { isDark } = useThemeStore();
  const [copied, setCopied] = useState(false);

  const cardBg = isDark ? '#1C1C22' : '#FFFFFF';
  const cardBorder = isDark ? '#2B2B34' : '#E2E8F0';
  const textPrimary = isDark ? '#FFFFFF' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';

  const handleCopyInviteCode = async () => {
    if (teamData?.inviteCode) {
      await Clipboard.setStringAsync(teamData.inviteCode);
      setCopied(true);
      showAlert("Copied!", "Invite code copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const memberCount = teamData.members?.length ?? 0;
  const minSize = eventData?.minTeamSize ?? 1;
  const maxSize = eventData?.maxTeamSize ?? null;
  const hasEnoughMembers = memberCount >= minSize;

  const getTeamConstraintLabel = () => {
    if (minSize && maxSize) {
      return minSize === maxSize ? `Required: ${minSize}` : `Size: ${minSize} – ${maxSize}`;
    }
    if (minSize > 1) {
      return `Min: ${minSize}`;
    }
    if (maxSize) {
      return `Max: ${maxSize}`;
    }
    return null;
  };

  const constraintLabel = getTeamConstraintLabel();

  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderColor: cardBorder,
        borderWidth: 1,
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.25 : 0.04,
        shadowRadius: 6,
        elevation: 2,
        overflow: 'hidden',
      }}
    >
      {/* Header: Team Name & Team Size */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <View style={{ flex: 1, minWidth: 120 }}>
          <Text
            style={{
              fontFamily: 'Poppins_500Medium',
              fontSize: 10,
              color: textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 2,
            }}
          >
            Team Name
          </Text>
          <Text
            style={{
              fontFamily: 'Poppins_700Bold',
              fontSize: 17,
              color: textPrimary,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {teamData.teamName || "Unnamed Team"}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? 'rgba(65, 184, 240, 0.12)' : 'rgba(65, 184, 240, 0.1)',
            borderColor: 'rgba(65, 184, 240, 0.25)',
            borderWidth: 1,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
            flexShrink: 0,
          }}
        >
          <Users size={12} color="#41B8F0" style={{ marginRight: 5 }} />
          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              fontSize: 12,
              color: '#41B8F0',
            }}
          >
            {memberCount} / {maxSize || '∞'} members
          </Text>
        </View>
      </View>

      {/* Invite Code Box */}
      {teamData.inviteCode ? (
        <View style={{ marginBottom: 14 }}>
          <Text
            style={{
              fontFamily: 'Poppins_500Medium',
              fontSize: 10,
              color: textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 5,
            }}
          >
            Team Invite Code
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? '#23232B' : '#F1F5F9',
              borderColor: isDark ? '#32323E' : '#E2E8F0',
              borderWidth: 1,
              borderRadius: 12,
              paddingLeft: 14,
              paddingRight: 6,
              paddingVertical: 5,
              width: '100%',
            }}
          >
            <Text
              style={{
                flex: 1,
                fontFamily: 'Poppins_700Bold',
                fontSize: 15,
                letterSpacing: 1.5,
                color: '#FFBA00',
              }}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {teamData.inviteCode}
            </Text>

            <TouchableOpacity
              onPress={handleCopyInviteCode}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: copied ? '#10B981' : isDark ? '#333340' : '#E2E8F0',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                flexShrink: 0,
              }}
              activeOpacity={0.7}
            >
              {copied ? (
                <>
                  <Check size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#FFFFFF' }}>
                    Copied
                  </Text>
                </>
              ) : (
                <>
                  <Copy size={13} color={textPrimary} style={{ marginRight: 4 }} />
                  <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: textPrimary }}>
                    Copy
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Team Members List */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
          paddingTop: 12,
          marginBottom: 6,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 8,
          }}
        >
          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              fontSize: 13,
              color: textPrimary,
              flexShrink: 1,
            }}
          >
            Team Members ({memberCount})
          </Text>

          {constraintLabel && (
            <Text
              style={{
                fontFamily: 'Poppins_500Medium',
                fontSize: 11,
                color: hasEnoughMembers ? '#10B981' : '#F59E0B',
                flexShrink: 0,
              }}
            >
              {constraintLabel}
            </Text>
          )}
        </View>

        {(teamData.members || []).map((member) => (
          <TeamMemberItem
            key={member.userId}
            member={member}
            isCurrentUser={member.userId === userId}
            isLeader={isLeader}
            leaderUserId={teamData.leaderUserId}
            canRemove={
              isLeader &&
              member.userId !== userId
            }
            onRemove={() => onRemoveMember(member.userId, member.name || member.displayName || 'member')}
          />
        ))}
      </View>

      {/* Team Status & Action Area for Pending State */}
      {/* Team Status & Actions Area */}
      <View style={{ marginTop: 6 }}>
        {!hasEnoughMembers && (
          <View
            style={{
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
              borderColor: 'rgba(245, 158, 11, 0.3)',
              borderWidth: 1,
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins_500Medium',
                fontSize: 12,
                color: '#F59E0B',
                lineHeight: 18,
              }}
            >
              ⚠️ Your team needs at least {minSize} members to participate (currently {memberCount}). Share your invite code with teammates.
            </Text>
          </View>
        )}

        {isPaymentDue && (
          <View
            style={{
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB',
              borderColor: 'rgba(245, 158, 11, 0.3)',
              borderWidth: 1,
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <AlertTriangle size={15} color="#F59E0B" style={{ marginRight: 6 }} />
              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#F59E0B' }}>
                Payment Required
              </Text>
            </View>
            <Text
              style={{
                fontFamily: 'Poppins_400Regular',
                fontSize: 12,
                color: textSecondary,
                lineHeight: 18,
                marginBottom: 10,
              }}
            >
              {isLeader
                ? "Registration payment is pending for your team. Please complete payment for unpaid members."
                : "Registration payment is pending. Waiting for the team leader to complete payment."}
            </Text>
            {isLeader && (
              <TouchableOpacity
                onPress={onPay}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#F59E0B',
                  borderRadius: 10,
                  paddingVertical: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                }}
              >
                <CreditCard size={15} color="#000000" style={{ marginRight: 6 }} />
                <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 13, color: '#000000' }}>
                  Pay Registration Fee
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!isPaymentDue && hasEnoughMembers && (
          <View
            style={{
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
              borderColor: 'rgba(16, 185, 129, 0.3)',
              borderWidth: 1,
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <CheckCircle2 size={15} color="#10B981" style={{ marginRight: 6 }} />
              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#10B981' }}>
                Team Registration Active
              </Text>
            </View>
            <Text
              style={{
                fontFamily: 'Poppins_400Regular',
                fontSize: 12,
                color: isDark ? '#A7F3D0' : '#047857',
                lineHeight: 18,
              }}
            >
              {maxSize && memberCount < maxSize
                ? `Your team is registered! You can invite ${maxSize - memberCount} more member${maxSize - memberCount > 1 ? 's' : ''} using the invite code above.`
                : 'Your team is registered and ready for the event!'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default TeamDetailsCard;
