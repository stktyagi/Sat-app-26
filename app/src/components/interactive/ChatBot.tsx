import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import MarkdownText from '../display/MarkdownText';
import Header from '../layout/Header';

interface Message {
  text: string;
  sender: 'user' | 'bot' | 'system';
  timestamp: Date;
  loading?: boolean;
}

interface ChatBotProps {
  visible: boolean;
  onClose: () => void;
  chatbotApiUrl?: string;
}

const exampleQuestions = [
  "🤔 What is Saturnalia?",
  "📍 What is the location of Saturnalia?",
  "📢 How can I stay updated with announcements?",
];

const ChatBot: React.FC<ChatBotProps> = ({ visible, onClose, chatbotApiUrl }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      text: 'Messages in this chat are not stored anywhere.\nAs soon as you leave this page all the data will be erased.',
      sender: 'system',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  // Check if the bot is currently "typing"
  const isBotTyping = messages[messages.length - 1]?.loading === true;

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, visible]);

  const sendPredefinedMessage = async (messageText: string) => {
    if (isBotTyping) return;

    const userMessage: Message = {
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };

    const loaderMessage: Message = {
      text: '', // No text needed for loader
      sender: 'bot',
      timestamp: new Date(),
      loading: true,
    };

    setMessages(prev => [...prev, userMessage, loaderMessage]);

    try {
      if (chatbotApiUrl) {
        const response = await fetch(chatbotApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: messageText,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          // console.log('Chatbot response data:', data.response);
          if (data.error) {
            throw new Error(data.error);
          }
          if (data && data.reply) {
            const botMessage: Message = {
              text: data.reply,
              sender: 'bot',
              timestamp: new Date(),
            };
            setMessages(prev => [...prev.slice(0, -1), botMessage]);
          } else {
            throw new Error('Invalid response format: missing reply');
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          const detail = errorData.detail || 'Failed to get response from chatbot';
          throw new Error(detail);
        }
      } else {
        setTimeout(() => {
          const botMessage: Message = {
            text: 'Hello! I\'m a chatbot. The API URL hasn\'t been configured yet, but I\'m ready to help once it\'s set up!',
            sender: 'bot',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev.slice(0, -1), botMessage]);
        }, 1000);
      }
    } catch (error) {
      console.error('Chatbot error:', error);
      const errorMessage: Message = {
        text: `Sorry, I am sleeping right now`,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev.slice(0, -1), errorMessage]);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isBotTyping) return;

    const messageToSend = inputText.trim();
    setInputText('');
    await sendPredefinedMessage(messageToSend);
  };

  const renderMessage = (message: Message, index: number) => {
    if (message.sender === 'system') {
      return (
        <View key={index} className="items-center py-4 px-6">
          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0] text-sm text-center leading-5">
            {message.text}
          </Text>
        </View>
      );
    }

    const isUser = message.sender === 'user';
    return (
      <View key={index} className={`flex-row ${isUser ? 'justify-end' : 'justify-start'} mb-4 px-4`}>

        <View
          className={`max-w-[75%] px-4 py-3 rounded-2xl ${isUser
              ? 'bg-[#EEB170] rounded-br-md'
              : 'bg-[#FFFFFF66] border border-[#A0B3D0] rounded-bl-md'
            }`}
        >
          {message.loading ? (
            <ActivityIndicator size="small" color="#0C3572" />
          ) : isUser ? (
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#0C3572] text-base">
              {message.text}
            </Text>
          ) : (
            <MarkdownText
              style={{ fontSize: 14, lineHeight: 20, fontFamily: 'Outfit_500Medium' }}
              //justified text for bot messages
              // textStyle={{ color: 'white', textAlign: 'justify' }}
              lightMode={true}
            >
              {message.text}
            </MarkdownText>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >

      <SafeAreaView className="flex-1 bg-[#DBE2ED]" edges={['top', 'bottom']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 mt-5 ">
          <TouchableOpacity onPress={onClose} className="p-2">
            <Ionicons name="arrow-back" size={24} color="#0C3572" />
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-2xl">SatBot</Text>
          <View className="w-10" />
        </View>

        {/* Messages */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            ref={scrollViewRef}
            className="flex-1 bg-transparent"
            contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 16 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((message, index) => renderMessage(message, index))}
          </ScrollView>

          {/* Input */}

          <View className="px-4 pt-4 pb-12 bg-[#FFFFFF66] border-t border-[#A0B3D0] rounded-t-3xl ">

            {/* add some pre options that will directly can be asked when i click on them like small scrollable tags/button */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-3"
            >
              {exampleQuestions.map((question, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => sendPredefinedMessage(question)}
                  disabled={isBotTyping}
                  className={`${isBotTyping ? 'bg-gray-300' : 'bg-transparent'} border border-[#A0B3D0] rounded-lg px-4 py-2 mr-2`}
                >
                  <Text style={{ fontFamily: 'Outfit_500Medium' }} className={`${isBotTyping ? 'text-[#2175C0]' : 'text-[#0C3572]'} text-sm`}>
                    {question}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View className="flex-row items-center border-[#A0B3D0] border-2 bg-transparent rounded-xl mt-2 px-5 py-2">
              <TextInput
                style={{ fontFamily: 'Outfit_500Medium' }}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask something..."
                placeholderTextColor="#2175C0"
                className="flex-1  py-2 text-[#0C3572]"
                multiline
                maxLength={500}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
              />
              <TouchableOpacity
                onPress={sendMessage}
                disabled={!inputText.trim() || isBotTyping}
                className={`ml-2 w-10 h-10 items-center justify-center`}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={!isBotTyping && inputText.trim() ? '#0C3572' : '#2175C0'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

    </Modal>
  );
};

export default ChatBot;
