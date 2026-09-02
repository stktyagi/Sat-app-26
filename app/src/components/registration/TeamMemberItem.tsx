import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Trash2 } from 'lucide-react-native';

interface TeamMember {
  userId: string;
  name?: string;
  displayName?: string;
  email?: string;
  collegeName?: string;
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
  return (
    <View className="bg-[#3F3F3F] rounded-lg p-3 mb-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-white text-lg">
                {member.name || member.displayName || 'Member'}
              </Text>
              {isCurrentUser && (
                <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#A7A7A7] text-md">
                  (You)
                </Text>
              )}
            </View>
            {member.userId === leaderUserId && (
              <View className="bg-[#70632C] px-2 py-1 rounded ml-2">
                <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#FDCE04] text-xs">
                  Leader
                </Text>
              </View>
            )}
          </View>
          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-gray-400 text-xs my-1">
            {member.email}
          </Text>
          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-gray-400 text-xs">
            {member.collegeName}
          </Text>
        </View>

        {canRemove && (
          <TouchableOpacity onPress={onRemove} className="bg-red-500/20 p-2 rounded-lg ml-2">
            <Trash2 size={18} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default TeamMemberItem;
