import React, { useState, useEffect, useRef } from 'react';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
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
  StatusBar,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Bot,
  Sparkles,
  Send,
  ArrowLeft,
  RotateCcw,
  ShieldCheck,
  Calendar,
  Ticket,
  MapPin,
  HelpCircle,
  ChevronRight,
} from 'lucide-react-native';

import MarkdownText from '../display/MarkdownText';
import { apiFetch, readError } from '@/api/client';
import { useThemeStore } from '@/state/themeStore';

export interface ReferencedEvent {
  id: string;
  title: string;
  category?: string;
  venue?: string;
  schedule_ist?: string;
  fee_display?: string;
  team_size_display?: string;
  external_url?: string | null;
}

interface Message {
  text: string;
  sender: 'user' | 'bot' | 'system';
  timestamp: Date;
  loading?: boolean;
  referencedEvents?: ReferencedEvent[];
  suggestedFollowups?: string[];
}

interface ChatBotProps {
  visible: boolean;
  onClose: () => void;
  chatbotApiUrl?: string;
}

const quickSuggestions = [
  { icon: Sparkles, text: "What is Saturnalia '26?" },
  { icon: Calendar, text: 'What is the schedule for 21-23 Nov?' },
  { icon: Ticket, text: 'How do I register for events?' },
  { icon: HelpCircle, text: 'Are outside college students allowed?' },
  { icon: MapPin, text: 'Where are the event venues located?' },
];

const generateSessionId = () =>
  'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);

