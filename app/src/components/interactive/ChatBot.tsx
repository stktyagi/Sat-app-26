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
  Linking,
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
  ExternalLink,
} from 'lucide-react-native';

import MarkdownText from '../display/MarkdownText';
import { apiFetch, readError } from '@/api/client';
import { useThemeStore } from '@/state/themeStore';
import { useUserStore } from '@/state/userStore';
import { FirebaseEvent } from '@/types/models';

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

const isEventRelated = (text: string) => {
  const lower = text.trim().toLowerCase();
  if (
    lower.includes('what is saturnalia') ||
    lower.includes('about saturnalia') ||
    lower.includes('explore other festival') ||
    lower.includes('explore cultural events') ||
    lower.includes('show technical competitions') ||
    lower.includes('show business challenges') ||
    lower.includes('are there any free events') ||
    lower.includes('who can participate in saturnalia') ||
    lower.includes('festival fact')
  ) {
    return false;
  }
  return true;
};

const quickSuggestions = [
  { icon: Sparkles, text: 'Tell me about SatHack' },
  { icon: Calendar, text: 'Where and when is Battle of Bands?' },
  { icon: Ticket, text: 'What are the rules and team size for SatHack?' },
  { icon: MapPin, text: 'Where is AlgoAuction happening?' },
  { icon: Sparkles, text: 'Tell me about Case Quest' },
];

const generateSessionId = (userId?: string) =>
  userId
    ? `sess_${userId}_${Date.now().toString(36)}`
    : 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);

