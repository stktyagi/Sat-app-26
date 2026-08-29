import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseEvent } from '@/types/models';

interface CalendarProps {
  events: FirebaseEvent[];
  loading: boolean;
  error: string | null;
  navigation: any;
}

// Arrow Icon Component for header navigation
const ArrowIcon = ({ direction, color }: { direction: 'left' | 'right'; color: string }) => (
  <Text className={`text-2xl ${color}`} style={{ transform: [{ scaleX: direction === 'right' ? 1.2 : -1.2 }] }}>›</Text>
);


const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const FESTIVAL_DATES = [
  new Date(2026, 10, 21), // Nov 21, 2026
  new Date(2026, 10, 22), // Nov 22, 2026
  new Date(2026, 10, 23), // Nov 23, 2026
];

const CalendarScreen = ({ events, loading, error, navigation }: CalendarProps) => {
  const [dayIndex, setDayIndex] = useState(0);
  const selectedDate = FESTIVAL_DATES[dayIndex];

  const handlePrevDay = () => {
    if (dayIndex > 0) setDayIndex(dayIndex - 1);
  };

  const handleNextDay = () => {
    if (dayIndex < FESTIVAL_DATES.length - 1) setDayIndex(dayIndex + 1);
  };
  
  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  // Convert Firebase events to display format and sort by date
  const processedEvents = events.map(event => {
    const eventDate = new Date(event.startDateTime || event.dateTime);
    const startTime = eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = event.endDateTime ? new Date(event.endDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

    return {
      ...event,
      date: eventDate,
      time: endTime ? `${startTime} - ${endTime}` : startTime
    };
  }).sort((a, b) => a.date.getTime() - b.date.getTime());

  // Filter events based on selected date
  const eventsToDisplay = processedEvents.filter(event => isSameDay(event.date, selectedDate));

  // To display event list items correctly
  let lastDisplayedDate: string | null = null;
  let lastDisplayedTime: string | null = null;

  if (loading) {
    return (
      <View className="flex-1 bg-transparent justify-center items-center">
        <ActivityIndicator size="large" color="#9AC5F0" />
        <Text  style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#3C3C3C] mt-4">Loading events...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-transparent justify-center items-center px-4">
        <Text  style={{ fontFamily: 'Outfit_500Medium' }} className="text-red-400 text-center mb-4">Error loading events</Text>
        <Text  style={{ fontFamily: 'Outfit_500Medium' }} className="text-gray-400 text-center">{error}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-transparent pt-10">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Calendar View */}
      <View className="bg-[#9AC5F0] rounded-3xl mx-4 p-4 py-5 shadow-sm">
        {/* Header */}
        <View className="flex-row justify-between items-center">
          <TouchableOpacity 
            onPress={handlePrevDay} 
            className={`w-10 h-10 rounded-full bg-[#2C2C2E] justify-center items-center ${dayIndex === 0 ? 'opacity-50' : 'opacity-100'}`}
            disabled={dayIndex === 0}
          >
            <ArrowIcon direction="left" color="text-white" />
          </TouchableOpacity>
          <View className="items-center">
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#3C3C3C] text-sm opacity-80 mb-1">
              Day {dayIndex}
            </Text>
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#3C3C3C] text-2xl">
              {months[selectedDate.getMonth()]} {selectedDate.getDate()}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={handleNextDay} 
            className={`w-10 h-10 rounded-full bg-[#2C2C2E] justify-center items-center ${dayIndex === FESTIVAL_DATES.length - 1 ? 'opacity-50' : 'opacity-100'}`}
            disabled={dayIndex === FESTIVAL_DATES.length - 1}
          >
            <ArrowIcon direction="right" color="text-white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Events List */}
      <View className="mt-6 px-4 flex-1">
        <Text  style={{ fontFamily: 'Outfit_500Medium' }} className="text-gray-500 text-lg mb-4 ml-2">
          {selectedDate
            ? `Events for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : eventsToDisplay.length > 0 ? 'All Upcoming Events' : 'No events found'
          }
        </Text>
          <View>
          {eventsToDisplay.map((event, index) => {
             const eventDateStr = event.date.toDateString();
             const showDate = eventDateStr !== lastDisplayedDate;
             if (showDate) {
               lastDisplayedDate = eventDateStr;
               lastDisplayedTime = null; // reset time for new date
             }

             const eventTime = new Date(event.startDateTime || event.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
             const showTime = eventTime !== lastDisplayedTime;
             lastDisplayedTime = eventTime;

             return (
               <View key={event.eventId}>
                 {showDate && !selectedDate && (
                   <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#3C3C3C] text-lg ml-2 my-2">{eventDateStr}</Text>
                 )}
                 <View className="flex-row mb-3 relative">
                   {/* Time Column */}
                   <View className="w-[65px] items-end pt-3 pr-2">
                     {showTime && (
                       <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#3C3C3C] text-xs">
                         {eventTime}
                       </Text>
                     )}
                   </View>

                   {/* Timeline Column */}
                   <View className="items-center relative w-6 mr-3">
                     {/* Dashed Line */}
                     {index !== eventsToDisplay.length - 1 && (
                       <View 
                         className="absolute top-4 bottom-[-16px] w-[2px]" 
                         style={{
                           borderStyle: 'dashed',
                           borderLeftWidth: 1.5,
                           borderColor: '#888',
                         }} 
                       />
                     )}
                     {/* Dot */}
                     {showTime && (
                       <View className="w-[18px] h-[18px] rounded-full bg-transparent border-[2px] border-gray-500 items-center justify-center mt-3.5 z-10">
                         <View className="w-[8px] h-[8px] rounded-full bg-gray-700" />
                       </View>
                     )}
                   </View>

                   {/* Event Card */}
                   <TouchableOpacity
                     className="flex-1 bg-[#9AC5F0] border-[1px] border-[#0C3572] rounded-xl p-3 pb-3"
                     onPress={() => {
                       navigation.navigate('EventDetails', { eventData: event });
                     }}
                   >
                     <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-white text-lg">{event.title}</Text>
                     <View className="flex-row items-center mt-0.5">
                       <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#3C3C3C] text-sm">
                         <Ionicons name="location" size={14} color="#3C3C3C" /> {event.venueName || 'TBA'}
                       </Text>
                     </View>
                     <View className="absolute right-4 top-1/2 -mt-2.5">
                       <Ionicons name="arrow-forward" size={20} color="#3C3C3C" />
                     </View>
                   </TouchableOpacity>
                 </View>
               </View>
             );
          })}
          </View>
      </View>
        </ScrollView>
    </View>
  );
};

export default CalendarScreen;