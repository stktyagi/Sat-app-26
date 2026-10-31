// src/components/ui/CustomAlert.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Pressable,
} from 'react-native';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Trash2,
  Info,
} from 'lucide-react-native';
import { useThemeStore } from '@/state/themeStore';

// Strong ease-out: settles fast instead of the old slow spring wobble.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
  visible: boolean;
  title?: string;
  message: string;
  buttons?: AlertButton[];
  onDismiss?: () => void;
}

const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  buttons = [],
  onDismiss,
}) => {
  const { isDark } = useThemeStore();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleButtonPress = (button: AlertButton) => {
    if (button.onPress) {
      button.onPress();
    }
    if (onDismiss) {
      onDismiss();
    }
  };

  // Determine alert type based on content & buttons
  const normalizedTitle = (title || '').toLowerCase();
  const normalizedMsg = (message || '').toLowerCase();
  const hasDestructive = buttons.some((b) => b.style === 'destructive');

  type AlertType = 'success' | 'destructive' | 'error' | 'warning' | 'info';
  let type: AlertType = 'info';

  if (hasDestructive || normalizedTitle.includes('delete') || normalizedTitle.includes('remove')) {
    type = 'destructive';
  } else if (normalizedTitle.includes('success') || normalizedMsg.includes('success')) {
    type = 'success';
  } else if (
    normalizedTitle.includes('error') ||
    normalizedTitle.includes('fail') ||
    normalizedMsg.includes('failed') ||
    normalizedMsg.includes('error')
  ) {
    type = 'error';
  } else if (
    normalizedTitle.includes('warn') ||
    normalizedTitle.includes('permission') ||
    normalizedTitle.includes('require')
  ) {
    type = 'warning';
  }

  // Type-specific colors and icons using Events & Store fest palette
  const typeConfig: Record<
    AlertType,
    {
      accent: string;
      badgeBg: string;
      badgeBorder: string;
      icon: React.ReactNode;
      confirmText: string;
    }
  > = {
    success: {
      accent: '#C8E946', // Events Bento Electric Lime
      badgeBg: isDark ? 'rgba(200, 233, 70, 0.16)' : 'rgba(200, 233, 70, 0.18)',
      badgeBorder: isDark ? 'rgba(200, 233, 70, 0.38)' : 'rgba(200, 233, 70, 0.45)',
      icon: <CheckCircle2 size={28} color="#C8E946" strokeWidth={2.2} />,
      confirmText: '#000000',
    },
    destructive: {
      accent: '#E06A6A', // Events Bento Coral Red
      badgeBg: isDark ? 'rgba(224, 106, 106, 0.16)' : 'rgba(224, 106, 106, 0.14)',
      badgeBorder: isDark ? 'rgba(224, 106, 106, 0.36)' : 'rgba(224, 106, 106, 0.35)',
      icon: <Trash2 size={26} color="#E06A6A" strokeWidth={2.2} />,
      confirmText: '#FFFFFF',
    },
    error: {
      accent: '#C04B6A', // Events Bento Berry Magenta
      badgeBg: isDark ? 'rgba(192, 75, 106, 0.16)' : 'rgba(192, 75, 106, 0.14)',
      badgeBorder: isDark ? 'rgba(192, 75, 106, 0.38)' : 'rgba(192, 75, 106, 0.35)',
      icon: <AlertCircle size={28} color="#C04B6A" strokeWidth={2.2} />,
      confirmText: '#FFFFFF',
    },
    warning: {
      accent: '#FFBA00', // Saturnalia Fest Gold
      badgeBg: isDark ? 'rgba(255, 186, 0, 0.16)' : 'rgba(255, 186, 0, 0.15)',
      badgeBorder: isDark ? 'rgba(255, 186, 0, 0.38)' : 'rgba(255, 186, 0, 0.35)',
      icon: <AlertTriangle size={26} color="#FFBA00" strokeWidth={2.2} />,
      confirmText: '#000000',
    },
    info: {
      accent: '#A855F7', // Events Hyped Purple
      badgeBg: isDark ? 'rgba(168, 85, 247, 0.16)' : 'rgba(168, 85, 247, 0.14)',
      badgeBorder: isDark ? 'rgba(168, 85, 247, 0.38)' : 'rgba(168, 85, 247, 0.35)',
      icon: <Info size={28} color="#A855F7" strokeWidth={2.2} />,
      confirmText: '#FFFFFF',
    },
  };

  const currentType = typeConfig[type];

  // Default buttons if none provided
  const alertButtons =
    buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' as const }];

  // Card theme tokens
  const cardBg = isDark ? '#19191E' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
  const titleColor = isDark ? '#FFFFFF' : '#111827';
  const messageColor = isDark ? '#A1A1AA' : '#64748B';

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onDismiss}
    >
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.55)',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: fadeAnim,
          paddingHorizontal: 24,
        }}
      >
        <Pressable
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          onPress={onDismiss}
        />

        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            width: Math.min(SCREEN_WIDTH - 48, 380),
            backgroundColor: cardBg,
            borderRadius: 24,
            paddingHorizontal: 22,
            paddingTop: 24,
            paddingBottom: 20,
            borderWidth: 1.2,
            borderColor: cardBorder,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: isDark ? 0.45 : 0.18,
            shadowRadius: 24,
            elevation: 12,
            alignItems: 'center',
          }}
        >
          {/* Top Icon Badge */}
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: currentType.badgeBg,
              borderWidth: 1.5,
              borderColor: currentType.badgeBorder,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            {currentType.icon}
          </View>

          {/* Title */}
          {title ? (
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                color: titleColor,
                fontSize: 18,
                textAlign: 'center',
                marginBottom: 6,
                letterSpacing: 0.2,
              }}
            >
              {title}
            </Text>
          ) : null}

          {/* Message */}
          <Text
            style={{
              fontFamily: 'Poppins_400Regular',
              color: messageColor,
              fontSize: 13.5,
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 20,
              paddingHorizontal: 4,
            }}
          >
            {message}
          </Text>

          {/* Buttons */}
          <View
            style={{
              width: '100%',
              flexDirection: alertButtons.length === 2 ? 'row' : 'column',
              gap: 10,
            }}
          >
            {alertButtons.map((button, index) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';

              // Cancel button styling
              if (isCancel) {
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleButtonPress(button)}
                    style={{
                      flex: alertButtons.length === 2 ? 1 : undefined,
                      width: alertButtons.length === 2 ? undefined : '100%',
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#F3F4F6',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
                    }}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={{
                        fontFamily: 'Poppins_500Medium',
                        color: isDark ? '#E4E4E7' : '#374151',
                        fontSize: 14,
                      }}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              }

              // Destructive button styling
              if (isDestructive) {
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleButtonPress(button)}
                    style={{
                      flex: alertButtons.length === 2 ? 1 : undefined,
                      width: alertButtons.length === 2 ? undefined : '100%',
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#EF4444',
                      shadowColor: '#EF4444',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 8,
                      elevation: 4,
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        fontFamily: 'Poppins_600SemiBold',
                        color: '#FFFFFF',
                        fontSize: 14,
                      }}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              }

              // Default / Confirm button styling
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleButtonPress(button)}
                  style={{
                    flex: alertButtons.length === 2 ? 1 : undefined,
                    width: alertButtons.length === 2 ? undefined : '100%',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: currentType.accent,
                    shadowColor: currentType.accent,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontFamily: 'Poppins_600SemiBold',
                      color: currentType.confirmText,
                      fontSize: 14,
                    }}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};


