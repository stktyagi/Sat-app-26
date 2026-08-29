import { useRouter } from 'expo-router';
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from "lucide-react-native";
import { FAQ } from "@/types/models";
import Header from "@/components/layout/Header";
import { Ionicons } from "@expo/vector-icons";

export default function FAQScreen() {
  const router = useRouter();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    try {
      const publicFAQs: FAQ[] = [];
      setFaqs(publicFAQs);
    } catch (error) {
      console.error("Error loading FAQs:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (faqId: string) => {
    setExpandedId(expandedId === faqId ? null : faqId);
  };

  return (
    <View className="flex-1 bg-transparent">
      <Header />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View className="bg-transparent px-2">
          <View className="px-6 pt-8 pb-4 flex-row items-center justify-between">
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#0C3572" />
            </TouchableOpacity>
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#0C3572] text-3xl"
            >
                FAQs
            </Text>
            <View className="w-8" />
          </View>
        <View className="mt-4">

          {/* FAQs */}
          {loading ? (
              <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" color="#FFBA00" />
              <Text className="text-[#2175C0] mt-4">Loading FAQs...</Text>
            </View>
          ) : faqs.length === 0 ? (
              <View className="bg-[#FFFFFF66] rounded-2xl p-8 items-center">
              <HelpCircle size={48} color="#555" />
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#2175C0] text-center mt-4"
                >
                No FAQs available at the moment
              </Text>
            </View>
          ) : (
              faqs.map((faq, index) => (
                  <TouchableOpacity
                  key={faq.faqId}
                  onPress={() => toggleExpanded(faq.faqId)}
                  className="bg-[#FFFFFF66] rounded-2xl p-5 mb-4"
                  activeOpacity={0.7}
                  >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 mr-3">
                    <Text
                      style={{ fontFamily: "Outfit_600SemiBold" }}
                      className="text-[#0C3572] text-lg mb-1"
                      >
                      {faq.question}
                    </Text>
                  </View>
                  <View className="mt-1">
                    {expandedId === faq.faqId ? (
                        <ChevronUp size={24} color="#FFBA00" />
                    ) : (
                        <ChevronDown size={24} color="#FFBA00" />
                    )}
                  </View>
                </View>

                {expandedId === faq.faqId && (
                    <View className="mt-4 pt-4 border-t border-[#A0B3D0]">
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#2175C0] text-base leading-6"
                      >
                      {faq.answer}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
        )}
        </View>

          {/* Contact Support */}
          {!loading && faqs.length > 0 && (
            <View className="bg-[#FFFFFF66] rounded-2xl p-6 mt-4 mb-6">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#0C3572] text-lg mb-2"
              >
                Still have questions?
              </Text>
              <Text
                style={{ fontFamily: "Outfit_400Regular" }}
                className="text-[#2175C0] text-base"
              >
                Contact our support team at{" "}
                <Text className="text-[#FFBA00]">
                  styagi_be23@thapar.edu
                </Text>
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
