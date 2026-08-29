import React from "react";
import { View, Image } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

export default function Header({ left, right }: { left?: React.ReactNode; right? : React.ReactNode }) {
  return <View 
  className="flex-row items-center bg-[#2D4593] relative justify-between px-4 h-[90px] w-full rounded-b-[2rem] overflow-hidden "
  style={{
        boxShadow: '0px 4px 25px #0C3572',
      }}
  >
    {left ?? <View></View>}
    <Image
        source={require("@/assets/mosaic.png")}
        className='absolute top-0'
        style={{ width: '120%', height:'100%', resizeMode: 'cover' }}
    />
    <View className='absolute left-1/2 -translate-x-1/2 ml-6 items-center justify-center' style={{ width: 180, height: 60, zIndex: 10 }}>
      <Svg height="150" width="220" style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="grad" cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
            <Stop offset="0%" stopColor="#FFE272" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#FFE272" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="220" height="150" fill="url(#grad)" />
      </Svg>
      <Image
        source={require("@/assets/logo.png")}
        style={{ width: 180, height: 60, resizeMode: 'contain' }}
      />
    </View>
    {right ?? <View></View>}
  </View>
}