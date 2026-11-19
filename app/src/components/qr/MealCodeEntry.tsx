import React, { useState } from "react";
import { View, Text, TextInput, Image } from "react-native";
import { verifyMealCode, MealVerifyResult } from "@/api/admin";
import { ActionButton, MEAL_REASON_TEXT, MEAL_SLOT_LABELS, DAY_LABELS, useHospitalityColors } from "./hospitalityUi";

/**
 * Staff-side fallback for an unscannable mess QR: the participant shows the
 * meal code from their app and staff type it here. A successful check logs
 * the meal exactly like a QR scan.
 */
const MealCodeEntry: React.FC = () => {
  const c = useHospitalityColors();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MealVerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clean = code.replace(/\s+/g, "").toUpperCase();

  const verify = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await verifyMealCode(clean));
    } catch (e: any) {
      setError(e?.message || "Could not verify code");
    } finally {
      setLoading(false);
    }
  };

  const ok = result?.allowed;
  const tone = ok ? c.success : c.danger;

  return (
    <View
      style={{
        marginTop: 20,
        padding: 16,
        borderRadius: 18,
        backgroundColor: c.cardBg,
        borderWidth: 1,
        borderColor: c.cardBorder,
      }}
    >
      <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 15, color: c.textPrimary }}>QR not scanning? Enter meal code</Text>
      <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: c.textSecondary, marginTop: 2, marginBottom: 10 }}>
        Ask the participant to tap "Can't scan? Show meal code" in their Meal Pass screen.
      </Text>
      <TextInput
        value={code}
        onChangeText={(t) => {
          setCode(t.toUpperCase());
          setResult(null);
          setError(null);
        }}
        placeholder="ABCD 1234"
        placeholderTextColor={c.textSecondary}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={9}
        onSubmitEditing={() => clean.length === 8 && verify()}
        style={{
          borderWidth: 1,
          borderColor: c.cardBorder,
          backgroundColor: c.inputBg,
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          color: c.textPrimary,
          fontSize: 22,
          letterSpacing: 4,
          textAlign: "center",
          fontWeight: "700",
        }}
      />
      <ActionButton label="Verify meal" icon="restaurant-outline" onPress={verify} loading={loading} disabled={clean.length !== 8} />

      {error ? (
        <Text style={{ fontFamily: "Poppins_500Medium", color: c.danger, fontSize: 13, marginTop: 10, textAlign: "center" }}>{error}</Text>
      ) : null}

      {result ? (
        <View
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: tone,
            backgroundColor: tone + "18",
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          {result.photoUrl ? <Image source={{ uri: result.photoUrl }} style={{ width: 56, height: 56, borderRadius: 12 }} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 16, color: tone }}>
              {ok ? "✓ Allowed" : "✗ Not allowed"}
            </Text>
            <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: c.textPrimary }}>{result.name}</Text>
            <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: c.textSecondary }}>{result.collegeName}</Text>
            <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: c.textSecondary }}>
              {[DAY_LABELS[result.day], MEAL_SLOT_LABELS[result.slot]].filter(Boolean).join(" · ")}
            </Text>
            {!ok ? (
              <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 12, color: tone, marginTop: 2 }}>
                {MEAL_REASON_TEXT[result.reason] || result.reason}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default MealCodeEntry;
