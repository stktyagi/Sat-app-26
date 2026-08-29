import React from 'react';
import { View, Text,Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { FirebaseEvent } from '@/types/models';
import DashedHr from '../ui/DashedLine';
import { useUserStore } from '@/state/userStore';

interface EventTicketCardProps {
  registration: UserEventRegistration;
  eventData: FirebaseEvent | null;
}

const EventTicketCard: React.FC<EventTicketCardProps> = ({ registration, eventData }) => {
  const { userData } = useUserStore();
  // Generate QR code data: eventId_userId
  const qrData = `${registration.eventId}_${registration.userId}`;

  // Format date and time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateFormatted = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' });
    const timeFormatted = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return { date: dateFormatted, time: timeFormatted };
  };


  

  const { date, time } = eventData?.startDateTime ? formatDateTime(eventData.startDateTime) : { date: 'TBD', time: 'TBD' };
  // Generate a registration number (you can customize this logic)
  const eventIdPart = (registration.eventId || '').slice(0, 6).toUpperCase() || 'EVENT';
  const userIdPart = (registration.userId || '').slice(0, 4).toUpperCase() || 'USER';
  const registrationNumber = `${eventIdPart}${userIdPart}`;

  return (
    <View className="mb-6 bg-[#9FA5B6] rounded-3xl border-2 border-[#8A90A1]">
      {/* Ticket Header */}
      <View className="px-6 py-6">
        <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-white text-center text-3xl mb-6">
          {eventData?.title || registration.eventName}
        </Text>

        <View className="flex-row justify-between mb-4">
          <View className="flex-1">
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-sm mb-1">
              Name
            </Text>
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-white text-lg">
              {registration.user?.name || userData?.displayName || 'Participant'}
            </Text>
          </View>
          <View className="flex-1">
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-sm mb-1 text-left ml-4">
              Registration No.
            </Text>
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-white text-lg text-left ml-4">
              {registrationNumber}
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between mb-4">
          <View className="flex-1">
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-sm mb-1">
              Date of Event
            </Text>
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-white text-lg">
              {date}
            </Text>
          </View>
          <View className="flex-1">
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-sm mb-1 text-left ml-4">
              Time
            </Text>
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-white text-lg text-left ml-4">
              {time}
            </Text>
          </View>
        </View>

        <View>
          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-sm mb-1">
            Venue
          </Text>
          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-white text-lg">
            {eventData?.venueName || 'To be announced'}
          </Text>
        </View>
      </View>

      {/* Dotted Separator */}
      <View className="flex-row items-center relative h-10 w-full z-20">
        {/* Left Cutout */}
        <View className="absolute -left-6 w-12 h-12 bg-transparent rounded-full z-20" />
        
        {/* Dashed Line */}
        <View className="flex-1 mx-4">
          <View className="border-t-[3px] border-dashed border-[#0C3572]" />
          {Platform.OS === "ios" ? <DashedHr className={'absolute w-full top-0'} color="#0C3572" height={3} dash={[4,4]}  /> : null}
        </View>

        {/* Right Cutout */}
        <View className="absolute -right-6 w-12 h-12 bg-transparent rounded-full z-20" />
      </View>

      {/* QR Code Section */}
      <View className="px-6 pt-4 pb-10 items-center">
        <View className="bg-white p-3 rounded-lg w-[220px] h-[220px] items-center justify-center">
          <QRCode
            value={qrData}
            size={195}
            color="black"
            backgroundColor="white"
          />
        </View>
      </View>
    </View>
  );
};

export default EventTicketCard;
