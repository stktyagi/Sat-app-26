// src/screens/Admin/SendNotification.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { showAlert } from '@/components';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Bell, Send, TestTube } from 'lucide-react-native';
import { getToken } from '@/api/auth';

const SendNotification = () => {
  const navigation = useNavigation();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [topic, setTopic] = useState('all');
  const [sending, setSending] = useState(false);


  // Your actual FCM notification API endpoint
  const NOTIFICATION_API = 'https://api.saturnalia.in/api/users/sendNotification'; // Replace with your actual backend URL

  const handleSendNotification = async () => {
    if (!title.trim() || !body.trim()) {
      showAlert('Error', 'Please enter both title and message');
      return;
    }
   const token = await getToken();
 
    showAlert(
      'Send Notification',
      `Send notification to ${topic === 'all' ? 'all users' : `topic: ${topic}`}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              setSending(true);

              // Prepare notification data according to your API structure
              const notificationData = {
                type: topic, // 'all', 'events', 'announcements', 'accommodation'
                title: title.trim(),
                body: body.trim(),
                password: 'd859063d2f6cd19a5ce293906e36169a6421c5af9f2971983288b2168d7ae888',
              };

              // Send to your FCM API endpoint
              const response = await fetch(NOTIFICATION_API, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                   Authorization: `Bearer ${token}`,  
                },
                body: JSON.stringify(notificationData),
              });

              const responseData = await response.json();
              console.log('Notification API response:', responseData);

              if (response.ok && responseData.success) {
                showAlert('Success', responseData.message || 'Notification sent successfully!');
                // Clear form
                setTitle('');
                setBody('');
                setTopic('all');

              } else {
                throw new Error(responseData.message || 'Failed to send notification');
              }
            } catch (error: any) {
              console.error('Error sending notification:', error.message);
              showAlert('Error', error.message || 'Failed to send notification. Please try again.');
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  const handleTestNotification = async () => {
    if (!title.trim() || !body.trim()) {
      showAlert('Error', 'Please enter both title and message to test');
      return;
    }

    try {
      // await showLocalNotification(title.trim(), body.trim());
      showAlert('Test Sent', 'Check your notification tray!');
    } catch (error) {
      console.error('Error showing test notification:', error);
      showAlert('Error', 'Failed to show test notification');
    }
  };

  const topicOptions = [
    { value: 'all', label: 'All Users', description: 'Send to all app users' },
    { value: 'customers', label: 'Host', description: 'Send to hosts only' },
    { value: 'salons', label: 'Outside', description: 'Send to outside users' },
  ];

  return (
    <View className="flex-1 bg-transparent">
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View className="bg-[#EEB170]  pt-4 rounded-b-2xl pb-6 px-6 border-b border-[#A0B3D0]">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-black text-2xl">
              Send Notification
            </Text>
            <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-black text-sm mt-1">
              Push notifications to users
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-6 py-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Info Card */}
        <View className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
          <View className="flex-row items-start">
            <Ionicons name="information-circle" size={20} color="#60A5FA" />
            <View className="flex-1 ml-3">
              <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-blue-400 text-sm mb-1">
                Admin Access Required
              </Text>
              <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-blue-300 text-xs leading-5">
                Enter admin password to send push notifications via Firebase Cloud Messaging.
              </Text>
            </View>
          </View>
        </View>

        {/* Admin Password */}
        

        {/* Notification Title */}
        <View className="mb-6">
          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-base mb-3">
            Notification Title
          </Text>
          <TextInput
            className="bg-[#FFFFFF66] rounded-xl px-4 py-4 text-[#0C3572] border border-gray-700"
            style={{ fontFamily: 'Outfit_500Medium' }}
            placeholder="Enter notification title..."
            placeholderTextColor="#6B7280"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-gray-500 text-xs mt-2">
            {title.length}/100 characters
          </Text>
        </View>

        {/* Notification Body */}
        <View className="mb-6">
          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-base mb-3">
            Message
          </Text>
          <TextInput
            className="bg-[#FFFFFF66] rounded-xl px-4 py-4 text-[#0C3572] border border-gray-700"
            style={{ fontFamily: 'Outfit_500Medium', minHeight: 120 }}
            placeholder="Enter notification message..."
            placeholderTextColor="#6B7280"
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={300}
          />
          <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-gray-500 text-xs mt-2">
            {body.length}/300 characters
          </Text>
        </View>

        {/* Topic Selection */}
        <View className="mb-6">
          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-base mb-3">
            Send To
          </Text>
          {topicOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              className={`flex-row items-center justify-between p-4 rounded-xl mb-2 ${
                topic === option.value
                  ? 'bg-[#EEB170]/20 border border-[#EEB170]'
                  : 'bg-[#FFFFFF66] border border-gray-700'
              }`}
              onPress={() => setTopic(option.value)}
            >
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name={topic === option.value ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={topic === option.value ? '#EEB170' : '#6B7280'}
                />
                <View className="ml-3 flex-1">
                  <Text
                    style={{ fontFamily: 'Outfit_500Medium' }}
                    className={`${topic === option.value ? 'text-[#EEB170]' : 'text-[#0C3572]'}`}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={{ fontFamily: 'Outfit_400Regular' }}
                    className="text-[#2175C0] text-xs mt-1"
                  >
                    {option.description}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Preview Card */}
        {(title.trim() || body.trim()) && (
          <View className="mb-6">
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-base mb-3">
              Preview
            </Text>
            <View className="bg-[#FFFFFF66] rounded-xl p-4 border border-gray-700">
              <View className="flex-row items-start">
                <View className="w-10 h-10 rounded-full bg-[#EEB170]/20 items-center justify-center mr-3">
                  <Bell size={20} color="#EEB170" />
                </View>
                <View className="flex-1">
                  <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-base mb-1">
                    {title || 'Notification Title'}
                  </Text>
                  <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-[#2175C0] text-sm">
                    {body || 'Notification message will appear here...'}
                  </Text>
                  <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-gray-500 text-xs mt-2">
                    Just now
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View className="flex-col gap-3">
          {/* Test Notification Button */}
          <TouchableOpacity
            className={`bg-blue-500/20 border border-blue-500 rounded-xl py-4 px-6 flex-row items-center justify-center ${
              !title.trim() || !body.trim() ? 'opacity-50' : ''
            }`}
            onPress={handleTestNotification}
            disabled={!title.trim() || !body.trim()}
          >
            <TestTube size={20} color="#60A5FA" />
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-blue-400 ml-2 text-base">
              Test Notification
            </Text>
          </TouchableOpacity>

          {/* Send Notification Button */}
          <TouchableOpacity
            className={`bg-[#EEB170] rounded-xl py-4 px-6 flex-row items-center justify-center ${
              sending || !title.trim() || !body.trim() ? 'opacity-50' : ''
            }`}
            onPress={handleSendNotification}
            disabled={sending || !title.trim() || !body.trim() }
          >
            {sending ? (
              <ActivityIndicator size="small" color="#121212" />
            ) : (
              <>
                <Send size={20} color="#121212" />
                <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-black ml-2 text-base">
                  Send Notification
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* API Endpoint Info */}
        <View className="mt-6 bg-[#FFFFFF66] rounded-xl p-4 border border-gray-700">
          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-sm mb-2">
            FCM Endpoint
          </Text>
          <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-[#2175C0] text-xs">
            {NOTIFICATION_API}
          </Text>
          <View className="mt-3 pt-3 border-t border-gray-700">
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0] text-xs mb-2">
              Topic Mappings:
            </Text>
            <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-[#2175C0] text-xs">
              • all → /topics/all_users
            </Text>
            <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-[#2175C0] text-xs">
              • customers → /topics/host
            </Text>
            <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-[#2175C0] text-xs">
              • salons → /topics/outside
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default SendNotification;