const ChatBot: React.FC<ChatBotProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const { userData } = useUserStore();

  const [sessionId, setSessionId] = useState<string>(() =>
    generateSessionId(userData?.userId || (userData as any)?.id)
  );
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
    const newSession = generateSessionId(userData?.userId || (userData as any)?.id);
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

  const handleEventPress = async (evt: ReferencedEvent) => {
    if (!evt || loadingEventId) return;

    if (evt.external_url) {
      Linking.openURL(evt.external_url).catch(() => {});
      return;
    }

    const clickKey = evt.id || evt.title || 'event';
    setLoadingEventId(clickKey);

    try {
      let matchedEvent: FirebaseEvent | null = null;
      try {
        const { listEvents } = await import('@/api/events');
        const allEvents = await listEvents();

        // 1. Direct match by ID
        matchedEvent = allEvents.find((e) => e.id === evt.id || e.eventId === evt.id) || null;

        // 2. Fuzzy match by title words or slug
        if (!matchedEvent && evt.title) {
          const cleanEvt = evt.title.toLowerCase().replace(/[^a-z0-9]/g, '');
          matchedEvent =
            allEvents.find((e) => {
              const cleanE = (e.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              return cleanE === cleanEvt || cleanE.includes(cleanEvt) || cleanEvt.includes(cleanE);
            }) || null;
        }
      } catch (err) {
        console.warn('Events list lookup warning:', err);
      }

      // Safe event payload ensuring EventDetails will never crash
      const finalEvent: FirebaseEvent = matchedEvent || {
        id: evt.id || 'sat-event',
        eventId: evt.id || 'sat-event',
        title: evt.title || 'Saturnalia Event',
        category: evt.category || 'Cultural',
        venueName: evt.venue || 'TIET Campus',
        dateTime: evt.schedule_ist || '',
        startDateTime: evt.schedule_ist || '',
        endDateTime: '',
        isPublic: true,
        eventType: (evt.team_size_display || '').toLowerCase().includes('member')
          ? 'team'
          : 'individual',
        description: `Scheduled for ${evt.schedule_ist || 'Saturnalia 2026'} at ${evt.venue || 'TIET Campus'}.`,
        shortDescription: evt.fee_display || '',
        coverImage: '',
        isFeatured: false,
        paymentStarted: false,
        prizes: '',
        shortPrizes: '',
        rules: '',
        sameCollegeOnly: false,
        registeredCount: 0,
        registrationDeadline: '',
        reelsId: [],
        coordinators: [],
        customFields: [],
        images: [],
        links: [],
        registrationFee: { host: 0, other: 0 },
        paymentRequired: false,
      };

      // Close modal first and schedule navigation on next tick to prevent Modal dismiss crash
      onClose();
      setTimeout(() => {
        router.push({
          pathname: '/events/EventDetails',
          params: { eventData: JSON.stringify(finalEvent) },
        });
      }, 100);
    } catch (e) {
      console.warn('Navigation error:', e);
      onClose();
      setTimeout(() => {
        router.push('/(tabs)/events' as any);
      }, 100);
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
          const rawFollowups: string[] =
            data.suggestedFollowups || data.suggested_followups || [];
          const followups = rawFollowups.filter(isEventRelated);

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
        text: 'Sorry, I ran into a connection issue with SatBot. Please try asking again in a moment!',
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
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: isDark ? 'rgba(65, 184, 240, 0.15)' : 'rgba(65, 184, 240, 0.12)',
              borderColor: 'rgba(65, 184, 240, 0.3)',
              borderWidth: 1,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
              marginBottom: 4,
            }}
          >
            <Bot size={17} color={accentColor} />
          </View>
        )}

        {/* Message Bubble */}
        <View
          style={{
            maxWidth: '84%',
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
                SatBot is thinking...
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
                <View style={{ marginTop: 12, gap: 8, width: '100%' }}>
                  <Text
                    style={{
                      fontFamily: 'Poppins_600SemiBold',
                      fontSize: 11,
                      color: accentColor,
                      letterSpacing: 0.3,
                      textTransform: 'uppercase',
                    }}
                  >
                    Referenced Events
                  </Text>
                  {message.referencedEvents.map((evt, eIdx) => {
                    const isCultural = evt.category?.toLowerCase().includes('cultural');
                    const isTech = evt.category?.toLowerCase().includes('tech');
                    const isBiz = evt.category?.toLowerCase().includes('business');
                    const catColor = isTech ? '#A855F7' : isCultural ? '#F59E0B' : isBiz ? '#10B981' : accentColor;
                    const isCardLoading = loadingEventId === (evt.id || evt.title);

                    return (
                      <TouchableOpacity
                        key={evt.id || eIdx}
                        activeOpacity={0.75}
                        onPress={() => handleEventPress(evt)}
                        disabled={isCardLoading}
                        style={{
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                          borderWidth: 1,
                          borderRadius: 14,
                          padding: 12,
                          gap: 6,
                        }}
                      >
                        {/* Title & Action Icon Row */}
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: 'Poppins_600SemiBold',
                              fontSize: 13.5,
                              color: textPrimary,
                              flex: 1,
                              lineHeight: 18,
                            }}
                          >
                            {evt.title}
                          </Text>
                          {isCardLoading ? (
                            <ActivityIndicator size="small" color={accentColor} />
                          ) : evt.external_url ? (
                            <ExternalLink size={15} color={accentColor} style={{ marginTop: 2, flexShrink: 0 }} />
                          ) : (
                            <ChevronRight size={15} color={accentColor} style={{ marginTop: 2, flexShrink: 0 }} />
                          )}
                        </View>

                        {/* Category Badge */}
                        {evt.category ? (
                          <View
                            style={{
                              alignSelf: 'flex-start',
                              backgroundColor: isDark ? `${catColor}25` : `${catColor}15`,
                              borderColor: `${catColor}40`,
                              borderWidth: 1,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 10, color: catColor }}>
                              {evt.category}
                            </Text>
                          </View>
                        ) : null}

                        {/* Venue */}
                        {evt.venue ? (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                            <MapPin size={12} color={accentColor} style={{ marginTop: 2, flexShrink: 0 }} />
                            <Text
                              style={{
                                fontFamily: 'Poppins_400Regular',
                                fontSize: 11.5,
                                lineHeight: 16,
                                color: textSecondary,
                                flex: 1,
                              }}
                            >
                              {evt.venue}
                            </Text>
                          </View>
                        ) : null}

                        {/* Schedule */}
                        {evt.schedule_ist ? (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                            <Calendar size={12} color="#F59E0B" style={{ marginTop: 2, flexShrink: 0 }} />
                            <Text
                              style={{
                                fontFamily: 'Poppins_400Regular',
                                fontSize: 11.5,
                                lineHeight: 16,
                                color: textSecondary,
                                flex: 1,
                              }}
                            >
                              {evt.schedule_ist}
                            </Text>
                          </View>
                        ) : null}

                        {/* Fee, Team Size & Action CTA */}
                        {(evt.fee_display || evt.team_size_display || evt.external_url) ? (
                          <View
                            style={{
                              marginTop: 4,
                              paddingTop: 8,
                              borderTopWidth: 1,
                              borderTopColor: isDark
                                ? 'rgba(255, 255, 255, 0.08)'
                                : 'rgba(0, 0, 0, 0.06)',
                              gap: 6,
                            }}
                          >
                            {/* Fee Display Row (Own line so it never overflows) */}
                            {evt.fee_display ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Ticket size={12} color="#10B981" style={{ flexShrink: 0 }} />
                                <Text
                                  style={{
                                    fontFamily: 'Poppins_500Medium',
                                    fontSize: 11,
                                    color: '#10B981',
                                    flexShrink: 1,
                                  }}
                                >
                                  {evt.fee_display}
                                </Text>
                              </View>
                            ) : null}

                            {/* Team Size and CTA Row */}
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                              }}
                            >
                              {evt.team_size_display ? (
                                <Text
                                  style={{
                                    fontFamily: 'Poppins_400Regular',
                                    fontSize: 11,
                                    color: textSecondary,
                                    flexShrink: 1,
                                  }}
                                >
                                  👥 {evt.team_size_display}
                                </Text>
                              ) : <View />}

                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                  backgroundColor: isDark ? 'rgba(65, 184, 240, 0.15)' : 'rgba(65, 184, 240, 0.1)',
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 8,
                                }}
                              >
                                <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 10.5, color: accentColor }}>
                                  {evt.external_url ? 'Register Link' : 'View Event'}
                                </Text>
                                {evt.external_url ? (
                                  <ExternalLink size={10} color={accentColor} />
                                ) : (
                                  <ChevronRight size={10} color={accentColor} />
                                )}
                              </View>
                            </View>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Follow-up Question Chips inside bubble */}
              {message.suggestedFollowups && message.suggestedFollowups.length > 0 && (
                <View style={{ marginTop: 12, gap: 6 }}>
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
              <View style={{ alignItems: 'center', paddingHorizontal: 12, marginVertical: 'auto' }}>
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: isDark ? 'rgba(65, 184, 240, 0.12)' : 'rgba(65, 184, 240, 0.1)',
                    borderColor: 'rgba(65, 184, 240, 0.28)',
                    borderWidth: 1.5,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 14,
                  }}
                >
                  <Sparkles size={34} color={accentColor} />
                </View>

                <Text
                  style={{
                    fontFamily: 'Talina',
                    fontSize: 24,
                    color: textPrimary,
                    textAlign: 'center',
                    letterSpacing: 0.5,
                    marginBottom: 6,
                  }}
                >
                  Ask SatBot AI
                </Text>

                <Text
                  style={{
                    fontFamily: 'Poppins_400Regular',
                    fontSize: 13,
                    lineHeight: 20,
                    color: textSecondary,
                    textAlign: 'center',
                    marginBottom: 16,
                  }}
                >
                  Your interactive guide for Saturnalia &apos;26. Inquire about event schedules, rules, prizes, venues, and directions.
                </Text>

                {/* Multi-turn Badge */}
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
                    marginBottom: 20,
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
                    Interactive Multi-turn Memory
                  </Text>
                </View>

                {/* Curated Prompt Cards */}
                <View style={{ width: '100%', gap: 8 }}>
                  <Text
                    style={{
                      fontFamily: 'Poppins_600SemiBold',
                      fontSize: 12,
                      color: textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 2,
                    }}
                  >
                    Suggested Questions
                  </Text>
                  {quickSuggestions.map((item, idx) => {
                    const IconComponent = item.icon;
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => sendPredefinedMessage(item.text)}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          backgroundColor: cardBg,
                          borderColor: cardBorder,
                          borderWidth: 1,
                          borderRadius: 14,
                          paddingVertical: 11,
                          paddingHorizontal: 14,
                        }}
                      >
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: isDark ? 'rgba(65, 184, 240, 0.12)' : 'rgba(65, 184, 240, 0.08)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconComponent size={14} color={accentColor} />
                        </View>
                        <Text
                          style={{
                            fontFamily: 'Poppins_500Medium',
                            fontSize: 13,
                            color: textPrimary,
                            flex: 1,
                          }}
                        >
                          {item.text}
                        </Text>
                        <ChevronRight size={14} color={textSecondary} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Render conversation messages */}
            {messages.map((message, index) => renderMessage(message, index))}
          </ScrollView>

          {/* Quick suggestions pills */}
          {!keyboardVisible && messages.length > 0 && (
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
