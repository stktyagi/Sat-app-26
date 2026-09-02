// src/components/ui/CustomAlert.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';

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
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.9));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
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
          toValue: 0.9,
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

  // Default buttons if none provided
  const alertButtons =
    buttons.length > 0
      ? buttons
      : [{ text: 'OK', style: 'default' as const }];

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
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: fadeAnim,
        }}
      >
        <Animated.View
          className="bg-white rounded-3xl mx-6 p-8"
          style={{
            transform: [{ scale: scaleAnim }],
            width: Math.min(SCREEN_WIDTH - 48, 400),
            maxWidth: '90%',
          }}
        >
          {/* Title */}
          {title && (
            <Text
              style={{ fontFamily: 'Outfit_700Bold' }}
              className="text-[#0C3572] text-3xl mb-4"
            >
              {title}
            </Text>
          )}

          {/* Message */}
          <Text
            style={{ fontFamily: 'Outfit_400Regular' }}
            className="text-[#2175C0] text-base mb-6 leading-6"
          >
            {message}
          </Text>

          {/* Buttons */}
          <View className={`gap-3 ${alertButtons.length > 2 ? 'flex-col' : 'flex-row'} ${alertButtons.length === 1 ? 'justify-center' : 'justify-between'}`}>
            {alertButtons.map((button, index) => {
              // Determine button style based on position and style prop
              const isConfirmButton =
                button.style === 'default' ||
                (alertButtons.length === 2 && index === 0);
              const isCancelButton =
                button.style === 'cancel' ||
                (alertButtons.length === 2 && index === 1);
              const isDestructive = button.style === 'destructive';

              // For 3+ buttons, only the first button (or default) gets filled style
              const shouldBeFilled = alertButtons.length > 2
                ? button.style === 'default' && index === 0
                : isConfirmButton || isDestructive;

              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleButtonPress(button)}
                  className={`py-4 px-6 rounded-2xl ${
                    shouldBeFilled
                      ? 'bg-[#FDCE04]'
                      : 'border-2 border-[#FDCE04]'
                  } ${alertButtons.length <= 2 ? 'flex-1' : 'w-full'}`}
                  style={{
                    minWidth: alertButtons.length === 1 ? 200 : undefined,
                  }}
                >
                  <Text
                    style={{ fontFamily: 'Outfit_600SemiBold' }}
                    className={`text-center text-lg ${
                      shouldBeFilled
                        ? 'text-black'
                        : 'text-[#FDCE04]'
                    }`}
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
