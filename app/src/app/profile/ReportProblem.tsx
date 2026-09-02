import { useRouter } from 'expo-router';
import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking } from "react-native";
import Header from "@/components/layout/Header";
import { Ionicons } from "@expo/vector-icons";

export default function ReportProblemScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [issueType, setIssueType] = useState<string | null>(null);

  const handleSelectIssue = (type: string) => {
    setIssueType(type);
    setStep(2);
  };

  const handleSelectUrgency = () => {
    setStep(3);
  };

  const handleContactSupport = () => {
    Linking.openURL("tel:+919999999999");
  };

  const step2Options: Record<string, { title: string, options: { id: string, label: string, desc: string }[] }> = {
    'Payment / Refund Issue': {
      title: 'What specific payment issue are you facing?',
      options: [
        { id: 'p1', label: 'Money deducted but payment failed', desc: 'Amount left your account but app shows failed' },
        { id: 'p2', label: 'Did not receive refund', desc: 'Refund was promised but not received' },
        { id: 'p3', label: 'Unable to make payment', desc: 'Payment page is not loading or failing' },
      ]
    },
    'Event Registration': {
      title: 'What issue are you having with events?',
      options: [
        { id: 'e1', label: 'Cannot register for an event', desc: 'Registration button is not working or gives error' },
        { id: 'e2', label: 'Did not receive confirmation', desc: 'Registered successfully but no pass/ticket shown' },
        { id: 'e3', label: 'Event details are incorrect', desc: 'Timing, location, or rules seem wrong' },
      ]
    },
    'Account / Login': {
      title: 'What account issue are you experiencing?',
      options: [
        { id: 'a1', label: 'Cannot log in', desc: 'Authentication fails or stuck on login screen' },
        { id: 'a2', label: 'Profile details are incorrect', desc: 'Wrong college, name, or other details' },
        { id: 'a3', label: 'Cannot update information', desc: 'Profile edits are not saving' },
      ]
    },
    'App Crash / Bug': {
      title: 'What kind of bug did you find?',
      options: [
        { id: 'b1', label: 'App crashes completely', desc: 'App closes unexpectedly' },
        { id: 'b2', label: 'A specific feature is broken', desc: 'Something is not working as intended' },
        { id: 'b3', label: 'UI or Display issue', desc: 'Text cut off, images not loading, etc.' },
      ]
    },
    'Other': {
      title: 'How is this impacting you?',
      options: [
        { id: 'high', label: 'I cannot use the app at all', desc: 'Critical issue blocking usage' },
        { id: 'medium', label: 'A specific feature is broken', desc: 'Can still use other parts' },
        { id: 'low', label: 'Just a minor glitch or typo', desc: 'Not blocking anything important' },
      ]
    },
    'Accommodation': {
      title: 'What accommodation issue are you facing?',
      options: [
        { id: 'ac1', label: 'Hostel allotment issue', desc: 'Not allotted a room or wrong hostel' },
        { id: 'ac2', label: 'Room condition / facilities', desc: 'Issues with bed, fan, cleanliness, etc.' },
        { id: 'ac3', label: 'Check-in / Check-out problem', desc: 'Issues with timings or guards' },
      ]
    }
  };

  const currentStep2Data = step2Options[issueType || 'Other'] || step2Options['Other'];

  return (
    <View className="flex-1 bg-transparent">
      <Header />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View className="bg-transparent px-2">
          <View className="px-6 pt-8 pb-4 flex-row items-center justify-between">
            <TouchableOpacity onPress={() => {
              if (step > 1) {
                setStep(step - 1);
              } else {
                router.back();
              }
            }}>
              <Ionicons name="arrow-back" size={24} color="#0C3572" />
            </TouchableOpacity>
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#0C3572] text-2xl"
            >
              Report a Problem
            </Text>
            <View className="w-8" />
          </View>

          <View className="mt-4 px-4">
            {step === 1 && (
              <View>
                <Text style={{ fontFamily: "Outfit_600SemiBold" }} className="text-[#0C3572] text-xl mb-6 text-center">
                  What kind of issue are you facing?
                </Text>
                
                {[
                  { id: 'payment', label: 'Payment / Refund Issue', icon: 'card-outline' },
                  { id: 'event', label: 'Event Registration', icon: 'calendar-outline' },
                  { id: 'account', label: 'Account / Login', icon: 'person-outline' },
                  { id: 'accommodation', label: 'Accommodation', icon: 'home-outline' },
                  { id: 'app', label: 'App Crash / Bug', icon: 'bug-outline' },
                  { id: 'other', label: 'Other', icon: 'help-circle-outline' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    className="bg-[#FFFFFF] border-[1px] border-[#0C3572] flex-row items-center p-4 rounded-2xl mb-4"
                    onPress={() => handleSelectIssue(item.label)}
                  >
                    <View className="w-10 h-10 rounded-full bg-[#0C3572] items-center justify-center mr-4">
                      <Ionicons name={item.icon as any} size={20} color="white" />
                    </View>
                    <Text style={{ fontFamily: "Outfit_500Medium" }} className="text-[#0C3572] text-lg">
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {step === 2 && currentStep2Data && (
              <View>
                <Text style={{ fontFamily: "Outfit_600SemiBold" }} className="text-[#0C3572] text-xl mb-2 text-center px-4">
                  {currentStep2Data.title}
                </Text>
                <Text style={{ fontFamily: "Outfit_500Medium" }} className="text-[#2175C0] text-center mb-6">
                  Issue: {issueType}
                </Text>

                {currentStep2Data.options.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    className="bg-[#FFFFFF] border-[1px] border-[#0C3572] p-4 rounded-2xl mb-4"
                    onPress={handleSelectUrgency}
                  >
                    <Text style={{ fontFamily: "Outfit_600SemiBold" }} className="text-[#0C3572] text-lg">
                      {item.label}
                    </Text>
                    <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#2175C0] mt-1">
                      {item.desc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {step === 3 && (
              <View className="bg-[#FFFFFF] p-6 rounded-3xl mt-4 items-center ">
                <View className="w-20 h-20 bg-green-500 rounded-full items-center justify-center mb-6">
                  <Ionicons name="checkmark" size={40} color="white" />
                </View>
                
                <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#0C3572] text-2xl text-center mb-4">
                  Information Received
                </Text>
                
                <Text style={{ fontFamily: "Outfit_500Medium" }} className="text-[#2175C0] text-center text-base mb-8 leading-6">
                  Based on your responses, we've identified the best person to help you resolve this issue quickly. Please contact our support representative for further discussion.
                </Text>

                <View className="bg-white w-full rounded-2xl p-5 mb-6 border border-[#A0B3D0]">
                  <Text style={{ fontFamily: "Outfit_600SemiBold" }} className="text-[#0C3572] text-sm mb-1 text-center">
                    Support Contact
                  </Text>
                  <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#00CC9C] text-2xl text-center">
                    +91 99999 99999
                  </Text>
                </View>

                <TouchableOpacity
                  className="bg-[#0C3572] w-full py-4 rounded-xl flex-row justify-center items-center mb-3"
                  onPress={handleContactSupport}
                >
                  <Ionicons name="call" size={20} color="white" className="mr-2" />
                  <Text style={{ fontFamily: "Outfit_600SemiBold" }} className="text-white text-lg ml-2">
                    Call Now
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="py-4"
                  onPress={() => router.back()}
                >
                  <Text style={{ fontFamily: "Outfit_600SemiBold" }} className="text-[#0C3572] text-base">
                    Return to Profile
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
