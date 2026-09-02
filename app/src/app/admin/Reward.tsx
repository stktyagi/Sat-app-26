import { View, ScrollView, TouchableOpacity, Text } from "react-native";
import Header from "@/components/Header";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Reward } from "@/types/models";
import { getRewards } from "@/api/admin";
import { ArrowLeft } from "lucide-react-native";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";
function mapData(item: Reward, index: number) {
  return <View></View>;
}

export default function Banner() {
  const navigation = useAdminNavigation();
  const [data, setData] = useState<Reward[]>([]);

  useEffect(() => {
    (async () => {
      const res = await getRewards();
      setData(res);
    })();
  }, []);

  return (
    <View className="flex-1 flex-col m-0 bg-transparent">
       <View className="bg-[#EEB170] pt-4 rounded-b-2xl pb-6 px-6 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.navigate("Dashboard")}
          className="mr-4"
          activeOpacity={0.7}
        >
          <ArrowLeft size={28} color="#121212" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-[#121212] text-2xl font-bold">Reward Management</Text>
          <Text className="text-[#121212] text-sm opacity-80">
            Create and manage app rewards
          </Text>
        </View>
      </View>
      <ScrollView>{data.map((item, index) => mapData(item, index))}</ScrollView>
    </View>
  );
}
