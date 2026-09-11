import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Linking,
} from "react-native";
import { showAlert } from "@/components";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useUserStore } from "@/state/userStore";
import { FirebaseEvent } from "@/types/models";
import Button from "@/components/ui/Button";
import Header from "@/components/layout/Header";
import RegistrationStatusCard from "@/components/registration/RegistrationStatusCard";
import TeamDetailsCard from "@/components/registration/TeamDetailsCard";
import EventTicketCard from "@/components/registration/EventTicketCard";
import TeamSubmissionModal from "@/components/registration/TeamSubmissionModal";
import { useEventDetail } from "@/hooks/useEventDetail";
import { useDeleteTeam, useRemoveTeamMember, useUnregisterForEvent } from "@/hooks/useEventMutations";

interface MyEventDetailsRouteParams {
  eventId: string;
}

const MyEventDetailsScreen: React.FC = () => {
  const router = useRouter();
  const { eventId } = useLocalSearchParams() as { eventId: string };

  const { userData: userProfile } = useUserStore();
  const userId = userProfile?.userId || "";

  const { data: detailData, loading } = useEventDetail(eventId);
  const eventData = detailData?.event || null;
  const registration = detailData?.myRegistration || null;
  const teamData = detailData?.myTeam || null;

  const [submittingTeam, setSubmittingTeam] = useState(false);
  const [isSubmissionModalVisible, setIsSubmissionModalVisible] =
    useState(false);

  const deleteTeamMutation = useDeleteTeam();
  const removeTeamMemberMutation = useRemoveTeamMember();
  const unregisterMutation = useUnregisterForEvent();

  const handleRemoveMember = (memberUserId: string, memberName: string) => {
    if (!teamData) {
      showAlert("Error", "Team data not available");
      return;
    }

    showAlert("Remove member", `Remove ${memberName} from the team?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          if (!teamData?.teamRef) return;
          removeTeamMemberMutation.mutate(
            { teamRef: teamData.teamRef, userId: memberUserId },
            {
              onError: (error: any) => showAlert("Error", error.message || "Failed to remove member"),
            }
          );
        },
      },
    ]);
  };

  const handleDeleteTeam = () => {
    if (!teamData) {
      showAlert("Error", "Team data not available");
      return;
    }

    showAlert("Delete team", "This will cancel the whole team's registration.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (!teamData?.teamRef) return;
          deleteTeamMutation.mutate(teamData.teamRef, {
            onSuccess: () => router.back(),
            onError: (error: any) => showAlert("Error", error.message || "Failed to delete team"),
          });
        },
      },
    ]);
  };

  const handleCancelRegistration = () => {
    showAlert("Cancel Registration", "Are you sure you want to cancel your registration for this event?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: () => {
          unregisterMutation.mutate(eventId, {
            onSuccess: () => router.back(),
            onError: (error: any) => showAlert("Error", error.message || "Failed to cancel registration"),
          });
        },
      },
    ]);
  };

  const handleSubmitTeam = async () => {
    if (!eventData || !teamData) return;

    // Validate team size
    if (
      eventData.minTeamSize &&
      (teamData.members?.length ?? 0) < eventData.minTeamSize
    ) {
      showAlert(
        "Insufficient Team Size",
        `Your team needs at least ${
          eventData.minTeamSize
        } members to submit. Currently you have ${
          teamData.members.length
        } member${
          teamData.members.length !== 1 ? "s" : ""
        }.\n\nPlease share the invite code with your teammates before submitting.`
      );
      return;
    }

    setIsSubmissionModalVisible(true);
    // showAlert(
    //   'Submit Team',
    //   `Are you sure you want to submit your team for review? Your team has ${teamData.members.length} member${teamData.members.length !== 1 ? 's' : ''}.`,
    //   [
    //     { text: 'Cancel', style: 'cancel' },
    //     {
    //       text: 'Submit',
    //       onPress: async () => {
    //         try {
    //           setSubmittingTeam(true);
    //           // Submit with empty custom fields since they should have been filled during registration
    //           let referredBy = '';
    //           const result = await submitTeam(eventId, [], referredBy);

    //           if (result.success) {
    //             showAlert('Success', 'Team submitted successfully! Your registration is now awaiting admin approval.');
    //             await fetchRegistrationData();
    //           } else {
    //             showAlert('Error', result.error);
    //           }
    //         } catch (error: any) {
    //           showAlert('Error', error.message || 'Failed to submit team');
    //         } finally {
    //           setSubmittingTeam(false);
    //         }
    //       },
    //     },
    //   ]
    // );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-transparent items-center justify-center">
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#FFBA00" />
      </View>
    );
  }

  if (!registration) {
    return (
      <View className="flex-1 bg-transparent items-center justify-center px-6">
        <StatusBar barStyle="light-content" />
        <Text className="text-[#0C3572] text-xl text-center">
          Registration not found
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 bg-yellow-400 px-6 py-3 rounded-xl"
        >
          <Text className="text-black font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isLeader = teamData?.leaderUserId === userId;

  return (
    <View className="flex-1 bg-transparent">
      {/* Header */}
      <Header />
      <View className="px-6 pt-12 pb-4 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0C3572" />
        </TouchableOpacity>
        <Text
          style={{ fontFamily: "Outfit_700Bold" }}
          ellipsizeMode="tail"
          numberOfLines={1}
          className="text-[#0C3572] w-[80%] text-3xl"
        >
          {eventData?.title || registration.eventName}
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView
        className="flex-1 px-6 py-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Status Card */}
        <RegistrationStatusCard
          status={registration.status || 'pending'}
          eventCategory={registration.eventCategory || eventData?.category || ''}
          eventType={(eventData?.eventType === 'team' ? 'team' : 'individual')}
          registeredAt={registration.registeredAt || new Date().toISOString()}
        />

        {/* Event Ticket with QR Code - Only show when confirmed */}
        {registration.status !== "rejected" && (
          <View className="mb-4">
            <EventTicketCard registration={registration} eventData={eventData} />

          </View>
        )}

        {/* Team Details for Team Events */}
        {eventData?.eventType === "team" && teamData && (
          <TeamDetailsCard
            teamData={teamData}
            eventData={eventData}
            userId={userId}
            isLeader={isLeader}
            submittingTeam={submittingTeam}
            onRemoveMember={handleRemoveMember}
            onSubmitTeam={handleSubmitTeam}
          />
        )}

        {/* Payment Button */}
        {registration.status === "payment_pending" && (eventData?.eventType === "individual" || isLeader) && (
          <View className="mb-6">
            <Button
              title="Complete Payment"
              onPress={() => router.push({ pathname: "/(app)/event-payment", params: { eventId } })}
              variant="primary"
              className="bg-[#FDCE04] flex-row items-center justify-center"
            />
            <Text className="text-[#2175C0] text-xs text-center mt-2">
              Complete your payment to confirm your registration
            </Text>
          </View>
        )}

        {/* Rejected Status Message for Individual Events */}
        {eventData?.eventType === "individual" &&
          registration.status === "rejected" && (
            <View className="mb-6 bg-red-900/20 border border-red-600/30 rounded-lg p-4">
              <Text className="text-red-400 text-sm font-semibold mb-2">
                Registration Rejected
              </Text>
              <Text className="text-red-400 text-sm">
                Your registration has been rejected. Please contact the event
                organizers for more information.
              </Text>
            </View>
          )}

        {/* Team Management Actions - Only available for leader when status is pending */}
        {eventData?.eventType === "team" &&
          teamData &&
          teamData.status === "pending" &&
          isLeader && (
            <View className="mb-6">
              <Button
                title="Delete Team"
                onPress={handleDeleteTeam}
                variant="outline"
                className="bg-transparent border-[#BA1415] border-2  flex-row items-center justify-center"
              />
            </View>
          )}

        {/* Individual Event Actions */}
        {eventData?.eventType === "individual" &&
          registration.status !== "rejected" && (
            <View className="mb-6">
              <Button
                title="Cancel Registration"
                onPress={handleCancelRegistration}
                variant="outline"
                className="bg-transparent border-[#BA1415] border-2 flex-row items-center justify-center"
              />
            </View>
          )}
      </ScrollView>
      <TeamSubmissionModal
        visible={isSubmissionModalVisible}
        onClose={() => setIsSubmissionModalVisible(false)}
        event={eventData}
        teamData={teamData}
        onSubmitSuccess={() => {
          setIsSubmissionModalVisible(false);
        }}
      />
    </View>
  );
};

export default MyEventDetailsScreen;
