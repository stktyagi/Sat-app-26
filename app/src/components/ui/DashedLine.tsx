// install: npm install react-native-svg
import React from "react";
import { View } from "react-native";
import { Svg, Line } from "react-native-svg";

export default function DashedHr({ height = 2, dash = [6, 6], color = "#333", className = "" }) {
  return (
    <View style={{ width: "100%", height }} className={className}>
      <Svg width="100%" height={height} viewBox="0 0 100 2" preserveAspectRatio="none">
        <Line
          x1="0"
          y1="1"
          x2="100"
          y2="1"
          stroke={color}
          strokeWidth={height}
          strokeDasharray={dash}
          strokeLinecap="butt"
        />
      </Svg>
    </View>
  );
}
