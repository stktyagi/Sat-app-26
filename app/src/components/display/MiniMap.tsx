import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MiniMapProps {
  onPress: () => void;
}

const img = require("@/assets/map.png");
export default function MiniMap({ onPress }: MiniMapProps) {
  const imgSource = Image.resolveAssetSource(img);
  return (
    <TouchableOpacity
      onPress={onPress}
      className="rounded-2xl my-6"
      activeOpacity={0.8}
    >
      <Image
        source={img}
        style={{
          width: '100%',
          height: undefined,
          aspectRatio: imgSource.width / imgSource.height,
        }}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );
}
