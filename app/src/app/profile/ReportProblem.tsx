import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  StatusBar,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { setStringAsync } from "expo-clipboard";
import { useThemeStore } from "@/state/themeStore";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_NODES,
  FEST_COORDINATORS,
  SupportNode,
  SupportCategory,
} from "@/data/supportDecisionTree";

export default function ReportProblemScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();

  // Navigation state within the decision tree
  const [history, setHistory] = useState<string[]>([]);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Theme-aware color variables
  const bgColor = isDark ? "#131316" : "#F3F4F6";
  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "#2A2A30" : "#E5E7EB";
  const textColor = isDark ? "#FFFFFF" : "#111827";
  const subTextColor = isDark ? "#9CA3AF" : "#6B7280";
  const accentBlue = "#41B8F0";
  const warningAmber = "#F59E0B";

  // Current node in traversal
  const currentNodeId = history.length > 0 ? history[history.length - 1] : null;
  const currentNode: SupportNode | null = currentNodeId
    ? SUPPORT_NODES[currentNodeId] || null
    : null;

  // Active category lookup
  const activeCategory: SupportCategory | undefined = useMemo(() => {
    if (!currentNode) return undefined;
    return SUPPORT_CATEGORIES.find((cat) => cat.id === currentNode.category);
  }, [currentNode]);

  // Navigation handlers
  const handleSelectCategory = (cat: SupportCategory) => {
    setHistory([cat.rootNodeId]);
  };

  const handleSelectOption = (targetNodeId: string) => {
    if (!SUPPORT_NODES[targetNodeId]) {
      Alert.alert("Notice", "This section is currently being updated.");
      return;
    }
    setHistory((prev) => [...prev, targetNodeId]);
  };

  const handleBack = () => {
    if (history.length > 1) {
      setHistory((prev) => prev.slice(0, -1));
    } else if (history.length === 1) {
      setHistory([]);
    } else {
      router.back();
    }
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert("Unable to Call", `Please dial ${phone} directly on your phone.`);
    });
  };

  const handleCopyPhone = async (phone: string) => {
    await setStringAsync(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2500);
  };

  const handleActionRoute = (route: string) => {
    try {
      router.push(route as any);
    } catch {
      // Fallback
    }
  };


  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* ─────────────────────────────────────────────────────────────────────────────
          TOP APP HEADER (Clean Back button + Title)
      ───────────────────────────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: Math.max(insets.top + 8, 44),
          paddingBottom: 16,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: bgColor,
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
        }}
      >
        <TouchableOpacity
          onPress={handleBack}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: cardBorder,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={textColor} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: "Talina",
              fontSize: 22,
              color: textColor,
              letterSpacing: 0.5,
            }}
            numberOfLines={1}
          >
            HELP & SUPPORT
          </Text>
          <Text
            style={{
              fontFamily: "Poppins_500Medium",
              fontSize: 12,
              color: accentBlue,
            }}
            numberOfLines={1}
          >
            {activeCategory?.title || "Saturnalia Support"}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Phone Copied Notification Banner */}
        {copiedPhone && (
          <View
            style={{
              backgroundColor: "#22C55E",
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 13,
                color: "#FFFFFF",
                marginLeft: 8,
              }}
            >
              Phone number copied to clipboard!
            </Text>
          </View>
        )}

        {/* ─────────────────────────────────────────────────────────────────────────────
            VIEW MODE 1: ROOT CATEGORIES & FREQUENT TOPICS
        ───────────────────────────────────────────────────────────────────────────── */}
        {history.length === 0 ? (
          <View>

            {SUPPORT_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={{
                  backgroundColor: cardBg,
                  borderWidth: 1,
                  borderColor: cardBorder,
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 10,
                  flexDirection: "row",
                  alignItems: "center",
                }}
                activeOpacity={0.7}
                onPress={() => handleSelectCategory(cat)}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: isDark ? "rgba(65, 184, 240, 0.15)" : "#E0F2FE",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 14,
                  }}
                >
                  <Ionicons name={cat.icon as any} size={22} color={accentBlue} />
                </View>

                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      color: textColor,
                      fontSize: 15,
                    }}
                  >
                    {cat.title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Poppins_400Regular",
                      color: subTextColor,
                      fontSize: 12,
                      marginTop: 2,
                    }}
                    numberOfLines={2}
                  >
                    {cat.shortDesc}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={subTextColor} />
              </TouchableOpacity>
            ))}
          </View>
        ) : currentNode ? (
          /* ─────────────────────────────────────────────────────────────────────────────
              VIEW MODE 2: ACTIVE NODE (QUESTION / RESOLUTION / CONTACT)
          ───────────────────────────────────────────────────────────────────────────── */
          <View>
            {/* ─────────────────────────────────────────────────────────────────────────
                SUB-VIEW: QUESTION NODE
            ───────────────────────────────────────────────────────────────────────── */}
            {currentNode.type === "question" && (
              <View>
                {/* Question Header Card */}
                <View
                  style={{
                    backgroundColor: cardBg,
                    borderWidth: 1,
                    borderColor: cardBorder,
                    borderRadius: 20,
                    padding: 18,
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Poppins_700Bold",
                      fontSize: 18,
                      color: textColor,
                      marginBottom: 4,
                    }}
                  >
                    {currentNode.title}
                  </Text>

                  {currentNode.subtitle ? (
                    <Text
                      style={{
                        fontFamily: "Poppins_400Regular",
                        fontSize: 13,
                        color: subTextColor,
                        lineHeight: 20,
                      }}
                    >
                      {currentNode.subtitle}
                    </Text>
                  ) : null}
                </View>

                {/* Option Cards */}
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    fontSize: 13,
                    color: subTextColor,
                    marginBottom: 10,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Choose an option:
                </Text>

                {currentNode.options?.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={{
                      backgroundColor: cardBg,
                      borderWidth: 1,
                      borderColor: cardBorder,
                      borderRadius: 18,
                      padding: 16,
                      marginBottom: 10,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                    activeOpacity={0.7}
                    onPress={() => handleSelectOption(option.targetNodeId)}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: isDark ? "#26262B" : "#F3F4F6",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 14,
                      }}
                    >
                      <Ionicons
                        name={(option.icon as any) || "help-outline"}
                        size={18}
                        color={accentBlue}
                      />
                    </View>

                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text
                        style={{
                          fontFamily: "Poppins_600SemiBold",
                          color: textColor,
                          fontSize: 14,
                        }}
                      >
                        {option.label}
                      </Text>
                      {option.description ? (
                        <Text
                          style={{
                            fontFamily: "Poppins_400Regular",
                            color: subTextColor,
                            fontSize: 12,
                            marginTop: 2,
                            lineHeight: 17,
                          }}
                        >
                          {option.description}
                        </Text>
                      ) : null}
                    </View>

                    <Ionicons name="chevron-forward" size={18} color={subTextColor} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ─────────────────────────────────────────────────────────────────────────
                SUB-VIEW: DIRECT RESOLUTION NODE
            ───────────────────────────────────────────────────────────────────────── */}
            {currentNode.type === "resolution" && currentNode.resolution && (
              <View>
                <View
                  style={{
                    backgroundColor: cardBg,
                    borderWidth: 1,
                    borderColor: cardBorder,
                    borderRadius: 24,
                    paddingHorizontal: 16,
                    paddingVertical: 18,
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Poppins_700Bold",
                      fontSize: 18,
                      color: textColor,
                      marginBottom: 8,
                    }}
                  >
                    {currentNode.resolution.title}
                  </Text>

                  <Text
                    style={{
                      fontFamily: "Poppins_400Regular",
                      fontSize: 14,
                      color: subTextColor,
                      lineHeight: 21,
                      marginBottom: 16,
                    }}
                  >
                    {currentNode.resolution.description}
                  </Text>

                  {/* Meal Schedule Beautiful Layout */}
                  {currentNode.resolution.mealSchedule && currentNode.resolution.mealSchedule.length > 0 ? (
                    <View style={{ marginBottom: 16 }}>
                      {currentNode.resolution.mealSchedule.map((group, gIdx) => (
                        <View
                          key={gIdx}
                          style={{
                            marginBottom: gIdx === currentNode.resolution!.mealSchedule!.length - 1 ? 0 : 14,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginBottom: 8,
                              marginTop: gIdx > 0 ? 4 : 0,
                            }}
                          >
                            <View
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: isDark ? "rgba(65, 184, 240, 0.18)" : "#E0F2FE",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 6,
                              }}
                            >
                              <Ionicons
                                name={gIdx === 0 ? "calendar-outline" : "sparkles-outline"}
                                size={12}
                                color={accentBlue}
                              />
                            </View>
                            <Text
                              style={{
                                fontFamily: "Poppins_700Bold",
                                fontSize: 13,
                                color: textColor,
                                letterSpacing: 0.2,
                              }}
                            >
                              {group.dayLabel}
                            </Text>
                          </View>

                          {group.slots.map((slot, sIdx) => (
                            <View
                              key={sIdx}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                flexWrap: "wrap",
                                rowGap: 6,
                                backgroundColor: isDark ? "#24242A" : "#F8FAFC",
                                borderRadius: 14,
                                borderWidth: 1,
                                borderColor: cardBorder,
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                marginBottom: sIdx === group.slots.length - 1 ? 0 : 6,
                              }}
                            >
                              <View style={{ flexDirection: "row", alignItems: "center" }}>
                                <View
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    backgroundColor: isDark ? "rgba(65, 184, 240, 0.15)" : "#E0F2FE",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 9,
                                  }}
                                >
                                  <Ionicons
                                    name={(slot.icon as any) || "restaurant-outline"}
                                    size={14}
                                    color={accentBlue}
                                  />
                                </View>
                                <Text
                                  style={{
                                    fontFamily: "Poppins_600SemiBold",
                                    fontSize: 13.5,
                                    color: textColor,
                                  }}
                                >
                                  {slot.name}
                                </Text>
                              </View>

                              <View
                                style={{
                                  backgroundColor: isDark ? "rgba(65, 184, 240, 0.12)" : "#E0F2FE",
                                  borderWidth: 1,
                                  borderColor: isDark ? "rgba(65, 184, 240, 0.25)" : "#BAE6FD",
                                  paddingHorizontal: 10,
                                  paddingVertical: 4,
                                  borderRadius: 8,
                                }}
                              >
                                <Text
                                  style={{
                                    fontFamily: "Poppins_600SemiBold",
                                    fontSize: 12,
                                    color: accentBlue,
                                    letterSpacing: 0.2,
                                  }}
                                >
                                  {slot.time}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  ) : currentNode.resolution.steps?.length > 0 ? (
                    /* Step-by-Step Instructions */
                    <View style={{ marginBottom: 16 }}>
                      <Text
                        style={{
                          fontFamily: "Poppins_600SemiBold",
                          fontSize: 14,
                          color: textColor,
                          marginBottom: 10,
                        }}
                      >
                        What to do:
                      </Text>

                      {currentNode.resolution.steps.map((step, idx) => (
                        <View
                          key={idx}
                          style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            marginBottom: 8,
                          }}
                        >
                          <View
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              backgroundColor: accentBlue,
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 10,
                              marginTop: 2,
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: "Poppins_700Bold",
                                fontSize: 11,
                                color: "#FFFFFF",
                              }}
                            >
                              {idx + 1}
                            </Text>
                          </View>
                          <Text
                            style={{
                              flex: 1,
                              fontFamily: "Poppins_400Regular",
                              fontSize: 13,
                              color: textColor,
                              lineHeight: 20,
                            }}
                          >
                            {step}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}



                  {/* Warning Callout */}
                  {currentNode.resolution.warning && (
                    <View
                      style={{
                        backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "#FEF3C7",
                        borderRadius: 14,
                        padding: 12,
                        marginBottom: 16,
                        borderLeftWidth: 3,
                        borderLeftColor: warningAmber,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                        <Ionicons name="warning-outline" size={16} color={warningAmber} />
                        <Text
                          style={{
                            fontFamily: "Poppins_600SemiBold",
                            fontSize: 12,
                            color: warningAmber,
                            marginLeft: 6,
                          }}
                        >
                          Important Note
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontFamily: "Poppins_400Regular",
                          fontSize: 12,
                          color: isDark ? "#FCD34D" : "#92400E",
                          lineHeight: 18,
                        }}
                      >
                        {currentNode.resolution.warning}
                      </Text>
                    </View>
                  )}

                  {/* Direct Action Button */}
                  {currentNode.resolution.actionText && currentNode.resolution.actionRoute && (
                    <TouchableOpacity
                      onPress={() => handleActionRoute(currentNode.resolution!.actionRoute!)}
                      style={{
                        backgroundColor: accentBlue,
                        borderRadius: 14,
                        paddingVertical: 12,
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="arrow-forward-circle" size={18} color="#FFFFFF" />
                      <Text
                        style={{
                          fontFamily: "Poppins_600SemiBold",
                          color: "#FFFFFF",
                          fontSize: 14,
                          marginLeft: 8,
                        }}
                      >
                        {currentNode.resolution.actionText}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Escalation to Coordinator if still unresolved */}
                {currentNode.resolution.escalationNodeId && (
                  <View
                    style={{
                      backgroundColor: cardBg,
                      borderWidth: 1,
                      borderColor: cardBorder,
                      borderRadius: 18,
                      padding: 16,
                      marginBottom: 14,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      <Ionicons name="headset-outline" size={20} color={warningAmber} />
                    </View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 13, color: textColor }}>
                        Still unresolved?
                      </Text>
                      <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 11, color: subTextColor }}>
                        Connect with the fest coordinator for help.
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleSelectOption(currentNode.resolution!.escalationNodeId!)}
                      style={{
                        backgroundColor: isDark ? "#26262B" : "#F3F4F6",
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: cardBorder,
                      }}
                    >
                      <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 12, color: accentBlue }}>
                        Contact Coordinator
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ─────────────────────────────────────────────────────────────────────────
                SUB-VIEW: CONTACT SUPPORT NODE
            ───────────────────────────────────────────────────────────────────────── */}
            {currentNode.type === "contact" && currentNode.contact && (
              <View>
                {(() => {
                  const coordIds = currentNode.contact.coordinatorIds ||
                    (currentNode.contact.coordinatorId ? [currentNode.contact.coordinatorId] : []);
                  const coords = coordIds
                    .map((id) => FEST_COORDINATORS[id])
                    .filter(Boolean);

                  return (
                    <View
                      style={{
                        backgroundColor: cardBg,
                        borderWidth: 1,
                        borderColor: cardBorder,
                        borderRadius: 24,
                        padding: 20,
                        marginBottom: 16,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Poppins_700Bold",
                          fontSize: 18,
                          color: textColor,
                          marginBottom: 6,
                        }}
                      >
                        {currentNode.contact.title}
                      </Text>

                      {currentNode.contact.reason ? (
                        <Text
                          style={{
                            fontFamily: "Poppins_400Regular",
                            fontSize: 13,
                            color: subTextColor,
                            lineHeight: 20,
                            marginBottom: 16,
                          }}
                        >
                          {currentNode.contact.reason}
                        </Text>
                      ) : null}

                      {coords.map((coord) => (
                        <View
                          key={coord.id}
                          style={{
                            backgroundColor: isDark ? "#24242A" : "#F8FAFC",
                            borderRadius: 18,
                            borderWidth: 1,
                            borderColor: cardBorder,
                            padding: 16,
                            marginBottom: 12,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Poppins_700Bold",
                              fontSize: 16,
                              color: textColor,
                              marginBottom: 8,
                            }}
                          >
                            {coord.name}
                          </Text>

                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 12,
                            }}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center" }}>
                              <Ionicons name="call-outline" size={16} color={accentBlue} />
                              <Text
                                style={{
                                  fontFamily: "Poppins_600SemiBold",
                                  fontSize: 15,
                                  color: textColor,
                                  marginLeft: 8,
                                  letterSpacing: 0.5,
                                }}
                              >
                                {coord.phone}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleCopyPhone(coord.phone)}
                              style={{ padding: 4 }}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Ionicons name="copy-outline" size={18} color={accentBlue} />
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity
                            style={{
                              backgroundColor: accentBlue,
                              paddingVertical: 12,
                              borderRadius: 14,
                              flexDirection: "row",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                            activeOpacity={0.8}
                            onPress={() => handleCall(coord.phone)}
                          >
                            <Ionicons name="call" size={16} color="#FFFFFF" />
                            <Text
                              style={{
                                fontFamily: "Poppins_700Bold",
                                color: "#FFFFFF",
                                fontSize: 14,
                                marginLeft: 8,
                              }}
                            >
                              Call Now
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
