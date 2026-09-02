// src/app/admin/AdminReelUploadScreen.tsx
// Stubbed — expo-av is not installed in this project (uses expo-video instead).
// Re-implement with expo-video when reel upload is needed.
import React from 'react';
import { View, Text } from 'react-native';
import Header from '@/components/layout/Header';

export default function AdminReelUploadScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <Header />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 22, color: '#0C3572', marginBottom: 8 }}>
          Reel Upload
        </Text>
        <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 14, color: '#2175C0', textAlign: 'center' }}>
          Coming soon — this screen requires expo-video integration.
        </Text>
      </View>
    </View>
  );
}
