// src/components/registration/CustomFieldsForm.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../ui/Button';

interface CustomField {
    fieldId: string;
    label: string;
    type: 'text' | 'link' | 'number' | 'select' | 'multi-select';
    isRequired: boolean;
    placeholder?: string;
    options?: string[];
    minValue?: number;
    maxValue?: number;
}

interface CustomFieldsFormProps {
    fields: CustomField[];
    isLoading: boolean;
    submitButtonText: string;
    initialData?: Record<string, any>;
    onSubmit: (formData: Record<string, any>) => void;
    children?: React.ReactNode; // To inject extra content like referral codes or invite codes
}

// Validation logic (pure function, can be moved to a utils file)
const isResponseValid = (field: CustomField, response: any): boolean => {
    const expression = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    const linkRegex = new RegExp(expression);


    if (
        field.isRequired &&
        (response === undefined ||
            (typeof response === 'string' && response.trim() === '') ||
            (Array.isArray(response) && response.length === 0))
    ) {
        return false;
    }
    if (
        response === undefined ||
        (typeof response === 'string' && response.trim() === '') ||
        (Array.isArray(response) && response.length === 0)
    ) {
        return true;
    }

    if (field.type === 'number') {
        const num = parseFloat(response);
        if (isNaN(num)) return false;
        if (field.maxValue !== undefined && num > field.maxValue) return false;
        if (field.minValue !== undefined && num < field.minValue) return false;
        return true;
    }
    if (field.type === 'link') {
        return !!response.match(linkRegex);
    }
    if (field.type === 'select' && field.options) {
        return field.options.includes(response);
    }
    if (field.type === 'multi-select' && Array.isArray(response) && field.options) {
        for (const optionSelected of response) {
            if (!field.options.includes(optionSelected)) return false;
        }
    }
    return true;
};


const CustomFieldsForm: React.FC<CustomFieldsFormProps> = ({
    fields,
    isLoading,
    submitButtonText,
    initialData = {},
    onSubmit,
    children,
}) => {
    const [customFieldsData, setCustomFieldsData] = useState<Record<string, any>>(initialData);
    
    

    const renderField = (field: CustomField) => {
        const value = customFieldsData[field.fieldId];

        switch (field.type) {
            case "text":
            case "link":
                return (
                    <TextInput
                        value={value || ""}
                        onChangeText={(text) => {
                            setCustomFieldsData({
                                ...customFieldsData,
                                [field.fieldId]: text,
                            });
                        }}
                        placeholder={field.placeholder || field.label}
                        placeholderTextColor="#666"
                        style={{ fontFamily: "Outfit_500Medium" }}
                        className="bg-[#2a2a2a] text-[#0C3572] px-4 py-3 rounded-lg"
                        keyboardType={field.type === "link" ? "url" : "default"}
                        autoCapitalize={field.type === "link" ? "none" : "sentences"}
                    />
                );

            case "number":
                return (
                    <>
                        <TextInput
                            value={value?.toString() || ""}
                            onChangeText={(text) => {
                                const numValue = text ? parseFloat(text) : "";
                                setCustomFieldsData({
                                    ...customFieldsData,
                                    [field.fieldId]: numValue,
                                });
                            }}
                            style={{ fontFamily: "Outfit_500Medium" }}
                            placeholder={field.placeholder || field.label}
                            placeholderTextColor="#666"
                            className="bg-[#2a2a2a] text-[#0C3572] px-4 py-3 rounded-lg"
                            keyboardType="numeric"
                        />
                        <Text
                            style={{ fontFamily: "Outfit_500Medium" }}
                            className="text-[#2175C0] mt-2 text-xs"
                        >
                            Minimum value of {field.minValue}, Maximum value of{" "}
                            {field.maxValue}
                        </Text>
                    </>
                );

            case "select":
                return (
                    <View>
                        {customFieldsData[field.fieldId] ? (
                            <TouchableOpacity
                                onPress={() => {
                                    setCustomFieldsData({
                                        ...customFieldsData,
                                        [field.fieldId]: undefined,
                                    });
                                }}
                            >
                                <Text
                                    style={{ fontFamily: "Outfit_500Medium" }}
                                    className="text-[#2175C0] mt-2 text-xs ml-auto"
                                >
                                    Clear selection
                                </Text>
                            </TouchableOpacity>
                        ) : null}
                        <Text
                            style={{ fontFamily: "Outfit_500Medium" }}
                            className="text-[#2175C0] mb-2"
                        >
                            {value || `Select ${field.label}`}
                        </Text>
                        <View className="flex gap-3">
                            {field.options?.map((option: string, idx: number) => (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() =>
                                        setCustomFieldsData({
                                            ...customFieldsData,
                                            [field.fieldId]: option,
                                        })
                                    }
                                    className={`px-4 py-3 rounded-lg border ${value === option
                                            ? "bg-yellow-400/20 border-yellow-400"
                                            : "bg-[#2a2a2a] border-gray-600"
                                        }`}
                                >
                                    <Text
                                        style={{ fontFamily: "Outfit_500Medium" }}
                                        className={`${value === option ? "text-yellow-400" : "text-[#0C3572]"
                                            }`}
                                    >
                                        {option}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );

            case "multi-select":
                return (
                    <View className="flex gap-3">
                        {field.options?.map((option: string, idx: number) => {
                            const currentValues = value || [];
                            const isSelected = currentValues.includes(option);

                            return (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() => {
                                        let newValues;
                                        if (isSelected) {
                                            newValues = currentValues.filter(
                                                (v: string) => v !== option
                                            );
                                        } else {
                                            newValues = [...currentValues, option];
                                        }
                                        setCustomFieldsData({
                                            ...customFieldsData,
                                            [field.fieldId]: newValues,
                                        });
                                    }}
                                    className={`flex-row items-center px-4 py-3 rounded-lg border ${isSelected
                                            ? "bg-yellow-400/20 border-yellow-400"
                                            : "bg-[#2a2a2a] border-gray-600"
                                        }`}
                                >
                                    <View
                                        className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${isSelected
                                                ? "bg-yellow-400 border-yellow-400"
                                                : "border-gray-600"
                                            }`}
                                    >
                                        {isSelected && (
                                            <Ionicons name="checkmark" size={16} color="#1a1a1a" />
                                        )}
                                    </View>
                                    <Text
                                        style={{ fontFamily: "Outfit_500Medium" }}
                                        className={`${isSelected ? "text-yellow-400" : "text-[#0C3572]"
                                            }`}
                                    >
                                        {option}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                );

            default:
                return null;
        }
    };

    const isFormValid = fields.every(field => isResponseValid(field, customFieldsData[field.fieldId]));

    return (
        <View>
            {fields.map((field) => (
                <View key={field.fieldId} className="mb-4">
                    <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0] mb-2">
                        {field.label}
                        {field.isRequired && <Text className="text-red-400"> *</Text>}
                    </Text>
                    {renderField(field)}
                </View>
            ))}

            {/* Render any additional content passed as children */}
            {children}

            <View className="mt-6">
                <Button
                    title={isLoading ? 'Submitting...' : submitButtonText}
                    onPress={() => onSubmit(customFieldsData)}
                    variant="none" className="bg-[#95aad3] border-[#0C3572] border-2 py-3 rounded-xl" textClassName="text-[#0C3572]"
                    disabled={isLoading || !isFormValid}
                />
            </View>
        </View>
    );
};

export default CustomFieldsForm;