const ChatBot: React.FC<ChatBotProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();

  const [sessionId, setSessionId] = useState<string>(generateSessionId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [loadingEventId, setLoadingEventId] = useState<string | null>(null);
  const [followupSuggestions, setFollowupSuggestions] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  const isBotTyping = messages[messages.length - 1]?.loading === true;

  // Theme palettes
  const bgColor = isDark ? '#0F1015' : '#F8FAFC';
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0';
  const textPrimary = isDark ? '#FFFFFF' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const accentColor = '#41B8F0';

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 120);
    }
  }, [messages, visible]);

  // Listen to keyboard show/hide events to ensure input field is never hidden
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleClearChat = async () => {
    const prevSession = sessionId;
    setMessages([]);
    setFollowupSuggestions([]);
    const newSession = generateSessionId();
    setSessionId(newSession);

    try {
      await apiFetch(
        '/chatbot/reset',
        {
          method: 'POST',
          body: JSON.stringify({ sessionId: prevSession }),
        },
        'optional'
      );
    } catch (err) {
      console.warn('Chatbot reset warning:', err);
    }
  };

  const handleEventPress = async (eventId: string) => {
    if (!eventId || loadingEventId) return;
    try {
      setLoadingEventId(eventId);
      const { getEvent } = await import('@/api/events');
      const eventData = await getEvent(eventId);
      if (eventData) {
        onClose();
        router.push({
          pathname: '/events/EventDetails',
          params: { eventData: JSON.stringify(eventData) },
        });
      }
    } catch (e) {
      console.warn('Failed to load event details:', e);
    } finally {
      setLoadingEventId(null);
    }
  };

  const sendPredefinedMessage = async (messageText: string) => {
    if (isBotTyping || !messageText.trim()) return;

    const userMessage: Message = {
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };

    const loaderMessage: Message = {
      text: '',
      sender: 'bot',
      timestamp: new Date(),
      loading: true,
    };

    setMessages(prev => [...prev, userMessage, loaderMessage]);

    try {
      const response = await apiFetch(
        '/chatbot/ask',
        {
          method: 'POST',
          body: JSON.stringify({
            message: messageText,
            sessionId: sessionId,
          }),
        },
        'optional'
      );

      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        const replyText = data.reply || data.response;
        if (replyText) {
          const referenced: ReferencedEvent[] =
            data.referencedEvents || data.referenced_events || [];
          const followups: string[] =
            data.suggestedFollowups || data.suggested_followups || [];

          if (data.sessionId || data.session_id) {
            setSessionId(data.sessionId || data.session_id);
          }
          if (followups.length > 0) {
            setFollowupSuggestions(followups);
          }

          const botMessage: Message = {
            text: replyText,
            sender: 'bot',
            timestamp: new Date(),
            referencedEvents: referenced,
            suggestedFollowups: followups,
          };
          setMessages(prev => [...prev.slice(0, -1), botMessage]);
        } else {
          throw new Error('Invalid response format: missing reply');
        }
      } else {
        const detail = await readError(response, 'Failed to get response from chatbot');
        throw new Error(detail);
      }
    } catch (error) {
      console.error('Chatbot error:', error);
      const errorMessage: Message = {
        text: 'Sorry, I ran into a connection issue. Please try asking again in a moment!',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev.slice(0, -1), errorMessage]);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isBotTyping) return;
    const msg = inputText.trim();
    setInputText('');
    await sendPredefinedMessage(msg);
  };

  const formatTime = (d: Date) => {
    try {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderMessage = (message: Message, index: number) => {
    const isUser = message.sender === 'user';

    return (
      <Animated.View
        key={index}
        entering={FadeInDown.duration(200).easing(Easing.bezier(0.23, 1, 0.32, 1))}
        style={{
          flexDirection: 'row',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          alignItems: 'flex-end',
          marginBottom: 16,
          paddingHorizontal: 4,
        }}
      >
        {/* Bot Avatar Icon */}
        {!isUser && (
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: isDark ? 'rgba(65, 184, 240, 0.15)' : 'rgba(65, 184, 240, 0.12)',
              borderColor: 'rgba(65, 184, 240, 0.3)',
              borderWidth: 1,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
              marginBottom: 4,
            }}
          >
            <Bot size={16} color={accentColor} />
          </View>
        )}

        {/* Message Bubble */}
        <View
          style={{
            maxWidth: '82%',
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 20,
            borderBottomRightRadius: isUser ? 4 : 20,
            borderBottomLeftRadius: !isUser ? 4 : 20,
            backgroundColor: isUser
              ? accentColor
              : isDark
              ? 'rgba(255, 255, 255, 0.07)'
              : '#FFFFFF',
            borderWidth: isUser ? 0 : 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.2 : 0.06,
            shadowRadius: 4,
            elevation: isUser ? 3 : 2,
          }}
        >
          {message.loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
              <ActivityIndicator size="small" color={accentColor} />
              <Text
                style={{
                  fontFamily: 'Poppins_500Medium',
                  fontSize: 13,
                  color: isDark ? '#94A3B8' : '#64748B',
                }}
              >
                Thinking...
              </Text>
            </View>
          ) : isUser ? (
            <Text
              style={{
                fontFamily: 'Poppins_500Medium',
                fontSize: 14.5,
                lineHeight: 21,
                color: '#FFFFFF',
              }}
            >
              {message.text}
            </Text>
          ) : (
            <View>
              <MarkdownText
                style={{
                  fontSize: 14,
                  lineHeight: 21,
                  fontFamily: 'Poppins_400Regular',
                  color: isDark ? '#F1F5F9' : '#0F172A',
                }}
                lightMode={!isDark}
              >
                {message.text}
              </MarkdownText>

              {/* Referenced Events Cards */}
              {message.referencedEvents && message.referencedEvents.length > 0 && (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <Text
                    style={{
                      fontFamily: 'Poppins_600SemiBold',
                      fontSize: 11.5,
                      color: accentColor,
                      letterSpacing: 0.3,
                      textTransform: 'uppercase',
                    }}
                  >
                    Related Events
                  </Text>
                  {message.referencedEvents.map((evt, eIdx) => (
                    <TouchableOpacity
                      key={evt.id || eIdx}
                      activeOpacity={0.75}
                      onPress={() => handleEventPress(evt.id)}
                      disabled={loadingEventId === evt.id}
                      style={{
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                        borderWidth: 1,
                        borderRadius: 14,
                        padding: 10,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: 'Poppins_600SemiBold',
                            fontSize: 13.5,
                            color: textPrimary,
                            flex: 1,
                            marginRight: 6,
                          }}
                          numberOfLines={1}
                        >
                          {evt.title}
                        </Text>
                        {loadingEventId === evt.id ? (
                          <ActivityIndicator size="small" color={accentColor} />
                        ) : (
                          <ChevronRight size={15} color={accentColor} />
                        )}
                      </View>

                      {evt.venue ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <MapPin size={11} color={textSecondary} />
                          <Text
                            style={{
                              fontFamily: 'Poppins_400Regular',
                              fontSize: 11,
                              color: textSecondary,
                              flex: 1,
                            }}
                            numberOfLines={1}
                          >
                            {evt.venue}
                          </Text>
                        </View>
                      ) : null}

                      {evt.schedule_ist ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Calendar size={11} color={textSecondary} />
                          <Text
                            style={{
                              fontFamily: 'Poppins_400Regular',
                              fontSize: 11,
                              color: textSecondary,
                              flex: 1,
                            }}
                            numberOfLines={1}
                          >
                            {evt.schedule_ist}
                          </Text>
                        </View>
                      ) : null}

                      {(evt.fee_display || evt.team_size_display) ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            marginTop: 6,
                            paddingTop: 6,
                            borderTopWidth: 1,
                            borderTopColor: isDark
                              ? 'rgba(255, 255, 255, 0.06)'
                              : 'rgba(0, 0, 0, 0.05)',
                          }}
                        >
                          {evt.fee_display ? (
                            <Text
                              style={{
                                fontFamily: 'Poppins_500Medium',
                                fontSize: 10.5,
                                color: accentColor,
                              }}
                            >
                              {evt.fee_display}
                            </Text>
                          ) : null}
                          {evt.team_size_display ? (
                            <Text
                              style={{
                                fontFamily: 'Poppins_400Regular',
                                fontSize: 10.5,
                                color: textSecondary,
                              }}
                            >
                              👥 {evt.team_size_display}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Follow-up Question Chips inside bubble */}
              {message.suggestedFollowups && message.suggestedFollowups.length > 0 && (
                <View style={{ marginTop: 10, gap: 6 }}>
                  <Text
                    style={{
                      fontFamily: 'Poppins_500Medium',
                      fontSize: 11,
                      color: textSecondary,
                    }}
                  >
                    Suggested follow-ups:
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {message.suggestedFollowups.map((q, qIdx) => (
                      <TouchableOpacity
                        key={qIdx}
                        activeOpacity={0.7}
                        onPress={() => sendPredefinedMessage(q)}
                        disabled={isBotTyping}
                        style={{
                          backgroundColor: isDark
                            ? 'rgba(65, 184, 240, 0.12)'
                            : 'rgba(65, 184, 240, 0.08)',
                          borderColor: 'rgba(65, 184, 240, 0.28)',
                          borderWidth: 1,
                          borderRadius: 12,
                          paddingVertical: 5,
                          paddingHorizontal: 10,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: 'Poppins_500Medium',
                            fontSize: 11,
                            color: accentColor,
                          }}
                        >
                          {q}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Timestamp */}
          {!message.loading && (
            <Text
              style={{
                fontSize: 10,
                fontFamily: 'Poppins_400Regular',
                color: isUser ? 'rgba(255, 255, 255, 0.75)' : isDark ? '#64748B' : '#94A3B8',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                marginTop: 4,
              }}
            >
              {formatTime(message.timestamp)}
            </Text>
          )}
        </View>
      </Animated.View>
    );
  };

  // Decide which suggestions to show in the quick pills bar
  const activeSuggestions =
    followupSuggestions.length > 0
      ? followupSuggestions.map(text => ({ icon: Sparkles, text }))
      : quickSuggestions;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={['top', 'bottom']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
        >
          {/* Top Header */}
          <View
            style={{
              paddingTop: 8,
              paddingBottom: 14,
              paddingHorizontal: 16,
              backgroundColor: isDark ? 'rgba(19, 19, 22, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              borderBottomWidth: 1,
              borderBottomColor: cardBorder,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Back button */}
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowLeft size={20} color={textPrimary} />
            </TouchableOpacity>

            {/* Bot Title & Status */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: isDark ? 'rgba(65, 184, 240, 0.16)' : 'rgba(65, 184, 240, 0.12)',
                  borderColor: 'rgba(65, 184, 240, 0.35)',
                  borderWidth: 1.5,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                <Bot size={20} color={accentColor} />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={{
                      fontFamily: 'Poppins_700Bold',
                      fontSize: 17,
                      color: textPrimary,
                      letterSpacing: 0.3,
                    }}
                  >
                    SatBot
                  </Text>
                  <View
                    style={{
                      backgroundColor: 'rgba(65, 184, 240, 0.15)',
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Poppins_600SemiBold',
                        fontSize: 10,
                        color: accentColor,
                      }}
                    >
                      AI
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: '#22C55E',
                    }}
                  />
                  <Text
                    style={{
                      fontFamily: 'Poppins_400Regular',
                      fontSize: 11,
                      color: textSecondary,
                    }}
                  >
                    Saturnalia Assistant • Online
                  </Text>
                </View>
              </View>
            </View>

            {/* Clear Chat Button */}
            <TouchableOpacity
              onPress={handleClearChat}
              disabled={messages.length === 0}
              activeOpacity={0.7}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: messages.length === 0 ? 0.3 : 1,
              }}
            >
              <RotateCcw size={18} color={textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content & Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingVertical: 16,
              paddingHorizontal: 16,
              flexGrow: 1,
              justifyContent: messages.length === 0 ? 'center' : 'flex-start',
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Empty State / Welcome Hero */}
            {messages.length === 0 && (
              <View style={{ alignItems: 'center', paddingHorizontal: 20, marginVertical: 'auto' }}>
                <View
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 38,
                    backgroundColor: isDark ? 'rgba(65, 184, 240, 0.12)' : 'rgba(65, 184, 240, 0.1)',
                    borderColor: 'rgba(65, 184, 240, 0.28)',
                    borderWidth: 1.5,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 18,
                  }}
                >
                  <Sparkles size={36} color={accentColor} />
                </View>

                <Text
                  style={{
                    fontFamily: 'Talina',
                    fontSize: 24,
                    color: textPrimary,
                    textAlign: 'center',
                    letterSpacing: 0.5,
                    marginBottom: 8,
                  }}
                >
                  Ask SatBot AI
                </Text>

                <Text
                  style={{
                    fontFamily: 'Poppins_400Regular',
                    fontSize: 13.5,
                    lineHeight: 21,
                    color: textSecondary,
                    textAlign: 'center',
                    marginBottom: 20,
                  }}
                >
                  Your interactive intelligence for Saturnalia &apos;26. Inquire about event schedules,
                  guidelines, venues, tickets, and campus navigations.
                </Text>

                {/* Privacy Badge */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 20,
                    borderColor: cardBorder,
                    borderWidth: 1,
                  }}
                >
                  <ShieldCheck size={14} color={accentColor} />
                  <Text
                    style={{
                      fontFamily: 'Poppins_500Medium',
                      fontSize: 11,
                      color: textSecondary,
                    }}
                  >
                    Interactive Multi-turn Session
                  </Text>
                </View>
              </View>
            )}

            {/* Render conversation messages */}
            {messages.map((message, index) => renderMessage(message, index))}
          </ScrollView>

          {/* Quick suggestions pills */}
          {!keyboardVisible && (
            <View style={{ paddingVertical: 6 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                keyboardShouldPersistTaps="handled"
              >
                {activeSuggestions.map((item, idx) => {
                  const IconComponent = item.icon;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => sendPredefinedMessage(item.text)}
                      disabled={isBotTyping}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: cardBg,
                        borderColor: cardBorder,
                        borderWidth: 1,
                        borderRadius: 18,
                        paddingVertical: 8,
                        paddingHorizontal: 13,
                        opacity: isBotTyping ? 0.5 : 1,
                      }}
                    >
                      <IconComponent size={14} color={accentColor} />
                      <Text
                        style={{
                          fontFamily: 'Poppins_500Medium',
                          fontSize: 12,
                          color: textPrimary,
                        }}
                      >
                        {item.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Input Dock */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 12),
              backgroundColor: isDark ? 'rgba(15, 16, 21, 0.98)' : 'rgba(248, 250, 252, 0.98)',
              borderTopWidth: 1,
              borderTopColor: cardBorder,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF',
                borderRadius: 22,
                borderWidth: 1.2,
                borderColor: cardBorder,
                paddingHorizontal: 14,
                paddingVertical: 6,
                minHeight: 48,
              }}
            >
              <TextInput
                style={{
                  flex: 1,
                  fontFamily: 'Poppins_400Regular',
                  fontSize: 14,
                  color: textPrimary,
                  paddingVertical: Platform.OS === 'ios' ? 8 : 4,
                  maxHeight: 100,
                }}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask anything about Saturnalia '26..."
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={sendMessage}
              />

              <TouchableOpacity
                onPress={sendMessage}
                disabled={!inputText.trim() || isBotTyping}
                activeOpacity={0.8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor:
                    !isBotTyping && inputText.trim()
                      ? accentColor
                      : isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 8,
                }}
              >
                <Send
                  size={16}
                  color={!isBotTyping && inputText.trim() ? '#FFFFFF' : textSecondary}
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
