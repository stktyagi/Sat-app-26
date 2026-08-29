import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { showAlert } from "../index";
import { Copy } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { FirebaseEvent } from '@/types/models';
import TeamMemberItem from "./TeamMemberItem";
import TeamStatusMessage from "./TeamStatusMessage";
import Button from "../ui/Button";
import DashedHr from "../ui/DashedLine";

interface TeamDetailsCardProps {
  teamData: TeamRegistrationData;
  eventData: FirebaseEvent | null;
  userId: string;
  isLeader: boolean;
  submittingTeam: boolean;
  onRemoveMember: (memberUserId: string, memberName: string) => void;
  onSubmitTeam: () => void;
}

const TeamDetailsCard: React.FC<TeamDetailsCardProps> = ({
  teamData,
  eventData,
  userId,
  isLeader,
  submittingTeam,
  onRemoveMember,
  onSubmitTeam,
}) => {
  const handleCopyInviteCode = async () => {
    if (teamData?.inviteCode) {
      await Clipboard.setStringAsync(teamData.inviteCode);
      showAlert("Copied!", "Invite code copied to clipboard");
    }
  };

  return (
    <View className="mb-6 bg-[#2A2A2A] rounded-xl p-5">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Text
            style={{ fontFamily: "Outfit_500Medium" }}
            className="text-[#9F9F9F] text-lg"
          >
            Team Name:
          </Text>
        </View>
        <Text
          style={{ fontFamily: "Outfit_500Medium" }}
          className="text-[#9F9F9F] text-lg"
        >
          Team Size:
        </Text>
      </View>

      <View className="flex-row items-center justify-between mb-3">
        <Text
          style={{ fontFamily: "Outfit_500Medium" }}
          className="text-[#0C3572] text-xl mb-2"
        >
          {teamData.teamName || "Not set"}
        </Text>
        <Text
          style={{ fontFamily: "Outfit_500Medium" }}
          className="text-[#0C3572] text-xl mb-2"
        >
          {teamData.members.length} / {eventData?.maxTeamSize || "∞"}
        </Text>
      </View>

      {/* Invite Code */}
      <Text className="text-[#9F9F9F] text-md mb-1">Invite Code</Text>
      <View className="flex-row items-center justify-between bg-[#3F3F3F] border-[#FDCE04] border-2 rounded-lg p-3 mb-3">
        <View className="flex-1">
          <Text
            style={{ fontFamily: "Outfit_700Bold" }}
            className="text-[#0C3572] text-center text-lg ml-9"
          >
            {teamData.inviteCode}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleCopyInviteCode}
          className="p-2 rounded-lg ml-3 bg-[#FDCE04]"
        >
          <Copy size={20} />
        </TouchableOpacity>
      </View>

      {/* Team Members List */}
      <View className="my-3 border-dashed border-t border-white pt-4">
        {Platform.OS === "ios" ? <DashedHr className={'mb-5 -mt-3'} color="#0C3572" height={1} dash={[1,1]} /> : null}
       

        <Text className="text-[#0C3572] font-semibold mb-2">Members</Text>
        {teamData.members.map((member) => (
          <TeamMemberItem
            key={member.userId}
            member={member}
            isCurrentUser={member.userId === userId}
            isLeader={isLeader}
            leaderUserId={teamData.leaderUserId}
            canRemove={
              isLeader &&
              member.userId !== userId &&
              teamData.status === "pending"
            }
            onRemove={() => onRemoveMember(member.userId, member.name)}
          />
        ))}
      </View>

      {/* Team Status Message */}
      {teamData.status === "pending" && (
        <View className="mt-2">
          {/* Team Size Status */}
          {eventData && eventData.minTeamSize && (
            <View className="mb-3 bg-gray-900 rounded-lg p-3">
              <Text
                className={`text-sm font-medium ${
                  teamData.members.length >= eventData.minTeamSize
                    ? "text-green-400"
                    : "text-orange-400"
                }`}
              >
                Team Size: {teamData.members.length} / {eventData.minTeamSize}-
                {eventData.maxTeamSize || "∞"}
              </Text>
              {teamData.members.length < eventData.minTeamSize && (
                <Text className="text-orange-400 text-xs mt-1">
                  Need {eventData.minTeamSize - teamData.members.length} more
                  member
                  {eventData.minTeamSize - teamData.members.length !== 1
                    ? "s"
                    : ""}{" "}
                  to submit
                </Text>
              )}
            </View>
          )}

          {/* Submit Team Button - Only for leader when team has enough members */}
          {isLeader &&
            eventData &&
            eventData.minTeamSize &&
            teamData.members.length >= eventData.minTeamSize && (
              <Button
                title={
                  submittingTeam ? "Submitting..." : "Submit Team for Review"
                }
                onPress={onSubmitTeam}
                variant="none" 
                className="mb-3 bg-[#95aad3] border-[#0C3572] border-2 py-3 rounded-xl" 
                textClassName="text-[#0C3572]"
                disabled={submittingTeam}
              />
            )}

          <View className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3">
            <Text className="text-[#0C3572] text-sm">
              {teamData.members.length >= (eventData?.minTeamSize || 1)
                ? "✓ Your team meets the minimum size requirement. The team leader can now submit for review."
                : "⚠️ Team is incomplete. Share the invite code with teammates to complete your team."}
            </Text>
          </View>
        </View>
      )}
      {teamData.status && <TeamStatusMessage status={teamData.status} />}
    </View>
  );
};

export default TeamDetailsCard;
