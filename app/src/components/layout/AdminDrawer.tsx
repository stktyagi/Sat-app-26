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

interface DrawerItem {
  label: string;
  icon: string;
  route: string;
  requiredRoles: string[];
}

const ALL_ITEMS: DrawerItem[] = [
  { label: 'QR Scanner',        icon: 'qr-code-outline',    route: '/admin/QRScanner',           requiredRoles: ['admin', 'event_coordinator', 'executive_committee', 'core_member', 'event_admin', 'hospitality_admin', 'hospitality_member', 'outreach_admin', 'outreach_member'] },
  { label: 'Event Management',  icon: 'calendar-outline',   route: '/admin/EventsManagement',    requiredRoles: ['admin', 'event_coordinator', 'event_admin', 'outreach_admin', 'outreach_member', 'hospitality_admin', 'hospitality_member'] },
  { label: 'Banner Management', icon: 'image-outline',      route: '/admin/Banner',              requiredRoles: ['admin', 'media'] },
  { label: 'Content Management',icon: 'stats-chart-outline',route: '/admin/Poll',                requiredRoles: ['admin', 'eb_member', 'event_admin'] },
  { label: 'Venue Management',  icon: 'location-outline',   route: '/admin/Venue',               requiredRoles: ['admin', 'event_admin'] },
  { label: 'FAQ Management',    icon: 'help-circle-outline', route: '/admin/FAQ',                requiredRoles: ['admin', 'eb_member'] },
  { label: 'Accommodation',     icon: 'bed-outline',        route: '/admin/Accommodation',       requiredRoles: ['admin', 'hospitality_member', 'hospitality_admin', 'outreach_admin'] },
  { label: 'Users Management',  icon: 'people-outline',     route: '/admin/Users',               requiredRoles: ['admin', 'event_admin', 'hospitality_admin', 'outreach_admin'] },
  { label: 'Transactions',      icon: 'card-outline',       route: '/admin/Transactions',        requiredRoles: ['admin', 'finance'] },
  { label: 'Send Notification', icon: 'notifications-outline', route: '/admin/SendNotification', requiredRoles: ['admin', 'eb_member'] },
  { label: 'Reel Upload',       icon: 'film-outline',       route: '/admin/AdminReelUploadScreen', requiredRoles: ['admin', 'media'] },
];

interface AdminDrawerProps {
  visible: boolean;
  onClose: () => void;
  userRoles: string[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

const AdminDrawer: React.FC<AdminDrawerProps> = ({ visible, onClose, userRoles }) => {
  const router = useRouter();
  
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
          speed: 12, // adjust speed for a snappy feel
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -DRAWER_WIDTH,
          useNativeDriver: true,
          bounciness: 0,
          speed: 14,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start(() => {
        setIsModalVisible(false);
      });
    }
  }, [visible, slideAnim, fadeAnim]);

  const visibleItems = useMemo(
    () => ALL_ITEMS.filter(item => item.requiredRoles.some(r => userRoles.includes(r))),
    [userRoles],
  );

  const navigate = (route: string) => {
    onClose();
    // Allow time for the drawer to close before pushing the route
    setTimeout(() => {
      router.push(route as any);
    }, 250);
  };

  if (!isModalVisible) return null;

  return (
    <Modal
      visible={isModalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', opacity: fadeAnim }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
        />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: DRAWER_WIDTH,
          backgroundColor: '#0C3572',
          paddingTop: 60,
          paddingHorizontal: 0,
          transform: [{ translateX: slideAnim }],
        }}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: 'Outfit_700Bold', color: '#EEB170', fontSize: 22 }}>Admin Panel</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {visibleItems.map(item => (
            <TouchableOpacity
              key={item.route}
              onPress={() => navigate(item.route)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 24,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <Ionicons name={item.icon as any} size={22} color="#EEB170" style={{ marginRight: 16 }} />
              <Text style={{ fontFamily: 'Outfit_500Medium', color: '#fff', fontSize: 16 }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

export default AdminDrawer;

