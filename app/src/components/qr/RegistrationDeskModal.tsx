import React, { useEffect, useState } from "react";
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../index";
import { HostelPickerModal } from "@/components/admin/HostelPickerModal";
import { UserGateData, AdminHostel, allotHostel, getHostels } from "@/api/admin";
import {
  ActionButton,
  Banner,
  Card,
  DayChips,
  InfoRow,
  StatusPill,
  UserIdentityPhotos,
  ZoomImageModal,
  hostelLabel,
  useHospitalityColors,
} from "./hospitalityUi";

interface Props {
  visible: boolean;
  onClose: () => void;
  userData: UserGateData | null;
  onUserDataUpdate?: (d: UserGateData) => void;
}

/**
 * Registration desk: verify the participant's identity and details, then allot
 * a hostel. Allotment moves the per-hostel occupancy counter on the backend.
 */
const RegistrationDeskModal: React.FC<Props> = ({ visible, onClose, userData, onUserDataUpdate }) => {
  const c = useHospitalityColors();
  const [data, setData] = useState<UserGateData | null>(userData);
  const [hostels, setHostels] = useState<AdminHostel[] | undefined>(userData?.hostels);
  const [selected, setSelected] = useState("");
  const [roomNo, setRoomNo] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [zoomUri, setZoomUri] = useState<string | null>(null);

  useEffect(() => {
    setData(userData);
    setHostels(userData?.hostels);
    setSelected(userData?.checkInStatus?.Hostel || "");
    setRoomNo(userData?.checkInStatus?.RoomNo || "");
    setSuccess("");
  }, [userData]);

  if (!data) return null;

  const st = data.checkInStatus || ({} as UserGateData["checkInStatus"]);
  const currentHostel = st.Hostel || "";
  const holdsBed = Boolean(currentHostel) && !st.checkedOut;
  const hasAccommodation = Object.values(data.accommodation || {}).some(Boolean);
  const events = data.userEvents || [];

  const refreshHostels = async () => {
    try {
      const res = await getHostels();
      setHostels(res.hostels);
    } catch {
      // keep the list we have
    }
  };

  const doAllot = async () => {
    if (!selected) {
      showAlert("Select a hostel", "Pick a hostel to allot.");
      return;
    }
    setSaving(true);
    const res = await allotHostel(data.userId, selected, roomNo.trim());
    setSaving(false);
    if (!res.success) {
      showAlert("Allotment failed", res.error || "Could not allot hostel");
      refreshHostels();
      return;
    }
    const updated: UserGateData = {
      ...data,
      checkInStatus: { ...st, ...(res.data?.checkInStatus || {}), Hostel: selected, RoomNo: roomNo.trim() },
    };
    setData(updated);
    onUserDataUpdate?.(updated);
    if (res.hostel) {
      setHostels((prev) => prev?.map((h) => (h.id === res.hostel!.id ? res.hostel! : h)));
    }
    refreshHostels();
    setSuccess(`Allotted ${hostelLabel(selected, hostels)}${roomNo.trim() ? ` • Room ${roomNo.trim()}` : ""}`);
  };

  const onAllotPress = () => {
    if (holdsBed && selected !== currentHostel) {
      showAlert(
        "Re-allot hostel?",
        `Move from ${hostelLabel(currentHostel, hostels)} to ${hostelLabel(selected, hostels)}? The old bed will be freed.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Re-allot", onPress: doAllot },
        ]
      );
      return;
    }
    doAllot();
  };

  const selectedHostel = hostels?.find((h) => h.id === selected);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 }}>
        <View
          style={{
            backgroundColor: c.modalBg,
            borderRadius: 24,
            padding: 20,
            width: "100%",
            maxWidth: 400,
            maxHeight: "88%",
            borderWidth: 1,
            borderColor: c.modalBorder,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={c.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {success ? <Banner text={`✓ ${success}`} tone="success" /> : null}

            {/* Identity */}
            <UserIdentityPhotos
              photoUrl={data.photoUrl}
              collegeIdUrl={data.collegeIdUrl}
              onZoom={setZoomUri}
            />

            <Text style={{ fontFamily: "Talina", color: c.textPrimary, fontSize: 22, textAlign: "center", marginBottom: 6 }}>
              {data.displayName || data.name || "Participant"}
            </Text>
            <View style={{ flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: 14, flexWrap: "wrap" }}>
              <StatusPill label={st.fest ? "Gate: entered" : "Gate: pending"} color={st.fest ? c.success : c.warning} />
              <StatusPill
                label={st.checkedOut ? "Checked out" : st.accommodation ? "Hostel: checked in" : holdsBed ? "Allotted" : "Not allotted"}
                color={st.checkedOut ? c.textSecondary : st.accommodation ? c.success : holdsBed ? c.accent : c.warning}
              />
            </View>

            <Card title="Details">
              <InfoRow label="College" value={data.collegeName} />
              <InfoRow label="Roll / ID no." value={data.rollNumber} />
              <InfoRow label="Gender" value={data.gender} />
              <InfoRow label="Phone" value={data.phoneNumber} />
              <InfoRow label="Email" value={data.email} />
              {data.accommodationTier ? <InfoRow label="Tier" value={data.accommodationTier} /> : null}
            </Card>

            <Card title="Accommodation & food">
              {!hasAccommodation ? (
                <Text style={{ fontFamily: "Poppins_500Medium", color: c.warning, fontSize: 13 }}>No accommodation booked.</Text>
              ) : null}
              <DayChips label="Accommodation" days={data.accommodation} />
              <DayChips label="Food" days={data.food} />
            </Card>

            <Card title={`Events (${events.length})`}>
              {events.length === 0 ? (
                <Text style={{ fontFamily: "Poppins_400Regular", color: c.textSecondary, fontSize: 13 }}>No event registrations.</Text>
              ) : (
                events.map((e) => (
                  <InfoRow key={e.eventId} label={e.eventName} value={e.status} />
                ))
              )}
            </Card>

            <Card title="Hostel allotment">
              {holdsBed ? (
                <InfoRow label="Current" value={`${hostelLabel(currentHostel, hostels)}${st.RoomNo ? ` • Room ${st.RoomNo}` : ""}`} />
              ) : null}
              <TouchableOpacity
                onPress={() => setPickerOpen(true)}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: c.cardBorder,
                  backgroundColor: c.inputBg,
                  borderRadius: 12,
                  padding: 12,
                  marginTop: 6,
                }}
              >
                <Text style={{ fontFamily: "Poppins_500Medium", color: selected ? c.textPrimary : c.textSecondary }}>
                  {selected ? hostelLabel(selected, hostels) : "Select hostel"}
                </Text>
                <Text style={{ fontFamily: "Poppins_400Regular", color: c.textSecondary, fontSize: 12 }}>
                  {selectedHostel ? `${selectedHostel.occupied}/${selectedHostel.capacity}` : ""}
                </Text>
              </TouchableOpacity>
              <TextInput
                value={roomNo}
                onChangeText={setRoomNo}
                placeholder="Room no. (optional)"
                placeholderTextColor={c.textSecondary}
                style={{
                  borderWidth: 1,
                  borderColor: c.cardBorder,
                  backgroundColor: c.inputBg,
                  borderRadius: 12,
                  padding: 12,
                  marginTop: 8,
                  color: c.textPrimary,
                  fontFamily: "Poppins_400Regular",
                }}
              />
              <ActionButton
                label={holdsBed ? (selected === currentHostel ? "Update room" : "Re-allot hostel") : "Allot hostel"}
                icon="bed-outline"
                onPress={onAllotPress}
                loading={saving}
                disabled={!selected}
              />
            </Card>
          </ScrollView>
        </View>
      </View>

      <HostelPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedCode={selected}
        onSelect={setSelected}
        hostels={hostels}
        userGender={data.gender}
        title="Allot hostel"
      />

      <ZoomImageModal uri={zoomUri} onClose={() => setZoomUri(null)} />
    </Modal>
  );
};

export default RegistrationDeskModal;
