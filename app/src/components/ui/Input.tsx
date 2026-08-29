// src/components/ui/Input.tsx
import React, { useState } from "react";
import { View, TextInput, Text, TouchableOpacity } from "react-native";

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  disabled?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  maxLength?: number;
  multiline?: boolean;
  numberOfLines?: number;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  className?: string;
  editable?: boolean;
}

const Input: React.FC<InputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  disabled = false,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
  maxLength,
  multiline = false,
  numberOfLines = 1,
  leftIcon,
  rightIcon,
  onRightIconPress,
  className = "",
  editable = true,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const inputClassName = [
    "border rounded-lg px-4 py-3 bg-[#121212]",
    isFocused ? "border-blue-600 bg-blue-50" : "border-[#2175C0] bg-white",
    error ? "border-red-500 bg-red-50" : "",
    disabled ? "bg-gray-100 text-gray-500" : "text-gray-800",
    leftIcon ? "pl-12" : "",
    rightIcon || secureTextEntry ? "pr-12" : "",
    multiline ? "text-top" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <View className="mb-4">
      {label && (
        <Text
          style={{ fontFamily: "Outfit_500Medium" }}
          className="text-lg text-[#0C3572] mb-2"
        >
          {label}
        </Text>
      )}

      <View className="relative">
        {leftIcon && (
          <View className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10">
            <Text
              style={{ fontFamily: "Outfit_400Regular" }}
              className="text-white text-lg"
            >
              {leftIcon}
            </Text>
          </View>
        )}

        <TextInput
          className={inputClassName}
          placeholder={placeholder}
          style={{
            fontFamily: "Outfit_500Medium",
            backgroundColor: "transparent",
            color: "#3B3B3B",
          }}
          value={value}
          onChangeText={onChangeText}
          editable={editable && !disabled}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          textAlignVertical={multiline ? "top" : "center"}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholderTextColor="#9CA3AF"
        />

        {(rightIcon || secureTextEntry) && (
          <TouchableOpacity
            className="absolute right-4 top-1/2 transform -translate-y-1/2"
            onPress={secureTextEntry ? handleTogglePassword : onRightIconPress}
            disabled={!secureTextEntry && !onRightIconPress}
          >
            <Text
              style={{ fontFamily: "Outfit_400Regular" }}
              className="text-white text-lg"
            >
              {secureTextEntry ? (showPassword ? "👁️" : "🙈") : rightIcon}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <Text
          style={{ fontFamily: "Outfit_400Regular" }}
          className="text-red-500 text-sm mt-1"
        >
          {error}
        </Text>
      )}
    </View>
  );
};

export default Input;
