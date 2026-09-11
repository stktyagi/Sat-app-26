import React from "react";
import { View, Image } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

const SIDE_WIDTH = 60;

export default function Header({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2D4593',
        height: 90,
        width: '100%',
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        overflow: 'hidden',
        boxShadow: '0px 4px 25px #0C3572',
      } as any}
    >
      {/* Background mosaic */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: '-10%', width: '120%', height: '100%' }}>
        <Image
          source={require("@/assets/mosaic.png")}
          style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
        />
      </View>

      {/* Left slot — fixed width */}
      <View style={{ width: SIDE_WIDTH, paddingLeft: 16, zIndex: 20 }}>
        {left ?? <View />}
      </View>

      {/* Center logo — flex:1, truly centered */}
      <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 10, paddingTop: 30 }}>
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

      {/* Right slot — fixed width, aligned to end */}
      <View style={{ width: SIDE_WIDTH, paddingRight: 16, zIndex: 20, alignItems: 'flex-end' }}>
        {right ?? <View />}
      </View>
    </View>
  );
}