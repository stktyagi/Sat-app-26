import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, StatusBar } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { X, Calendar, Clock } from "lucide-react-native";

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onDateSelect: (dateTime: string) => void;
  initialDate?: string;
  title?: string;
}

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Arrow Icon Component for header navigation
const ArrowIcon = ({
  direction,
  color,
}: {
  direction: "left" | "right";
  color: string;
}) => (
  <Text
    className={`text-2xl ${color}`}
    style={{ transform: [{ scaleX: direction === "right" ? 1.2 : -1.2 }] }}
  >
    ›
  </Text>
);

const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  onClose,
  onDateSelect,
  initialDate,
  title = "Select Date & Time",
}) => {
  // Parse initial date or use current date
  const parseInitialDate = () => {
    if (initialDate) {
      try {
        // If it's an ISO string, parse directly
        if (initialDate.includes("T")) {
          return new Date(initialDate);
        }

        // Parse DD/MM/YYYY HH:MM format
        const [datePart, timePart] = initialDate.split(" ");
        if (!datePart) return new Date();

        const [day, month, year] = datePart.split("/");
        const [hour, minute] = timePart ? timePart.split(":") : ["09", "00"];

        if (!day || !month || !year) return new Date();

        const date = new Date();
        date.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day));
        date.setHours(parseInt(hour) || 9, parseInt(minute) || 0, 0, 0);

        return date;
      } catch {
        return new Date();
      }
    }
    return new Date();
  };

  const [currentDate, setCurrentDate] = useState(parseInitialDate());
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    parseInitialDate()
  );
  const [selectedHour, setSelectedHour] = useState(
    parseInitialDate().getHours()
  );
  const [selectedMinute, setSelectedMinute] = useState(
    parseInitialDate().getMinutes()
  );

  const getWeekDates = (date: Date) => {
    const weekDates = [];
    const startOfWeek = new Date(date);
    // Set to the last Sunday
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      weekDates.push(day);
    }
    return weekDates;
  };

  const weekDates = getWeekDates(currentDate);

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const handleConfirm = () => {
    if (selectedDate) {
      // Create final date with selected time
      const finalDate = new Date(selectedDate);
      finalDate.setHours(selectedHour, selectedMinute, 0, 0);

      // Return ISO string for consistent storage
      onDateSelect(finalDate.toISOString());
      onClose();
    }
  };

  // Generate hours (0-23)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  // Generate minutes (0, 15, 30, 45)
  const minutes = [0, 15, 30, 45];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <StatusBar backgroundColor="#040D2D" barStyle="light-content" />
      <View className="flex-1 bg-black/80 justify-center items-center px-4">
        <View className="bg-white rounded-3xl p-6 w-full max-w-sm">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#0C3572] text-xl"
            >
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="bg-[#FFFFFF66] rounded-full p-2"
            >
              <X size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Calendar Section */}
          <View className="bg-[#FFFFFF66] rounded-2xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <Calendar size={16} color="#FFBA00" />
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#FFBA00] text-sm ml-2"
              >
                Select Date
              </Text>
            </View>

            {/* Calendar Header */}
            <View className="flex-row justify-between items-center mb-4">
              <TouchableOpacity
                onPress={handlePrevWeek}
                className="w-8 h-8 rounded-full bg-[#3C3C3C] justify-center items-center"
              >
                <ArrowIcon direction="left" color="text-[#FFBA00]" />
              </TouchableOpacity>
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#0C3572] text-lg"
              >
                {months[currentDate.getMonth()]} {currentDate.getFullYear()}
              </Text>
              <TouchableOpacity
                onPress={handleNextWeek}
                className="w-8 h-8 rounded-full bg-[#3C3C3C] justify-center items-center"
              >
                <ArrowIcon direction="right" color="text-[#FFBA00]" />
              </TouchableOpacity>
            </View>

            {/* Week Days & Dates */}
            <View className="flex-row justify-around">
              {weekDates.map((date, index) => {
                const isSelected =
                  selectedDate && isSameDay(date, selectedDate);
                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

                return (
                  <View key={index} className="items-center">
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-[#2175C0] text-xs mb-2"
                    >
                      {daysOfWeek[index]}
                    </Text>
                    <TouchableOpacity
                      onPress={() => !isPast && setSelectedDate(date)}
                      disabled={isPast}
                      className={`w-8 h-8 justify-center items-center rounded-full ${
                        isSelected
                          ? "bg-[#FFBA00]"
                          : isPast
                          ? "bg-transparent"
                          : "bg-transparent"
                      }`}
                    >
                      <Text
                        style={{ fontFamily: "Outfit_500Medium" }}
                        className={`text-sm ${
                          isSelected
                            ? "text-black font-bold"
                            : isPast
                            ? "text-gray-600"
                            : "text-[#0C3572]"
                        }`}
                      >
                        {date.getDate()}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Time Section */}
          <View className="bg-[#FFFFFF66] rounded-2xl p-4 mb-6">
            <View className="flex-row items-center mb-3">
              <Clock size={16} color="#FFBA00" />
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#FFBA00] text-sm ml-2"
              >
                Select Time (IST)
              </Text>
            </View>

            <View className="flex-row gap-3">
              {/* Hour Picker */}
              <View className="flex-1">
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-[#2175C0] text-xs mb-2 text-center"
                >
                  Hour
                </Text>
                <View className="bg-[#3C3C3C] rounded-xl overflow-hidden">
                  <Picker
                    selectedValue={selectedHour}
                    onValueChange={(value) => setSelectedHour(value)}
                    style={{ color: "#fff", height: 120 }}
                    itemStyle={{ color: "#fff", fontSize: 16 }}
                  >
                    {hours.map((hour) => (
                      <Picker.Item
                        key={hour}
                        label={hour.toString().padStart(2, "0")}
                        value={hour}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Minute Picker */}
              <View className="flex-1">
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-[#2175C0] text-xs mb-2 text-center"
                >
                  Minute
                </Text>
                <View className="bg-[#3C3C3C] rounded-xl overflow-hidden">
                  <Picker
                    selectedValue={selectedMinute}
                    onValueChange={(value) => setSelectedMinute(value)}
                    style={{ color: "#fff", height: 120 }}
                    itemStyle={{ color: "#fff", fontSize: 16 }}
                  >
                    {minutes.map((minute) => (
                      <Picker.Item
                        key={minute}
                        label={minute.toString().padStart(2, "0")}
                        value={minute}
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-[#FFFFFF66] py-3 rounded-xl"
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#0C3572] text-center"
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-1 py-3 rounded-xl ${
                selectedDate ? "bg-[#FFBA00]" : "bg-[#FFFFFF66]"
              }`}
              onPress={handleConfirm}
              disabled={!selectedDate}
              activeOpacity={0.7}
            >
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className={`text-center ${
                  selectedDate ? "text-black" : "text-gray-500"
                }`}
              >
                Confirm
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default DatePickerModal;
