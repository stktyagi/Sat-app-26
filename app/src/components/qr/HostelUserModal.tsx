import React, { useEffect, useState } from "react";
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../index";
import { useUserStore } from "@/state/userStore";
import { hasAnyRole, HOSPITALITY_LEAD_ROLES } from "@/utils/roles";
import {
  UserGateData,
  HostelItems,
  HostelAction,
  EMPTY_ITEMS,
  updateHostelStatus,
  getCurrentEventDay,
} from "@/api/admin";
import {
  ActionButton,
  Banner,
  Card,
  DayChips,
  InfoRow,
  StatusPill,
  ToggleRow,
  UserIdentityPhotos,
  ZoomImageModal,
  hostelLabel,
  useHospitalityColors,
  DAY_LABELS,
} from "./hospitalityUi";

interface HostelUserModalProps {
  visible: boolean;
  onClose: () => void;
  userData: UserGateData | null;
  onUserDataUpdate?: (updatedData: UserGateData) => void;
  onActionComplete?: (action: HostelAction) => void;
}

const itemsLabel = (list: string[]) =>
  list.map((i) => (i === "pillow" ? "Pillow" : i === "bedsheet" ? "Bedsheet" : "Mattress")).join(" & ");

const unreturnedOf = (i: HostelItems) => {
  const out: string[] = [];
  if (i.mattressGiven && !i.mattressReturned) out.push("mattress");
  if (i.pillowGiven && !i.pillowReturned) out.push("pillow");
  if (i.bedsheetGiven && !i.bedsheetReturned) out.push("bedsheet");
  return out;
};

/**
 * Hostel desk: check a participant in (hand out pillow/mattress) or out
 * (collect them). Hostel allotment happens at the registration desk.
 */
