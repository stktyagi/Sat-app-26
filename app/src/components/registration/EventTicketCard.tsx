import React from 'react';
import { View, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Calendar, Clock, MapPin, User, Ticket, QrCode } from 'lucide-react-native';
import { FirebaseEvent } from '@/types/models';
import { useUserStore } from '@/state/userStore';
import { useThemeStore } from '@/state/themeStore';

interface EventTicketCardProps {
  registration: any;
  eventData: FirebaseEvent | null;
}

const EventTicketCard: React.FC<EventTicketCardProps> = ({ registration, eventData }) => {
  const { userData } = useUserStore();
  const { isDark } = useThemeStore();

  const cardBg = isDark ? '#1A1A20' : '#FFFFFF';
  const cardBorder = isDark ? '#2B2B34' : '#E2E8F0';
  const textPrimary = isDark ? '#FFFFFF' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const labelColor = isDark ? '#71717A' : '#94A3B8';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  // QR Code data: token or fallback
  const qrData = registration.qrToken || `${registration.eventId}_${registration.userId}`;

  // Format date and time
  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const dateFormatted = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeFormatted = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return { date: dateFormatted, time: timeFormatted };
    } catch {
      return { date: 'TBD', time: 'TBD' };
    }
  };

  const rawDateTime = eventData?.dateTime || eventData?.startDateTime;
  const { date, time } = rawDateTime ? formatDateTime(rawDateTime) : { date: 'TBD', time: 'TBD' };

  // Pass Number
  const eventIdPart = (registration.eventId || '').slice(0, 6).toUpperCase() || 'EVT';
  const userIdPart = (registration.userId || '').slice(0, 4).toUpperCase() || 'USR';
  const registrationNumber = `${eventIdPart}-${userIdPart}`;
  const attendeeName = registration.user?.name || userData?.displayName || 'Participant';

  // Team constraint text
  const getTeamBadge = () => {
    if (eventData?.eventType === 'individual') {
      return 'Individual';
    }
    const min = eventData?.minTeamSize;
    const max = eventData?.maxTeamSize;
    if (min && max) {
      return min === max ? `Team (${min})` : `Team (${min}-${max})`;
    }
    if (min) return `Team (${min}+)`;
    if (max) return `Team (max ${max})`;
    return 'Team';
  };

  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderColor: cardBorder,
        borderWidth: 1,
        borderRadius: 20,
        marginBottom: 16,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.05,
        shadowRadius: 8,
        elevation: 2,
        overflow: 'hidden',
      }}
    >
      {/* Top Header */}
      <View style={{ padding: 18, paddingBottom: 14 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            {eventData?.category && (
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(65, 184, 240, 0.12)' : 'rgba(65, 184, 240, 0.1)',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Poppins_600SemiBold',
                    fontSize: 10,
                    color: '#41B8F0',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {eventData.category}
                </Text>
              </View>
            )}

            <View
              style={{
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Poppins_500Medium',
                  fontSize: 10,
                  color: textSecondary,
                  letterSpacing: 0.3,
                }}
              >
                {getTeamBadge()}
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              fontSize: 11,
              color: '#FFBA00',
              letterSpacing: 0.5,
            }}
          >
            ENTRY PASS
          </Text>
        </View>

        {/* Event Title */}
        <Text
          style={{
            fontFamily: 'Talina',
            fontSize: 20,
            color: textPrimary,
            letterSpacing: 0.4,
            marginBottom: 14,
          }}
          numberOfLines={2}
        >
          {eventData?.title || registration.eventName || 'Festival Event'}
        </Text>

        {/* Participant & Pass Number */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <User size={11} color={labelColor} style={{ marginRight: 4 }} />
              <Text
                style={{
                  fontFamily: 'Poppins_500Medium',
                  fontSize: 10,
                  color: labelColor,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Participant
              </Text>
            </View>
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize: 14,
                color: textPrimary,
              }}
              numberOfLines={1}
            >
              {attendeeName}
            </Text>
          </View>

          <View style={{ flex: 1, marginLeft: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <Ticket size={11} color={labelColor} style={{ marginRight: 4 }} />
              <Text
                style={{
                  fontFamily: 'Poppins_500Medium',
                  fontSize: 10,
                  color: labelColor,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Pass Code
              </Text>
            </View>
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize: 14,
                color: '#41B8F0',
                letterSpacing: 0.5,
              }}
              numberOfLines={1}
            >
              {registrationNumber}
            </Text>
          </View>
        </View>

        {/* Date & Time */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <Calendar size={11} color={labelColor} style={{ marginRight: 4 }} />
              <Text
                style={{
                  fontFamily: 'Poppins_500Medium',
                  fontSize: 10,
                  color: labelColor,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Date
              </Text>
            </View>
            <Text
              style={{
                fontFamily: 'Poppins_500Medium',
                fontSize: 13,
                color: textPrimary,
              }}
              numberOfLines={1}
            >
              {date}
            </Text>
          </View>

          <View style={{ flex: 1, marginLeft: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <Clock size={11} color={labelColor} style={{ marginRight: 4 }} />
              <Text
                style={{
                  fontFamily: 'Poppins_500Medium',
                  fontSize: 10,
                  color: labelColor,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Time
              </Text>
            </View>
            <Text
              style={{
                fontFamily: 'Poppins_500Medium',
                fontSize: 13,
                color: textPrimary,
              }}
              numberOfLines={1}
            >
              {time}
            </Text>
          </View>
        </View>

        {/* Venue */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <MapPin size={11} color={labelColor} style={{ marginRight: 4 }} />
            <Text
              style={{
                fontFamily: 'Poppins_500Medium',
                fontSize: 10,
                color: labelColor,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Venue
            </Text>
          </View>
          <Text
            style={{
              fontFamily: 'Poppins_500Medium',
              fontSize: 13,
              color: textPrimary,
            }}
            numberOfLines={1}
          >
            {eventData?.venueName || 'Venue to be announced'}
          </Text>
        </View>
      </View>

      {/* Clean Perforated Line - Inside card boundaries */}
      <View
        style={{
          borderTopWidth: 1,
          borderStyle: 'dashed',
          borderColor: dividerColor,
          marginHorizontal: 16,
        }}
      />

      {/* QR Code Section */}
      <View
        style={{
          alignItems: 'center',
          paddingVertical: 18,
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            padding: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: isDark ? '#33333E' : '#E2E8F0',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <QRCode
            value={qrData}
            size={160}
            color="#0F172A"
            backgroundColor="#FFFFFF"
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 12,
          }}
        >
          <QrCode size={13} color={textSecondary} style={{ marginRight: 6 }} />
          <Text
            style={{
              fontFamily: 'Poppins_400Regular',
              fontSize: 11,
              color: textSecondary,
            }}
          >
            Present this QR code at the entrance
          </Text>
        </View>
      </View>
    </View>
  );
};

export default EventTicketCard;
