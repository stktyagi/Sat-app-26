import React, { useState, useEffect } from "react";
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
import { deleteTeam, getEventDetail, getMyEvents, removeTeamMember } from "@/api/events";
interface MyEventDetailsRouteParams {
  eventId: string;
}

const MyEventDetailsScreen: React.FC = () => {
  const router = useRouter();
  const { eventId } = useLocalSearchParams() as { eventId: string };

  const { userData: userProfile } = useUserStore();
  const userId = userProfile?.userId || "";

  const [loading, setLoading] = useState(true);
  const [registration, setRegistration] = useState<any>(null);
  const [teamData, setTeamData] = useState<any>(null);
  const [eventData, setEventData] = useState<FirebaseEvent | null>(null);
  const [submittingTeam, setSubmittingTeam] = useState(false);
  const [isSubmissionModalVisible, setIsSubmissionModalVisible] =
    useState(false);

  useEffect(() => {
    // console.log("teamData changed:", teamData);
    // console.log("Fetching registration data for eventId:", eventId);
    fetchRegistrationData();
  }, [eventId]);

  const fetchRegistrationData = async () => {
    try {
      setLoading(true);
      const detail = await getEventDetail(eventId);
      setEventData(detail.event);
      setRegistration(detail.myRegistration);
      setTeamData(detail.myTeam);
    } catch (error) {
      try {
        const items = await getMyEvents();
        const row = items.find((item) => item.registration?.eventId === eventId || item.event?.eventId === eventId);
        setEventData(row?.event ?? null);
        setRegistration(row?.registration ?? null);
        setTeamData(row?.team ?? null);
      } catch (inner) {
        console.error("Error fetching registration data:", inner);
        showAlert("Error", "Failed to load registration details");
      }
    } finally {
      setLoading(false);
    }
  };

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
        onPress: async () => {
          try {
            if (!teamData?.teamRef) return;
            await removeTeamMember(teamData.teamRef, memberUserId);
            await fetchRegistrationData();
          } catch (error: any) {
            showAlert("Error", error.message || "Failed to remove member");
          }
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
        onPress: async () => {
          try {
            if (!teamData?.teamRef) return;
            await deleteTeam(teamData.teamRef);
            router.back();
          } catch (error: any) {
            showAlert("Error", error.message || "Failed to delete team");
          }
        },
      },
    ]);
  };

  const handleSubmitTeam = async () => {
    if (!eventData || !teamData) return;

    // Validate team size
    if (
      eventData.minTeamSize &&
      teamData.members.length < eventData.minTeamSize
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
          status={registration.status}
          eventCategory={registration.eventCategory}
          eventType={registration.eventType}
          registeredAt={registration.registeredAt}
        />

        {/* Event Ticket with QR Code - Only show when confirmed */}
        {registration.status !== "rejected" && (
          <View className="mb-4">
            <EventTicketCard registration={registration} eventData={eventData} />
            <Button
              onPress={() => {
                const dateStr = eventData?.startDateTime || eventData?.dateTime;
                let url = 'https://calendar.google.com/calendar/r';
                if (dateStr) {
                  const date = new Date(dateStr);
                  if (!isNaN(date.getTime())) {
                    url = `https://calendar.google.com/calendar/r/month/${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
                  }
                }
                Linking.openURL(url);
              }}
              variant="outline"
              className="mt-4 border-[#0C3572] bg-white flex-row items-center justify-center"
            >
              <Ionicons name="logo-google" size={18} color="#0C3572" style={{ marginRight: 8 }} />
              <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#0C3572] font-semibold text-center text-base">
                View in Google Calendar
              </Text>
            </Button>
          </View>
        )}

        {/* Team Details for Team Events */}
        {registration.eventType === "team" && teamData && (
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
        {registration.status === "payment_pending" && (registration.eventType === "individual" || isLeader) && (
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
        {registration.eventType === "individual" &&
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
        {registration.eventType === "team" &&
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
      </ScrollView>
      <TeamSubmissionModal
        visible={isSubmissionModalVisible}
        onClose={() => setIsSubmissionModalVisible(false)}
        event={eventData}
        teamData={teamData}
        onSubmitSuccess={() => {
          setIsSubmissionModalVisible(false);
          fetchRegistrationData(); // Refresh data on success
        }}
      />
    </View>
  );
};

export default MyEventDetailsScreen;
