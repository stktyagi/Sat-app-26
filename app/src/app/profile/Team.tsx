import React, { useState, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, Image, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import Header from '@/components/layout/Header';
import { Team } from '@/data/Team';

const TeamMemberCard = memo(({ member, activeTab }: { member: any, activeTab: string }) => (
  <View style={{ width: '48%' }} className="mb-4">
    <View className="bg-[#FFFFFF] rounded-2xl p-4 flex-col items-center justify-center border-[1px]">
      <Image 
        source={{ uri: member.imageUrl }} 
        className="w-20 h-20 rounded-full bg-[#FFFFFF66]" 
      />
      <View className='items-center mt-3 flex-col'>
        <Text 
          style={{ fontFamily: 'Outfit_700Bold' }} 
          ellipsizeMode='tail' 
          numberOfLines={1} 
          className="text-[#0C3572] text-lg"
        >
          {member.name}
        </Text>
        <Text 
          style={{ fontFamily: 'Outfit_500Medium' }} 
          className="text-[#2175C0] text-sm"
        >
          {activeTab === 'app'
            ? member.position
            : ((member.position || '').trim()
                .split(/\s+/)
                .filter(Boolean)
                .map((w: string) => w[0])
                .join('')
                .toUpperCase())}
        </Text>
      </View>
    </View>
  </View>
));

const TeamScreen = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('sat'); // 'sat' or 'app'

  const teamData = activeTab === 'sat' ? Team : [];

  const TabButton = ({ title, tabKey }: { title: string, tabKey: string }) => (
    <TouchableOpacity
      className={`flex-1 items-center py-3 border-b-2 ${
        activeTab === tabKey ? 'border-[#FFBA00]' : 'border-transparent'
      }`}
      onPress={() => setActiveTab(tabKey)}
    >
      <Text
        style={{ fontFamily: 'Outfit_600SemiBold' }}
        className={`text-lg ${
          activeTab === tabKey ? 'text-[#FFBA00]' : 'text-[#2175C0]'
        }`}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderItem = useCallback(({ item }: { item: any }) => (
    <TeamMemberCard member={item} activeTab={activeTab} />
  ), [activeTab]);

  return (
    <View className="flex-1 bg-transparent">
      <Header />

      <View className="flex-row items-center justify-between mb-4 px-6 mt-6">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#0C3572" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0C3572] text-2xl">Our Team</Text>
        <View className="w-12" />
      </View>

      {/* Tabs */}
      <View className="flex-row justify-around mb-4 px-6">
        <TabButton title="Sat Team" tabKey="sat" />
        <TabButton title="App Team" tabKey="app" />
      </View>

      <FlatList
        data={teamData}
        keyExtractor={(item, index) => item.name + index}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
};

export default TeamScreen;