const HostelUserModal: React.FC<HostelUserModalProps> = ({ visible, onClose, userData, onUserDataUpdate, onActionComplete }) => {
  const c = useHospitalityColors();
  const { userData: me } = useUserStore();
  const isLead = hasAnyRole(me, HOSPITALITY_LEAD_ROLES);

  const [data, setData] = useState<UserGateData | null>(userData);
  const [items, setItems] = useState<HostelItems>(userData?.checkInStatus?.items || EMPTY_ITEMS);
  const [roomNo, setRoomNo] = useState(userData?.checkInStatus?.RoomNo || "");
  const [loading, setLoading] = useState<HostelAction | null>(null);
  const [success, setSuccess] = useState("");
  const [zoomUri, setZoomUri] = useState<string | null>(null);

  useEffect(() => {
    setData(userData);
    setItems({ ...EMPTY_ITEMS, ...(userData?.checkInStatus?.items || {}) });
    setRoomNo(userData?.checkInStatus?.RoomNo || "");
    setSuccess("");
  }, [userData]);

  if (!data) return null;

  const st = data.checkInStatus || ({} as UserGateData["checkInStatus"]);
  const allotted = Boolean(st.Hostel);
  const checkedIn = Boolean(st.accommodation) && !st.checkedOut;
  const checkedOut = Boolean(st.checkedOut);
  const today = getCurrentEventDay();
  const bookedToday = Boolean(data.accommodation?.[today]);

  const run = async (action: HostelAction, okMsg: string, nextItems: HostelItems = items) => {
    setLoading(action);
    try {
      const res = await updateHostelStatus(
        data.userId,
        action !== "revert",
        undefined,
        action === "revert" ? undefined : roomNo.trim(),
        action,
        action === "revert" ? undefined : nextItems
      );
      if (!res.success) {
        const msg = res.error || "Failed to update accommodation status";
        showAlert(msg.includes("registration desk") ? "Not allotted" : "Update failed", msg);
        return;
      }
      const cs = res.data?.checkInStatus || {};
      const updated: UserGateData = { ...data, checkInStatus: { ...st, ...cs } };
      setData(updated);
      setItems({ ...EMPTY_ITEMS, ...(cs.items || {}) });
      onUserDataUpdate?.(updated);
      onActionComplete?.(action);
      const left = res.unreturned || [];
      setSuccess(action === "checkout" && left.length ? `${okMsg} — ${itemsLabel(left)} not returned!` : okMsg);
    } finally {
      setLoading(null);
    }
  };

  const onCheckIn = () => {
    const missing = [
      !items.mattressGiven && "mattress",
      !items.pillowGiven && "pillow",
      !items.bedsheetGiven && "bedsheet",
    ].filter(Boolean) as string[];
    if (missing.length) {
      showAlert("Items not marked", `${itemsLabel(missing)} not marked as given. Check in anyway?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Check in", onPress: () => run("checkin", "Checked in to hostel") },
      ]);
      return;
    }
    run("checkin", "Checked in to hostel");
  };

  const onCheckOut = () => {
    const left = unreturnedOf(items);
    const who = data.displayName || data.name || "this participant";
    showAlert(
      left.length ? "Items not returned" : "Confirm check-out",
      left.length
        ? `${itemsLabel(left)} not marked returned for ${who}. Check out anyway?`
        : `Check out ${who} from the hostel?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Check out", style: "destructive", onPress: () => run("checkout", "Checked out from hostel") },
      ]
    );
  };

  const onRevert = () =>
    showAlert("Revert to pending?", "This clears the check-in and the hostel allotment, freeing the bed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Revert", style: "destructive", onPress: () => run("revert", "Reset to pending") },
    ]);

  const setItem = (k: keyof HostelItems, v: boolean) => {
    setItems((p) => {
      const next = { ...p, [k]: v };
      if (k === "mattressGiven" && !v) next.mattressReturned = false;
      if (k === "pillowGiven" && !v) next.pillowReturned = false;
      if (k === "bedsheetGiven" && !v) next.bedsheetReturned = false;
      return next;
    });
  };

  const statusPill = checkedOut
    ? { label: "Checked out", color: c.textSecondary }
    : checkedIn
      ? { label: "Checked in", color: c.success }
      : allotted
        ? { label: "Allotted — pending check-in", color: c.accent }
        : { label: "Not allotted", color: c.warning };

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
            {success ? <Banner text={`✓ ${success}`} tone={success.includes("not returned") ? "warning" : "success"} /> : null}

            {/* Identity Photos */}
            <UserIdentityPhotos
              photoUrl={data.photoUrl}
              collegeIdUrl={data.collegeIdUrl}
              onZoom={setZoomUri}
            />

            <Text style={{ fontFamily: "Talina", color: c.textPrimary, fontSize: 22, textAlign: "center", marginBottom: 6 }}>
              {data.displayName || data.name || "User"}
            </Text>
            <Text style={{ fontFamily: "Poppins_400Regular", color: c.textSecondary, fontSize: 13, textAlign: "center", marginBottom: 8 }}>
              {data.collegeName}
            </Text>
            <View style={{ marginBottom: 14 }}>
              <StatusPill label={statusPill.label} color={statusPill.color} />
            </View>

            {!allotted ? (
              <Banner text="No hostel allotted. Send them to the registration desk first." tone="warning" />
            ) : null}
            {!bookedToday && !checkedOut ? (
              <Banner text={`No accommodation booked for today (${DAY_LABELS[today] || today}).`} tone="warning" />
            ) : null}

            <Card title="Stay">
              <InfoRow label="Hostel" value={hostelLabel(st.Hostel)} />
              <InfoRow label="Phone" value={data.phoneNumber} />
              <InfoRow label="Gender" value={data.gender} />
              {st.checkedInAt ? <InfoRow label="Checked in" value={new Date(st.checkedInAt).toLocaleString()} /> : null}
              {st.checkedOutAt ? <InfoRow label="Checked out" value={new Date(st.checkedOutAt).toLocaleString()} /> : null}
              <DayChips label="Booked nights" days={data.accommodation} />
              {allotted && !checkedOut ? (
                <TextInput
                  value={roomNo}
                  onChangeText={setRoomNo}
                  placeholder="Room no."
                  placeholderTextColor={c.textSecondary}
                  autoCapitalize="characters"
                  style={{
                    borderWidth: 1,
                    borderColor: c.cardBorder,
                    backgroundColor: c.inputBg,
                    borderRadius: 12,
                    padding: 12,
                    marginTop: 10,
                    color: c.textPrimary,
                    fontFamily: "Poppins_400Regular",
                  }}
                />
              ) : null}
            </Card>

            {allotted ? (
              <Card title={checkedIn ? "Bedding Items (Issued & Returned)" : checkedOut ? "Returned at checkout" : "Hand out at check-in"}>
                {!checkedIn && !checkedOut ? (
                  <>
                    <ToggleRow icon="bed-outline" label="Mattress given" value={items.mattressGiven} onChange={(v) => setItem("mattressGiven", v)} />
                    <ToggleRow icon="cloud-outline" label="Pillow given" value={items.pillowGiven} onChange={(v) => setItem("pillowGiven", v)} />
                    <ToggleRow icon="layers-outline" label="Bedsheet given" value={items.bedsheetGiven} onChange={(v) => setItem("bedsheetGiven", v)} />
                  </>
                ) : checkedIn ? (
                  <>
                    <Text style={{ fontFamily: "Poppins_600SemiBold", color: c.accent, fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Issued Items
                    </Text>
                    <ToggleRow icon="bed-outline" label="Mattress given" value={items.mattressGiven} onChange={(v) => setItem("mattressGiven", v)} />
                    <ToggleRow icon="cloud-outline" label="Pillow given" value={items.pillowGiven} onChange={(v) => setItem("pillowGiven", v)} />
                    <ToggleRow icon="layers-outline" label="Bedsheet given" value={items.bedsheetGiven} onChange={(v) => setItem("bedsheetGiven", v)} />

                    <View style={{ height: 1, backgroundColor: c.cardBorder, marginVertical: 8 }} />

                    <Text style={{ fontFamily: "Poppins_600SemiBold", color: c.textSecondary, fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Returned Items
                    </Text>
                    <ToggleRow
                      icon="bed-outline"
                      label={`Mattress returned${items.mattressGiven ? "" : " (not given)"}`}
                      value={items.mattressReturned}
                      onChange={(v) => setItem("mattressReturned", v)}
                      disabled={!items.mattressGiven}
                    />
                    <ToggleRow
                      icon="cloud-outline"
                      label={`Pillow returned${items.pillowGiven ? "" : " (not given)"}`}
                      value={items.pillowReturned}
                      onChange={(v) => setItem("pillowReturned", v)}
                      disabled={!items.pillowGiven}
                    />
                    <ToggleRow
                      icon="layers-outline"
                      label={`Bedsheet returned${items.bedsheetGiven ? "" : " (not given)"}`}
                      value={items.bedsheetReturned}
                      onChange={(v) => setItem("bedsheetReturned", v)}
                      disabled={!items.bedsheetGiven}
                    />
                  </>
                ) : (
                  <>
                    <ToggleRow
                      icon="bed-outline"
                      label={`Mattress returned${items.mattressGiven ? "" : " (not given)"}`}
                      value={items.mattressReturned}
                      onChange={(v) => setItem("mattressReturned", v)}
                      disabled={!items.mattressGiven || checkedOut}
                    />
                    <ToggleRow
                      icon="cloud-outline"
                      label={`Pillow returned${items.pillowGiven ? "" : " (not given)"}`}
                      value={items.pillowReturned}
                      onChange={(v) => setItem("pillowReturned", v)}
                      disabled={!items.pillowGiven || checkedOut}
                    />
                    <ToggleRow
                      icon="layers-outline"
                      label={`Bedsheet returned${items.bedsheetGiven ? "" : " (not given)"}`}
                      value={items.bedsheetReturned}
                      onChange={(v) => setItem("bedsheetReturned", v)}
                      disabled={!items.bedsheetGiven || checkedOut}
                    />
                  </>
                )}
                {checkedOut && unreturnedOf(items).length ? (
                  <Text style={{ fontFamily: "Poppins_600SemiBold", color: c.warning, fontSize: 12, marginTop: 6 }}>
                    Not returned: {itemsLabel(unreturnedOf(items))}
                  </Text>
                ) : null}
              </Card>
            ) : null}

            {allotted && !checkedIn && !checkedOut ? (
              <ActionButton label="Check in" icon="log-in-outline" color={c.success} onPress={onCheckIn} loading={loading === "checkin"} />
            ) : null}
            {checkedIn ? (
              <>
                <ActionButton
                  label="Save items / room"
                  variant="outline"
                  icon="save-outline"
                  onPress={() => run("items", "Saved")}
                  loading={loading === "items"}
                />
                <ActionButton label="Check out" icon="log-out-outline" color={c.danger} onPress={onCheckOut} loading={loading === "checkout"} />
              </>
            ) : null}
            {checkedOut ? (
              <ActionButton
                label="Undo check-out"
                variant="outline"
                icon="arrow-undo-outline"
                onPress={() => run("undo_checkout", "Check-out undone")}
                loading={loading === "undo_checkout"}
              />
            ) : null}
            {isLead && (checkedIn || allotted) && !checkedOut ? (
              <ActionButton
                label="Revert to pending"
                variant="outline"
                color={c.danger}
                icon="refresh-outline"
                onPress={onRevert}
                loading={loading === "revert"}
              />
            ) : null}
          </ScrollView>
        </View>
      </View>
      <ZoomImageModal uri={zoomUri} onClose={() => setZoomUri(null)} />
    </Modal>
  );
};

export default HostelUserModal;
