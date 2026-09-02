// src/screens/App/NotificationsScreen.tsx
import React, { useCallback, useEffect, useState, } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import Header from "@/components/layout/Header";
import { ArrowLeft, BellOff, CheckCircle } from "lucide-react-native";
import { useUserStore } from "@/state/userStore";
import { Poll, Update } from "@/types/models";
import { getAllPolls, voteOnPoll } from "@/api/admin";
import { getUpdates } from "@/api/admin";
import { showAlert } from "@/components";
import { getEvent } from "@/api/events";

const NotificationsScreen = () => {
  const router = useRouter();
  const { userData: userProfile } = useUserStore();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("Polls");
  const [isLoadingEvent, setIsLoadingEvent] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);

      const unsubscribePolls = getAllPolls((polls: Poll[]) => {
        setPolls(polls);
        setLoading(false);
      });

      const unsubscribeUpdates = getUpdates((updates: Update[]) => {
        setUpdates(updates);
      });

      return () => {
        if (typeof unsubscribePolls === 'function') unsubscribePolls();
        if (typeof unsubscribeUpdates === 'function') unsubscribeUpdates();
      };
    }, [])
  );

  const handleNavigateToEvent = useCallback(
    async (eventId: string) => {
      if (!eventId) {
        showAlert("Error", "Event information not available");
        return;
      }

      setIsLoadingEvent(true);
      try {
        // Fetch the full event data
        const eventData = await getEvent(eventId);

        if (eventData) {
          // Navigate with the full event object
          router.push({ pathname: "/events/EventDetails", params: { id: eventData.eventId } });
        } else {
          showAlert("Error", "Event not found. Please try again later.");
        }
      } catch (error) {
        console.error("Error fetching event details:", error);
        showAlert("Error", "Failed to load event details");
      } finally {
        setIsLoadingEvent(false);
      }
    },
    [router]
  );

  const handleVote = async (pollId: string, option: string) => {
    if (!userProfile) {
      showAlert("Error", "You must be logged in to vote.");
      return;
    }
    setVotingId(pollId);
    try {
      await voteOnPoll(pollId, option);
    } catch (error: any) {
      if (error.message.includes("already voted")) {
        showAlert(
          "Already Voted",
          "You have already cast your vote in this poll."
        );
      } else {
        showAlert("Error", "Failed to cast vote. Please try again.");
      }
      console.error(error);
    } finally {
      setVotingId(null);
    }
  };

  const renderUpdates = () => {
    if (loading) {
      return (
        <View className="flex-1 items-center justify-center pt-20">
          <ActivityIndicator size="large" color="#FFBA00" />
          <Text className="text-[#2175C0] mt-4">Loading updates...</Text>
        </View>
      );
    }

    if (updates.length === 0) {
      return (
        <View className="flex-1 items-center justify-center pt-20">
          <View className="bg-[#FFFFFF66] rounded-full p-8 mb-6">
            <BellOff size={64} color="#666" strokeWidth={1.5} />
          </View>
          <Text
            style={{ fontFamily: "Outfit_600SemiBold" }}
            className="text-[#0C3572] text-xl mb-3 text-center"
          >
            No Updates Available
          </Text>
          <Text
            style={{ fontFamily: "Outfit_400Regular" }}
            className="text-[#2175C0] text-center text-base px-8 leading-6"
          >
            There are no updates at the moment. Check back later!
          </Text>
        </View>
      );
    }

    return updates.map((update) => (
      <View
        key={update.id}
        className="bg-white rounded-2xl p-5 mb-6 border border-[#A0B3D0]"
      >
        <Text
          style={{ fontFamily: "Outfit_600SemiBold" }}
          className="text-[#FFBA00] text-xl mb-2"
        >
          {update.title}
        </Text>
        <Text
          style={{ fontFamily: "Outfit_400Regular" }}
          className="text-[#2175C0] text-base leading-6 mb-2"
        >
          {update.description}
        </Text>
        {(update.linkType === 'external' && update.link) && (
          <TouchableOpacity
            onPress={() => Linking.openURL(update.link!)}
            className="bg-[#FFBA00] py-3 rounded-lg mt-2 flex-row items-center justify-center"
          >
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-black text-base"
            >
              Learn More
            </Text>
          </TouchableOpacity>
        )}
        {update.linkType === 'event' && update.eventId && (
          <TouchableOpacity
            onPress={() => {
              // @ts-ignore - navigation type issue
              handleNavigateToEvent(update.eventId);
            }}
            className="border-[#FFBA00] border-2 py-3 rounded-lg mt-2 flex-row items-center justify-center"
          >
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-[#FFBA00] text-base"
            >
              View Event
            </Text>
          </TouchableOpacity>
        )}
      </View>
    ));
  };

  const renderPolls = () => {
    if (loading) {
      return (
        <View className="flex-1 items-center justify-center pt-20">
          <ActivityIndicator size="large" color="#FFBA00" />
          <Text className="text-[#2175C0] mt-4">Loading polls...</Text>
        </View>
      );
    }

    if (polls.length === 0) {
      return (
        <View className="flex-1 items-center justify-center pt-20">
          <View className="bg-[#FFFFFF66] rounded-full p-8 mb-6">
            <BellOff size={64} color="#666" strokeWidth={1.5} />
          </View>
          <Text
            style={{ fontFamily: "Outfit_600SemiBold" }}
            className="text-[#0C3572] text-xl mb-3 text-center"
          >
            No Polls Available
          </Text>
          <Text
            style={{ fontFamily: "Outfit_400Regular" }}
            className="text-[#2175C0] text-center text-base px-8 leading-6"
          >
            There are no active polls at the moment. Check back later!
          </Text>
        </View>
      );
    }

    return polls.map((poll) => {
      const userHasVoted =
        userProfile && poll.voters.includes(userProfile.userId);
      const totalVotes = Object.values(poll.votes).reduce(
        (a: number, b: number) => a + b,
        0
      );

      return (
        <View
          key={poll.id}
          className="bg-[#3F3F3F] rounded-2xl p-5 mb-6 border border-[#A0B3D0]"
        >
          <Text
            style={{ fontFamily: "Outfit_600SemiBold" }}
            className="text-[#0C3572] text-xl mb-1"
          >
            {poll.question}
          </Text>
          {userHasVoted && (
            <View className="flex-row items-center justify-start mb-1">
              <CheckCircle size={14} color="#4ade80" />
              <Text className="text-green-400 text-xs ml-1">
                You have voted
              </Text>
            </View>
          )}
          <View className="mt-4">
            {poll.options.map((option: string, index: number) => {
              const voteCount = poll.votes[option] || 0;
              const percentage =
                totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
              const maxVotes = Math.max(
                0,
                ...Object.values(poll.votes)
              );
              const isMostVoted = maxVotes > 0 && voteCount === maxVotes;

              if (userHasVoted) {
                return (
                  <View
                    key={index}
                    className="mb-3 flex-row items-center gap-12 justify-between"
                  >
                    <View className="flex-1  flex-row items-center gap-2">
                      <View
                        style={{ width: `${percentage}%`, minWidth: 100 }}
                        className={`flex-row px-4 py-3 rounded-lg justify-between items-center mb-1 ${isMostVoted ? "bg-[#FFBA00]" : "bg-[#A4A4A4]"
                          }`}
                      >
                        <Text
                          ellipsizeMode="tail"
                          numberOfLines={1}
                          style={{ fontFamily: "Outfit_600SemiBold", fontSize: 12 }}
                          className={
                            !isMostVoted ? "text-[#3F3F3F]" : "text-black"
                          }
                        >
                          {option}
                        </Text>
                      </View>
                      <Text
                        className={
                          !isMostVoted ? "text-[#ffffff]" : "text-[#FFBA00]"
                        }
                      >
                        {percentage.toFixed(1)}%
                      </Text>
                    </View>
                    <Text
                      style={{ fontFamily: "Outfit_600SemiBold" }}
                      className={
                        !isMostVoted ? "text-[#ffffff]" : "text-[#FFBA00]"
                      }
                    >
                      {voteCount} votes
                    </Text>
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleVote(poll.id, option)}
                  disabled={votingId === poll.id}
                  className="border border-[#DADADA] rounded-lg px-4 py-3 pl-6 mb-3 flex-row justify-start items-center"
                >
                  {votingId === poll.id ? (
                    <ActivityIndicator color="#FFBA00" />
                  ) : (
                    <Text
                      style={{ fontFamily: "Outfit_600SemiBold" }}
                      className="text-[#0C3572]"
                    >
                      {option}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <View className="mt-2 border-t border-[#A0B3D0] pt-2 flex-row justify-between">
            <View>
              <Text className="text-[#2175C0] text-sm mt-2">
                Poll Created on
              </Text>
              <Text className="text-[#2175C0] text-sm">
                {new Date(poll.createdAt.seconds).toLocaleDateString()}
              </Text>
            </View>
            <View className="mt-2">
              <Text className="text-[#2175C0] text-sm">Total Votes</Text>
              <Text className="text-[#2175C0] text-sm">{totalVotes}</Text>
            </View>
          </View>
        </View>
      );
    });
  };

  return (
    <View className="flex-1 bg-transparent">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Header />

        <View className="bg-transparent rounded-t-3xl px-6 pt-8">
          <View className="mb-6 flex-row items-center justify-between">
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft color="#0C3572" size={24} />
            </TouchableOpacity>
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#0C3572] text-3xl"
            >
              Notifications
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <View className="flex-row mb-6">
            <TouchableOpacity
              onPress={() => setActiveTab("Polls")}
              className={`flex-1 py-3 items-center justify-center border-b-2 ${activeTab === "Polls"
                ? "border-[#FFBA00]"
                : "border-transparent"
                }`}
            >
              <Text
                className={`text-lg ${activeTab === "Polls" ? "text-[#FFBA00]" : "text-[#2175C0]"
                  }`}
                style={{ fontFamily: "Outfit_600SemiBold" }}
              >
                Polls
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab("Updates")}
              className={`flex-1 py-3 items-center justify-center border-b-2 ${activeTab === "Updates"
                ? "border-[#FFBA00]"
                : "border-transparent"
                }`}
            >
              <Text
                className={`text-lg ${activeTab === "Updates" ? "text-[#FFBA00]" : "text-[#2175C0]"
                  }`}
                style={{ fontFamily: "Outfit_600SemiBold" }}
              >
                Updates
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === "Polls" ? renderPolls() : renderUpdates()}
        </View>
      </ScrollView>
    </View>
  );
};

export default NotificationsScreen;


