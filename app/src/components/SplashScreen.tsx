// src/components/SplashScreen.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text,Animated, Dimensions,Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const SplashScreen = () => {
  
  return (
    <SafeAreaView className="flex-1 bg-[#FFBA00]">
      <View className="flex-1 relative justify-start items-center">
        <Image 
          source={require("@/assets/background.png")} 
          className="absolute h-full w-full"
        />
        {/* <Image
          source={require("@/assets/logo.png")}
          className="h-32 mt-[100px]"
          resizeMode="contain"
        /> */}
      </View>
    </SafeAreaView>
  );
};

export default SplashScreen;
