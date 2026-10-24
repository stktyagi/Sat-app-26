import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/state/themeStore';
import {
  ROLE_ADMIN,
  ROLE_EB_EVENTS,
  ROLE_EB_OUTREACH,
  ROLE_EB_FINANCE,
  ROLE_EB_MEDIA,
  ROLE_EB_HOSPITALITY,
  ROLE_EC_HOSPITALITY,
  ROLE_EVENT_POC,
  normalizeRole,
} from '@/utils/roles';

interface DrawerItem {
  label: string;
  icon: string;
  route: string;
  requiredRoles: string[];
}

const ALL_ITEMS: DrawerItem[] = [
  { label: 'Event Management', icon: 'calendar-outline', route: '/admin/EventsManagement', requiredRoles: [ROLE_ADMIN, ROLE_EB_EVENTS, ROLE_EVENT_POC] },
  { label: 'QR Scanner', icon: 'qr-code-outline', route: '/admin/QRScanner', requiredRoles: [ROLE_ADMIN, ROLE_EB_HOSPITALITY, ROLE_EC_HOSPITALITY, ROLE_EB_EVENTS, ROLE_EVENT_POC] },
  { label: 'Venue Management', icon: 'location-outline', route: '/admin/Venue', requiredRoles: [ROLE_ADMIN, ROLE_EB_EVENTS] },
  { label: 'FAQ Management', icon: 'help-circle-outline', route: '/admin/FAQ', requiredRoles: [ROLE_ADMIN] },
  { label: 'Accommodation', icon: 'bed-outline', route: '/admin/Accommodation', requiredRoles: [ROLE_ADMIN, ROLE_EB_HOSPITALITY, ROLE_EC_HOSPITALITY] },
  { label: 'Users Management', icon: 'people-outline', route: '/admin/Users', requiredRoles: [ROLE_ADMIN, ROLE_EB_EVENTS, ROLE_EB_OUTREACH, ROLE_EB_FINANCE, ROLE_EB_HOSPITALITY] },
  { label: 'Payment Management', icon: 'card-outline', route: '/admin/Transactions', requiredRoles: [ROLE_ADMIN, ROLE_EB_OUTREACH, ROLE_EB_FINANCE] },
  { label: 'Send Notification', icon: 'notifications-outline', route: '/admin/SendNotification', requiredRoles: [ROLE_ADMIN] },
  { label: 'Story Management', icon: 'film-outline', route: '/admin/StoryManagement', requiredRoles: [ROLE_ADMIN, ROLE_EB_MEDIA] },
  { label: 'Reel Management', icon: 'videocam-outline', route: '/admin/ReelsManagement', requiredRoles: [ROLE_ADMIN, ROLE_EB_MEDIA] },
  { label: 'Banner Management', icon: 'image-outline', route: '/admin/Banner', requiredRoles: [ROLE_ADMIN, ROLE_EB_EVENTS, ROLE_EB_MEDIA] },
  { label: 'App Configuration', icon: 'settings-outline', route: '/admin/AppConfig', requiredRoles: [ROLE_ADMIN] },
];

interface AdminDrawerProps {
  visible: boolean;
  onClose: () => void;
  userRoles?: string[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340);

const AdminDrawer: React.FC<AdminDrawerProps> = ({ visible, onClose, userRoles = [] }) => {
  const router = useRouter();
  const { isDark } = useThemeStore();

  const [isModalVisible, setIsModalVisible] = useState(visible);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setIsModalVisible(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
          speed: 14,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -DRAWER_WIDTH,
          useNativeDriver: true,
          bounciness: 0,
          speed: 16,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsModalVisible(false);
      });
    }
  }, [visible, slideAnim, fadeAnim]);

  const visibleItems = useMemo(() => {
    const normalized = (Array.isArray(userRoles) ? userRoles : []).map((r) =>
      typeof r === 'string' ? normalizeRole(r) : ''
    );

    // If admin, show all items
    if (normalized.includes(ROLE_ADMIN)) {
      return ALL_ITEMS;
    }

    // Filter items based on user's roles
    return ALL_ITEMS.filter((item) =>
      item.requiredRoles.some((r) => normalized.includes(normalizeRole(r)))
    );
  }, [userRoles]);

  const navigate = (route: string) => {
    onClose();
    setTimeout(() => {
      router.push(route as any);
    }, 220);
  };

  if (!isModalVisible) return null;

  const drawerBg = isDark ? '#18181B' : '#FFFFFF';
  const textPrimary = isDark ? '#FFFFFF' : '#111827';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const iconBg = isDark ? 'rgba(65, 184, 240, 0.14)' : 'rgba(65, 184, 240, 0.12)';

  return (
    <Modal
      visible={isModalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          opacity: fadeAnim,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: DRAWER_WIDTH,
          backgroundColor: drawerBg,
          paddingTop: 54,
          paddingHorizontal: 0,
          borderRightWidth: 1,
          borderRightColor: borderColor,
          shadowColor: '#000',
          shadowOffset: { width: 4, height: 0 },
          shadowOpacity: isDark ? 0.45 : 0.15,
          shadowRadius: 16,
          elevation: 16,
          transform: [{ translateX: slideAnim }],
        }}
      >
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 22,
            marginBottom: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: borderColor,
          }}
        >
          <View>
            <Text
              style={{
                fontFamily: 'Talina',
                color: textPrimary,
                fontSize: 22,
                letterSpacing: 0.5,
              }}
            >
              Admin Panel
            </Text>
            <Text
              style={{
                fontFamily: 'Poppins_500Medium',
                color: '#41B8F0',
                fontSize: 12,
                marginTop: 2,
              }}
            >
              Control Center
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={20} color={textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {visibleItems.map((item) => (
            <TouchableOpacity
              key={item.route}
              onPress={() => navigate(item.route)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: borderColor,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: iconBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}
              >
                <Ionicons name={item.icon as any} size={20} color="#41B8F0" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: 'Poppins_600SemiBold',
                    color: textPrimary,
                    fontSize: 14.5,
                  }}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={textSecondary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

export default AdminDrawer;
