import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StatusBar,
  Linking,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MapPin, Calendar, Clock, Users, Star, Info } from 'lucide-react-native';
import { FirebaseEvent, EventFeedback } from '@/types/models';
import MarkdownText from '@/components/display/MarkdownText';
import Button from '@/components/ui/Button';
import { useUserStore } from '@/state/userStore';
import { getFormattedDate, getFormattedTime, getRegistrationDeadline } from '@/utils/dateUtils';
import RegistrationModal from '@/components/registration/RegistrationModal';



interface EventDetailsRouteParams {
  eventData: FirebaseEvent;
}

const EventDetailsScreen: React.FC = () => {
  const router = useRouter();
  const { eventData } = useLocalSearchParams();
  const event = typeof eventData === 'string' ? JSON.parse(eventData) : eventData;
  const [activeTab, setActiveTab] = useState<'info' | 'rules' | 'prizes' | 'feedback'>('info');
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  /* Removed API call */

  const [feedbacks, setFeedbacks] = useState<EventFeedback[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const { userData: userProfile } = useUserStore();
  const userId = userProfile?.userId || '';

  useEffect(() => {
    checkExistingRegistration();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      checkExistingRegistration();
      if (activeTab === 'feedback') {
        loadFeedbacks();
      }
    }, [event.eventId, userId, activeTab])
  );

  const loadFeedbacks = async () => {
    setLoadingFeedbacks(true);
    try {
      /* Removed API call */
      setFeedbacks(data);
    } catch (error) {
      console.error('Error loading feedbacks', error);
    } finally {
      setLoadingFeedbacks(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim() || feedbackRating < 1 || feedbackRating > 5) return;
    setSubmittingFeedback(true);
    try {
      /* Removed API call */
      setFeedbacks([newFeedback, ...feedbacks]);
      setFeedbackText('');
      setFeedbackRating(5);
    } catch (error) {
      console.error('Error submitting feedback', error);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const checkExistingRegistration = async () => {
    try {
      /* Removed API call */
      setExistingRegistration(registration);
    } catch (error) {
      console.error('Error checking registration:', error);
    }
  };

  const handleRegisterClick = () => {
    if(event.eventType === 'externalLink' && event.externalUrl) {
      // Open external link
      // (event.externalUrl, '_blank');
      Linking.openURL(event.externalUrl);
      return;
    }
    if (existingRegistration) {
      // Navigate to MyEventDetailsScreen
      router.push({ pathname: '/events/MyEventDetails', params: { eventId: event.eventId } });
      return;
    }

    setShowRegistrationModal(true);
  };

  const handleRegistrationSuccess = async () => {
    // Small delay to ensure backend has processed the registration
    await new Promise(resolve => setTimeout(resolve, 500));
    await checkExistingRegistration();
  };

  const handleModalClose = async () => {
    setShowRegistrationModal(false);
    // Refresh registration status when modal closes
    await checkExistingRegistration();
  };



  return (
    <View className="flex-1 bg-transparent px-4">
      <StatusBar barStyle="light-content" />

      {/* Registration Modal */}
      <RegistrationModal
        visible={showRegistrationModal}
        event={event}
        onClose={handleModalClose}
        onSuccess={handleRegistrationSuccess}
      />

      {/* Header Image */}
      <View className="relative w-[100%] mx-auto mt-6 rounded-xl overflow-hidden">
        <Image
          source={event.coverImage ? { uri: event.coverImage } : require('@/assets/event.jpg')}
          style={{ width: '100%', height: 'auto', aspectRatio: 16 / 9 }}
          resizeMode="cover"
        />

        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute top-4 left-4 w-10 h-10 bg-[#2175C0] rounded-full items-center justify-center"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        {/* Featured Badge */}
        {event.isFeatured && (
          <View className="absolute top-4 right-4 bg-[#FFBA00] px-3 py-2 rounded-xl flex-row items-center">
            <Star size={16} color="white" fill="white" />
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#0C3572] ml-1">Featured</Text>
          </View>
        )}
      </View>

      <View className="flex-1 mt-4 px-4">
        <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0C3572] text-2xl">{event.title}</Text>
        <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-sm text-[#2175C0] mb-4">
          Registration Ends on {getRegistrationDeadline(event.registrationDeadline) || 'TBA'}
        </Text>
        <View className="flex-1 mb-20">
          {/* Tabs */}
          <View className="flex-row justify-around my-4 border-b border-gray-700">
            <TouchableOpacity
              onPress={() => setActiveTab('info')}
              className={`py-2 px-4 ${activeTab === 'info' ? 'border-b-2 border-[#EEB170]' : ''}`}
            >
              <Text style={{ fontFamily: 'Outfit_500Medium' }} className={` ${activeTab === 'info' ? 'text-[#EEB170]' : 'text-[#2175C0]'}`}>
          Event Info
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('rules')}
              className={`py-2 px-4 ${activeTab === 'rules' ? 'border-b-2 border-[#EEB170]' : ''}`}
            >
              <Text style={{ fontFamily: 'Outfit_500Medium' }} className={` ${activeTab === 'rules' ? 'text-[#EEB170]' : 'text-[#2175C0]'}`}>
          Rules
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('prizes')}
              className={`py-2 px-4 ${activeTab === 'prizes' ? 'border-b-2 border-[#EEB170]' : ''}`}
            >
              <Text style={{ fontFamily: 'Outfit_500Medium' }} className={`${activeTab === 'prizes' ? 'text-[#EEB170]' : 'text-[#2175C0]'}`}>
          Prizes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('feedback')}
              className={`py-2 px-4 ${activeTab === 'feedback' ? 'border-b-2 border-[#EEB170]' : ''}`}
            >
              <Text style={{ fontFamily: 'Outfit_500Medium' }} className={`${activeTab === 'feedback' ? 'text-[#EEB170]' : 'text-[#2175C0]'}`}>
          Feedback
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {activeTab === 'info' && (
              <View>
          {event.shortDescription && (
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0] text-base mb-4 leading-6">
              {event.shortDescription}
            </Text>
          )}

          {/* Event Info Grid */}
          <View className="flex-1 flex-col gap-1 mb-6">
            {/* Date & Time */}
            <View className="flex-row items-center">
              <Calendar size={20} color="#EEB170" />
              <View className="ml-3 flex-1">
                {/* <Text className="text-[#0C3572] font-semibold">Date & Time</Text> */}
                <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0]">
                  {getFormattedDate(event.dateTime, event.startDateTime)}
                  {event.endDateTime &&
                    (new Date(event.startDateTime || event.dateTime).toDateString() !== new Date(event.endDateTime).toDateString()) && (
                      <> - {getFormattedDate(event.endDateTime, event.endDateTime)}</>
                    )
                  }
                </Text>

              </View>
            </View>

            <View className="flex-row items-center">
              <Clock size={20} color="#EEB170" />
              <View className="ml-3 flex-1">
                {/* <Text className="text-[#0C3572] font-semibold">Time</Text> */}
                <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0]">
                  {getFormattedTime(event.dateTime, event.startDateTime)} 
                  {event.endDateTime ? ` - ${getFormattedTime(event.endDateTime)}` : ''}
                </Text>
              </View>
            </View>
            

            {/* Venue */}
            <View className="flex-row items-center">
              <MapPin size={20} color="#EEB170" />
              <View className="ml-3 flex-1">
                {/* <Text className="text-[#0C3572] font-semibold">Venue</Text> */}
                <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0]">{event.venueName || 'To be announced'}</Text>
              </View>
            </View>

            {/* Registration Fee */}
            {event.paymentRequired && (
              <View className="flex-row items-center">
                <Ionicons name="card" size={20} color="#EEB170" />
                <View className="ml-3 flex-1">
            {/* <Text className="text-[#0C3572] font-semibold">Registration Fee</Text> */}
            <View className="flex-row gap-4">
              {userProfile?.isHostCollegeStudent ? (
                <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0]">
                  Host College: ₹{event.registrationFee.host}
                </Text>
              ) : (
                <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0]">
                  Other Colleges: ₹{event.registrationFee.other}
                </Text>
              )}
            </View>
                </View>
              </View>
            )}

            {/* Team Size */}
            {event.eventType === 'team' && (
              <View className="flex-row items-center">
                <Users size={20} color="#EEB170" />
                <View className="ml-3 flex-1">
            {/* <Text className="text-[#0C3572] font-semibold">Team Size</Text> */}
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0]">
              {(event.minTeamSize != null && event.maxTeamSize != null)
                ? (event.minTeamSize === event.maxTeamSize
                    ? `${event.minTeamSize} members`
                    : `${event.minTeamSize} - ${event.maxTeamSize} members`)
                : event.maxTeamSize != null
                  ? `Up to ${event.maxTeamSize} members`
                  : event.minTeamSize != null
                    ? `Minimum ${event.minTeamSize} members`
                    : 'Team event'}
            </Text>
                </View>
              </View>
            )}
          </View>

          {/* Description */}
          {event.description && (
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <Info size={20} color="#EEB170" />
                <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] ml-2 text-lg">About Event</Text>
              </View>
              <MarkdownText lightMode={false} style={{ fontSize: 14, lineHeight: 22,fontFamily: 'Outfit_500Medium' }}>
                {event.description}
              </MarkdownText>
            </View>
          )}

          {/* Coordinators */}
          {event.coordinators && event.coordinators.length > 0 && (
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <Ionicons name="people" size={20} color="#EEB170" />
                <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] ml-2 text-lg">Event Coordinators</Text>
              </View>
              {event.coordinators.map((coordinator, index) => (
                <View key={index} className="mb-3 last:mb-0">
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#0C3572] ">{coordinator.name}</Text>
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0]">{coordinator.email}</Text>
            {coordinator.phone && (
              <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0]">{coordinator.phone}</Text>
            )}
                </View>
              ))}
            </View>
          )}
              </View>
            )}

            {activeTab === 'rules' && (
              <View>
          {event.rules ? (
            <MarkdownText  lightMode={false} style={{ fontSize: 14, lineHeight: 22,fontFamily: 'Outfit_500Medium' }}>
              {event.rules}
            </MarkdownText>
          ) : (
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0] text-center mt-8">No rules specified for this event.</Text>
          )}
              </View>
            )}

            {activeTab === 'prizes' && (
              <View>
          {event.prizes ? (
            <MarkdownText lightMode={false} style={{ fontSize: 14, lineHeight: 22,fontFamily: 'Outfit_500Medium' }}>
              {event.prizes}
            </MarkdownText>
          ) : (
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0] text-center mt-8">Prize details are not available.</Text>
          )}
              </View>
            )}

            {activeTab === 'feedback' && (
              <View className="mb-8">
                {!existingRegistration ? (
                  <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0] text-center mt-8">
                    You must be registered for this event to view and submit feedback.
                  </Text>
                ) : (
                  <View>
                    {/* Add Feedback Form */}
                    <View className="bg-white p-4 rounded-xl mb-6 shadow-sm">
                      <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-lg mb-2">Leave a Review</Text>
                      <View className="flex-row mb-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <TouchableOpacity key={star} onPress={() => setFeedbackRating(star)}>
                            <Ionicons
                              name={star <= feedbackRating ? "star" : "star-outline"}
                              size={28}
                              color="#FFBA00"
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput
                        className="bg-transparent p-3 rounded-xl mb-3 text-[#0C3572]"
                        style={{ fontFamily: 'Outfit_500Medium', minHeight: 80 }}
                        placeholder="Write your feedback..."
                        placeholderTextColor="#A0B3D0"
                        multiline
                        textAlignVertical="top"
                        value={feedbackText}
                        onChangeText={setFeedbackText}
                      />
                      <TouchableOpacity
                        className="bg-[#0C3572] py-3 rounded-xl items-center flex-row justify-center"
                        onPress={handleSubmitFeedback}
                        disabled={submittingFeedback}
                      >
                        {submittingFeedback ? (
                          <ActivityIndicator color="white" size="small" />
                        ) : (
                          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-white text-base">Submit Feedback</Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Feedback List */}
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-lg mb-4">Reviews</Text>
                    {loadingFeedbacks ? (
                      <ActivityIndicator size="large" color="#EEB170" className="mt-4" />
                    ) : feedbacks.length === 0 ? (
                      <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0] text-center mt-2">
                        No reviews yet. Be the first to share your thoughts!
                      </Text>
                    ) : (
                      feedbacks.map((fb) => (
                        <View key={fb.id} className="bg-white p-4 rounded-xl mb-3 shadow-sm border border-gray-100">
                          <View className="flex-row items-center justify-between mb-2">
                            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-base">{fb.userName}</Text>
                            <View className="flex-row">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Ionicons
                                  key={star}
                                  name={star <= fb.rating ? "star" : "star-outline"}
                                  size={14}
                                  color="#FFBA00"
                                />
                              ))}
                            </View>
                          </View>
                          <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-[#2175C0] text-sm leading-5">
                            {fb.comment}
                          </Text>
                          <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-[#2175C0] text-xs mt-2">
                            {new Date(fb.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            )}
            <View className="h-4" />
          </ScrollView>
        </View>
      </View>

      {/* Register Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-[#FFF] border-t border-gray-800 px-6 py-4">
        <Button
          title={
            existingRegistration
              ? 'View Registration'
              : event.paymentRequired
                ? 'Register Now'
                : 'Register for Free'
          }
          onPress={handleRegisterClick}
          variant="none" 
          size="large"

          className="bg-[#95aad3] border-[#0C3572] border-2 py-4 rounded-xl"
          textClassName="text-[#0C3572]"
        />
      </View>
    </View>
  );
};

export default EventDetailsScreen;