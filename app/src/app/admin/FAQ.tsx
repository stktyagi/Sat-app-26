import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { ArrowLeft, Plus, Edit, Trash2, HelpCircle } from "lucide-react-native";
import { FAQ } from "@/types/models";
import { getFAQs, createFAQ, updateFAQ, deleteFAQ } from "@/api/admin";
import Input from "@/components/ui/Input";
import { showAlert } from "@/components";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";


export default function FAQManagement() {
  const navigation = useAdminNavigation();
  const [data, setData] = useState<FAQ[]>([]);
  const [createData, setCreateData] = useState<Partial<FAQ>>({
    order: 0,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<FAQ>>({});
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);


  const loadData = async () => {
    const res = await getFAQs();
    console.log("FAQs:", res);
    setData(res);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteFAQ = async (item: FAQ) => {
    showAlert(
      "Delete FAQ",
      `Are you sure you want to delete this FAQ?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(item.id);
            const success = await deleteFAQ(item.id);
            if (success) {
              await loadData();
              showAlert("Success", "FAQ deleted successfully!");
            } else {
              showAlert("Error", "Failed to delete FAQ");
            }
            setDeletingId(null);
          },
        },
      ]
    );
  };

  const handleCreateFAQ = async () => {
    if (!createData.question || !createData.answer) {
      showAlert("Error", "Please fill in all required fields (Question, Answer)");
      return;
    }

    setCreating(true);
    try {
      await createFAQ({
        question: createData.question,
        answer: createData.answer,
        order: createData.order || 0,
      });

      await loadData();
      setCreateData({ order: 0 });
      showAlert("Success", "FAQ created successfully!");
    } catch (error) {
      showAlert("Error", "Failed to create FAQ");
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateFAQ = async () => {
    if (!editingId) return;

    try {
      const updates: Partial<FAQ> = {};
      if (editData.question) updates.question = editData.question;
      if (editData.answer) updates.answer = editData.answer;
      if (editData.order !== undefined) updates.order = editData.order;

      const success = await updateFAQ(editingId, updates);

      if (success) {
        await loadData();
        setEditingId(null);
        setEditData({});
        showAlert("Success", "FAQ updated successfully!");
      } else {
        showAlert("Error", "Failed to update FAQ");
      }
    } catch (error) {
      showAlert("Error", "Failed to update FAQ");
      console.error(error);
    }
  };

 
  return (
    <View className="flex-1 bg-transparent">
      {/* Header */}
      <View className="bg-[#EEB170] pt-6 rounded-b-2xl pb-6 px-6 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.navigate("Dashboard")}
          className="mr-4"
          activeOpacity={0.7}
        >
          <ArrowLeft size={28} color="#121212" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#121212] text-2xl ">FAQ Management</Text>
          <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#121212] text-sm opacity-80">
            Create and manage frequently asked questions
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Seed Data Button */} 
       
        {/* Create FAQ Section */}
        <View className="p-6">
          <View className="bg-[#FFFFFF66] rounded-2xl p-6 mb-6 border border-[#A0B3D0]">
            <Text className="text-[#EEB170] text-xl font-bold mb-4">
              Create New FAQ
            </Text>


            <Input
              label="Question"
              value={createData.question || ""}
              onChangeText={(value: string) => {
                setCreateData({
                  ...createData,
                  question: value,
                });
              }}
              placeholder="e.g., How do I register for events?"
              className="mb-4"
            />

            <Input
              label="Answer"
              value={createData.answer || ""}
              onChangeText={(value: string) => {
                setCreateData({
                  ...createData,
                  answer: value,
                });
              }}
              placeholder="Provide a detailed answer..."
              multiline
              numberOfLines={4}
              className="mb-4"
            />

            <Input
              label="Display Order"
              value={createData.order?.toString() || "0"}
              onChangeText={(value: string) => {
                setCreateData({
                  ...createData,
                  order: parseInt(value) || 0,
                });
              }}
              placeholder="0"
              keyboardType="numeric"
              className="mb-4"
            />


            <TouchableOpacity
              className={`${
                creating ? "bg-[#EEB170]/50" : "bg-[#EEB170]"
              } py-4 rounded-xl flex-row items-center justify-center`}
              disabled={creating}
              onPress={handleCreateFAQ}
              activeOpacity={0.7}
            >
              {creating ? (
                <>
                  <ActivityIndicator color="#121212" />
                  <Text className="text-[#121212] font-bold text-base ml-2">
                    Creating...
                  </Text>
                </>
              ) : (
                <>
                  <Plus size={20} color="#121212" />
                  <Text className="text-[#121212] font-bold text-base ml-2">
                    Create FAQ
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Existing FAQs */}
          <Text className="text-[#EEB170] text-xl font-bold mb-4">
            Active FAQs ({data.length})
          </Text>

          {loading ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color="#EEB170" />
              <Text className="text-[#2175C0] mt-4">Loading FAQs...</Text>
            </View>
          ) : data.length === 0 ? (
            <View className="bg-[#FFFFFF66] rounded-2xl p-8 items-center border border-[#A0B3D0]">
              <HelpCircle size={48} color="#555" />
              <Text className="text-[#2175C0] text-center mt-4">
                No FAQs yet. Create your first FAQ above!
              </Text>
            </View>
          ) : (
            data.map((item, index) => (
              <View
                key={index}
                className="bg-[#FFFFFF66] rounded-2xl p-5 mb-4 border border-[#A0B3D0]"
              >
                {editingId === item.id ? (
                  // Edit Mode
                  <View>
                    <Text className="text-[#EEB170] text-lg font-bold mb-4">
                      Editing FAQ
                    </Text>

                    <Input
                      label="Question"
                      value={editData.question || item.question}
                      onChangeText={(value: string) => {
                        setEditData({
                          ...editData,
                          question: value,
                        });
                      }}
                      className="mb-3"
                    />

                    <Input
                      label="Answer"
                      value={editData.answer || item.answer}
                      onChangeText={(value: string) => {
                        setEditData({
                          ...editData,
                          answer: value,
                        });
                      }}
                      multiline
                      numberOfLines={4}
                      className="mb-3"
                    />

                    <Input
                      label="Display Order"
                      value={editData.order?.toString() || item.order.toString()}
                      onChangeText={(value: string) => {
                        setEditData({
                          ...editData,
                          order: parseInt(value) || item.order,
                        });
                      }}
                      keyboardType="numeric"
                      className="mb-3"
                    />


                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        className="flex-1 bg-[#EEB170] py-3 rounded-xl items-center"
                        onPress={handleUpdateFAQ}
                        activeOpacity={0.7}
                      >
                        <Text className="text-[#121212] font-bold">Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-1 bg-[#FFFFFF66] py-3 rounded-xl items-center"
                        onPress={() => {
                          setEditingId(null);
                          setEditData({});
                        }}
                        activeOpacity={0.7}
                      >
                        <Text className="text-[#0C3572] font-bold">Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  // View Mode
                  <View>
                    <View className="flex-row items-start mb-3">
                      <HelpCircle size={24} color="#EEB170" className="mt-1" />
                      <View className="flex-1 ml-2">
                        <Text className="text-[#0C3572] text-lg font-bold">
                          {item.question}
                        </Text>
                        <Text className="text-[#2175C0] text-sm mt-1">
                          Order: {item.order}
                        </Text>
                      </View>
                    </View>

                    <View className="bg-[#FFFFFF66] rounded-lg p-3 mb-3">
                      <Text className="text-[#2175C0] text-sm">
                        {item.answer}
                      </Text>
                    </View>

                    <View className="bg-[#FFFFFF66] rounded-lg p-2 mb-3">
                      <Text className="text-gray-500 text-xs">
                        ID: {item.id}
                      </Text>
                    </View>

                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        className="flex-1 bg-[#EEB170] py-3 rounded-xl flex-row items-center justify-center"
                        onPress={() => {
                          setEditingId(item.id);
                          setEditData({
                            question: item.question,
                            answer: item.answer,
                            order: item.order,
                          });
                        }}
                        activeOpacity={0.7}
                      >
                        <Edit size={18} color="#121212" />
                        <Text className="text-[#121212] font-semibold ml-2">
                          Edit
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        className="flex-1 bg-[#E84054] py-3 rounded-xl flex-row items-center justify-center"
                        onPress={() => handleDeleteFAQ(item)}
                        disabled={deletingId === item.id}
                        activeOpacity={0.7}
                      >
                        {deletingId === item.id ? (
                          <>
                            <ActivityIndicator color="#fff" size="small" />
                            <Text className="text-[#0C3572] font-semibold ml-2">
                              Deleting...
                            </Text>
                          </>
                        ) : (
                          <>
                            <Trash2 size={18} color="#fff" />
                            <Text className="text-[#0C3572] font-semibold ml-2">
                              Delete
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