// Global alert manager
interface AlertConfig {
  title?: string;
  message: string;
  buttons?: AlertButton[];
}

class AlertManager {
  private static instance: AlertManager;
  private listeners: ((config: AlertConfig | null) => void)[] = [];
  private currentAlert: AlertConfig | null = null;

  static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  subscribe(listener: (config: AlertConfig | null) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  show(title?: string, message?: string, buttons?: AlertButton[]) {
    // Handle both (title, message, buttons) and (message, buttons) signatures
    let config: AlertConfig;
    if (message === undefined) {
      // Single argument: treat title as message
      config = { message: title || '', buttons };
    } else {
      // Two or three arguments
      config = { title, message, buttons };
    }

    this.currentAlert = config;
    this.listeners.forEach((listener) => listener(config));
  }

  hide() {
    this.currentAlert = null;
    this.listeners.forEach((listener) => listener(null));
  }

  getCurrentAlert(): AlertConfig | null {
    return this.currentAlert;
  }
}

// Alert provider component
export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);

  useEffect(() => {
    const unsubscribe = AlertManager.getInstance().subscribe(setAlertConfig);
    return unsubscribe;
  }, []);

  return (
    <>
      {children}
      <CustomAlert
        visible={alertConfig !== null}
        title={alertConfig?.title}
        message={alertConfig?.message || ''}
        buttons={alertConfig?.buttons}
        onDismiss={() => AlertManager.getInstance().hide()}
      />
    </>
  );
};

// Global alert function (compatible with React Native Alert.alert)
export const showAlert = (
  title?: string,
  message?: string,
  buttons?: AlertButton[]
) => {
  AlertManager.getInstance().show(title, message, buttons);
};

export default CustomAlert;
