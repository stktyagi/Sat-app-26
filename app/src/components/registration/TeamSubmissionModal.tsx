// src/components/registration/TeamSubmissionModal.tsx

import React, { useState } from 'react';
import { Modal,TextInput,Alert,Platform, View, Text, TouchableOpacity, ScrollView, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseEvent, TeamRegistrationData } from '@/types/models';
import { showAlert } from '..';
import CustomFieldsForm from './CustomFieldRenderer'
import { useUserStore } from '@/state/userStore';
import { confirmTeam } from '@/api/events';
import { isPerIndividualPayment } from '@/utils/paymentHelpers';

interface TeamSubmissionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
  event: FirebaseEvent | null;
  teamData: TeamRegistrationData | null;
}
const showModalAlert = (title?: string, message?: string) => {
  if (Platform.OS === "ios") {
    // Use native Alert for iOS
    Alert.alert(title || "", message || "");
  } else {
    // Use custom alert for Android
    showAlert(title, message);
  }
};
const TeamSubmissionModal: React.FC<TeamSubmissionModalProps> = ({
  visible,
  onClose,
  onSubmitSuccess,
  event,
  teamData,
}) => {
  const [isLoading, setIsLoading] = useState(false);
   // --- ADD STATE FOR REFERRAL CODE ---
  const [hasReferralCode, setHasReferralCode] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  
  // Get user data to check if they are a host college student
  const userData = useUserStore((state) => state.userData);
  const isHostStudent = !!(
    userData?.isHostCollegeStudent ||
    userData?.collegeName?.toLowerCase().includes("thapar") ||
    userData?.email?.toLowerCase().endsWith("@thapar.edu")
  );
  const isNonHostStudent = !isHostStudent;

  if (!event || !teamData) return null;

  const handleFinalSubmit = async (formData: Record<string, any>) => {
    let fee = 0;
    const isPerInd = isPerIndividualPayment(event.paymentType);
    if (event.paymentRequired) {
      if (
        event.eventType === 'team' &&
        isPerInd &&
        teamData.members?.length
      ) {
        const totalRosterFee = teamData.members.reduce((acc: number, m: any) => {
          return acc + (m.isHostCollegeStudent ? (event.registrationFee?.host || 0) : (event.registrationFee?.other || 0));
        }, 0);
        fee = Math.max(0, totalRosterFee - (teamData.paidTill || 0));
      } else if (event.eventType === 'team') {
        const flatFee = isHostStudent ? (event.registrationFee?.host || 0) : (event.registrationFee?.other || 0);
        fee = Math.max(0, flatFee - (teamData.paidTill || 0));
      } else {
        fee = isHostStudent ? (event.registrationFee?.host || 0) : (event.registrationFee?.other || 0);
      }
    }
    const requiresPayment = !!event.paymentRequired && fee > 0;
    const isPaid = !requiresPayment;

    if (requiresPayment && !isPaid) {
      showModalAlert(
        "Payment Required",
        "Payment is pending or due for this event. Please complete the registration payment before finalizing your team registration."
      );
      return;
    }

    try {
      setIsLoading(true);
      await confirmTeam(teamData.teamId);
      showModalAlert(
        'Success',
        'Team registration has been successfully confirmed!'
      );
      onSubmitSuccess();
    } catch (error: any) {
      showModalAlert('Error', error.message || 'Failed to complete team registration');
    } finally {
      setIsLoading(false);
    }
  };

  const renderReferralSection = () => {
    // Only show referral option for non-host college students
    if (!isNonHostStudent) {
      return null;
    }

    return (
      <View className="pt-4 border-t border-[#A0B3D0] mt-4">
        <TouchableOpacity
          onPress={() => {
            setHasReferralCode(!hasReferralCode);
            if (hasReferralCode) setReferralCode('');
          }}
          className="flex-row items-center mb-3"
        >
          <View
            className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
              hasReferralCode
                ? "bg-yellow-400 border-yellow-400"
                : "border-gray-600"
            }`}
          >
            {hasReferralCode && (
              <Ionicons name="checkmark" size={16} color="#1a1a1a" />
            )}
          </View>
          <Text
            style={{ fontFamily: "Outfit_500Medium" }}
            className="text-[#0C3572]"
          >
            I have a referral code
          </Text>
        </TouchableOpacity>

        {hasReferralCode && (
          <View>
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-[#2175C0] mb-2"
            >
              Referral Code
            </Text>
            <TextInput
              style={{ fontFamily: "Outfit_500Medium" }}
              value={referralCode}
              onChangeText={(text) => setReferralCode(text.toUpperCase())}
              placeholder="Enter your referral code"
              placeholderTextColor="#666"
              className="bg-[#2a2a2a] text-[#0C3572] px-4 py-3 rounded-lg"
              autoCapitalize="characters"
            />
          </View>
        )}
      </View>
    );
  };


  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' }}>
            <View className="flex-row justify-between items-center mb-4">
              <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0C3572] text-2xl">
                Complete Team Submission
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={28} color="#0C3572" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
              <Text className="text-[#2175C0] mb-4 text-base">
                Please fill out the following details for your team to complete the submission.
              </Text>
              <CustomFieldsForm
                fields={event.customFields || []}
                isLoading={isLoading}
                submitButtonText="Submit Team for Review"
                onSubmit={handleFinalSubmit}
              >
                  {renderReferralSection()}
              </CustomFieldsForm>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default TeamSubmissionModal;