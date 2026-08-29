// src/components/layout/Header.tsx
import React, { useState } from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { Menu, Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useUserStore } from '@/state/userStore';
import AdminDrawer from './AdminDrawer';

interface HeaderType {
  userProfile?: any;
  setShowBottomNav?: (x: boolean) => void;
}

const Header: React.FC<HeaderType> = ({ userProfile: userProfileProp, setShowBottomNav }) => {
  const router = useRouter();
  const { userData } = useUserStore();
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Use prop if passed, otherwise fall back to store (so Header works everywhere)
  const userProfile = userProfileProp ?? userData;

  const roles: string[] = Array.isArray(userProfile?.roles) ? userProfile.roles : [];
  const isAdmin = roles.some((r) => r !== 'user');

  return (
    <>
      <View
        className="bg-[#2D4593] h-[90px] relative rounded-b-[2rem] overflow-hidden"
        style={{ boxShadow: '0px 4px 25px #0C3572' } as any}
      >
        <Image
          source={require('@/assets/mosaic.png')}
          className="absolute"
          style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
        />
        <View className="flex-1 flex-row w-full h-full items-center justify-between px-8" pointerEvents="box-none">

          {/* Drawer Menu Button — only for admins/non-user roles */}
          {isAdmin ? (
            <TouchableOpacity
              onPress={() => setDrawerVisible(true)}
              className="items-center justify-center w-12 h-12 bg-[#FFFFFF40] rounded-full"
            >
              <Menu size={22} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View className="w-12 h-12" />
          )}

          {/* Logo */}
          <View
            className="relative bottom-1 items-center justify-center"
            style={{ width: 150, height: '100%', zIndex: 10 }}
          >
            <Svg height="150" width="200" style={{ position: 'absolute' }}>
              <Defs>
                <RadialGradient id="gradHeader" cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
                  <Stop offset="0%" stopColor="#FFE272" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#FFE272" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="200" height="150" fill="url(#gradHeader)" />
            </Svg>
            <Image
              source={require('@/assets/logo.png')}
              style={{ width: 150, height: '100%', resizeMode: 'contain' }}
            />
          </View>

          {/* Notifications */}
          <TouchableOpacity
            className={`h-12 w-12 items-center justify-center bg-[#FFFFFF40] rounded-full ${userProfile ? 'flex' : 'invisible'}`}
            onPress={() => router.push('/notifications')}
          >
            <View>
              <Bell size={22} fill="#fff" color="#fff" />
              <View className="absolute bottom-[2px] -left-[3px] w-3 h-3 bg-[#E84054] rounded-full border border-white" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Admin Drawer */}
      {isAdmin && (
        <AdminDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          userRoles={roles}
        />
      )}
    </>
  );
};

export default Header;