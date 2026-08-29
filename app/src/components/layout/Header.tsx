// src/components/layout/Header.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StatusBar, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Bot, Menu, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

interface HeaderType {
  
  userProfile?: any;
  setShowBottomNav?: (x: boolean) => void;
}


const Header: React.FC<HeaderType> = (
  { userProfile, setShowBottomNav }
) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      className="bg-[#2D4593] h-[90px] relative rounded-b-[2rem] overflow-hidden"
      style={{
        boxShadow: '0px 4px 25px #0C3572',
      }}
    >
      <Image
        source={require("@/assets/mosaic.png")}
        className='absolute'
        style={{ width: '100%', height:'100%', resizeMode: 'cover' }}
      />
      <View className="flex-1 flex-row w-full h-full items-center justify-between px-8" pointerEvents="box-none">
        {/* Drawer Menu Button - Only for non-user roles */}
        {Array.isArray(userProfile?.roles) && userProfile.roles.some((r: string) => r !== 'user') ? (
          <TouchableOpacity
            onPress={() => {
              // Drawer opening logic should be handled by Expo Router or state
              // if (setShowBottomNav) setShowBottomNav(false);
            }}
            className="items-center justify-center w-12 h-12 bg-[#FFFFFF40] rounded-full"
          >
            <Menu size={22} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View className='invisible w-12 h-12'>
            <Menu size={28} color="#FFBA00" />
          </View>
        )}


        <View className='relative bottom-1 items-center justify-center' style={{ width: 150, height: '100%', zIndex: 10 }}>
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
            source={require("@/assets/logo.png")}
            style={{ width: 150, height: '100%', resizeMode: 'contain' }}
          />
        </View>
      

        <TouchableOpacity
          className={`h-12 w-12 items-center justify-center bg-[#FFFFFF40] rounded-full ${userProfile ? 'flex' : 'invisible'}`}
          onPress={() => router.push('/Notifications')}
        >
          <View>
            <Bell size={22} fill="#fff" color="#fff" />
            {/* Notification dot indicator */}
            <View
              className="absolute bottom-[2px] -left-[3px] w-3 h-3 bg-[#E84054] rounded-full border border-white"
            />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Header;