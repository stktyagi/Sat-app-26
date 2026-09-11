import React from 'react';
import { View, Text } from 'react-native';

interface TeamStatusMessageProps {
  status: 'pending' | 'awaited' | 'payment_pending' | 'confirmed' | 'rejected';
}

const TeamStatusMessage: React.FC<TeamStatusMessageProps> = ({ status }) => {
  if (status === 'awaited') {
    return (
      <View className="mt-2 bg-blue-100 border border-blue-300 rounded-lg p-3">
        <Text className="text-blue-800 text-sm mb-1 font-semibold">
          Your team has been submitted and is awaiting admin approval.
        </Text>
        <Text className="text-blue-600 text-xs">
          Team is locked - No changes can be made while under review.
        </Text>
      </View>
    );
  }

  if (status === 'payment_pending') {
    return (
      <View className="mt-2 bg-orange-100 border border-orange-300 rounded-lg p-3">
        <Text className="text-orange-800 text-sm mb-1 font-semibold">
          💳 Payment is required to complete your registration.
        </Text>
        <Text className="text-orange-600 text-xs">
          Your team will be confirmed once payment is completed.
        </Text>
      </View>
    );
  }

  if (status === 'confirmed') {
    return (
      <View className="mt-2 bg-green-100 border border-green-300 rounded-lg p-3">
        <Text className="text-green-800 text-sm mb-1 font-semibold">
          ✓ Your team registration has been confirmed!
        </Text>
        <Text className="text-green-600 text-xs">
          All set! See you at the event.
        </Text>
      </View>
    );
  }

  if (status === 'rejected') {
    return (
      <View className="mt-2 bg-red-100 border border-red-300 rounded-lg p-3">
        <Text className="text-red-800 text-sm mb-1 font-semibold">
          ✕ Your team registration has been rejected.
        </Text>
        <Text className="text-red-600 text-xs">
          Please contact the event organizers for more information.
        </Text>
      </View>
    );
  }

  return null;
};

export default TeamStatusMessage;
