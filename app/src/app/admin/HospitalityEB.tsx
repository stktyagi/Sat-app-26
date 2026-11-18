import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";
import { useUserStore } from "@/state/userStore";
import { hasAnyRole, ROLE_ADMIN, HOSPITALITY_EB_ROLES } from "@/utils/roles";
import { showAlert } from "@/components";
import { exportRowsToCSV } from "@/utils/csvExport";
import {
  AdminHostel,
  HospitalityRow,
  createHostel,
  getCheckoutsToday,
  getHostels,
  getInHouse,
  getMealLogs,
  updateHostel,
  getCurrentEventDay,
} from "@/api/admin";
import {
  ActionButton,
  Card,
  DAY_KEYS,
  DAY_LABELS,
  MEAL_SLOT_LABELS,
  hostelLabel,
  useHospitalityColors,
} from "@/components/qr/hospitalityUi";

type Tab = "inhouse" | "checkouts" | "meals" | "hostels";

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "inhouse", label: "In-house", icon: "bed-outline" },
  { key: "checkouts", label: "Checkouts", icon: "log-out-outline" },
  { key: "meals", label: "Meals", icon: "restaurant-outline" },
  { key: "hostels", label: "Hostels", icon: "business-outline" },
];

const fmtTime = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
};

const Chip: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({ label, active, onPress }) => {
  const c = useHospitalityColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: active ? c.accent : c.cardBg,
        borderWidth: 1,
        borderColor: active ? c.accent : c.cardBorder,
      }}
    >
      <Text style={{ fontFamily: "Poppins_500Medium", color: active ? "#fff" : c.textSecondary, fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
};

const PersonRow: React.FC<{ u: HospitalityRow; hostels: AdminHostel[]; extra?: string }> = ({ u, hostels, extra }) => {
  const c = useHospitalityColors();
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.cardBorder }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ fontFamily: "Poppins_600SemiBold", color: c.textPrimary, fontSize: 14, flex: 1 }}>{u.displayName || u.email}</Text>
        <Text style={{ fontFamily: "Poppins_500Medium", color: c.accent, fontSize: 12 }}>
          {hostelLabel(u.hostel, hostels) || "—"}
          {u.roomNo ? ` • ${u.roomNo}` : ""}
        </Text>
      </View>
      <Text style={{ fontFamily: "Poppins_400Regular", color: c.textSecondary, fontSize: 12 }}>
        {[u.collegeName, u.phoneNumber].filter(Boolean).join(" · ")}
      </Text>
      {extra ? <Text style={{ fontFamily: "Poppins_400Regular", color: c.textSecondary, fontSize: 11 }}>{extra}</Text> : null}
      {u.unreturned?.length ? (
        <Text style={{ fontFamily: "Poppins_600SemiBold", color: c.warning, fontSize: 11, marginTop: 2 }}>
          Holding: {u.unreturned.join(", ")}
        </Text>
      ) : null}
    </View>
  );
};

const peopleCsvRows = (users: HospitalityRow[], hostels: AdminHostel[]) =>
  users.map((u) => [
    u.displayName,
    u.email,
    u.phoneNumber,
    u.collegeName,
    u.gender,
    hostelLabel(u.hostel, hostels),
    u.roomNo,
    fmtTime(u.checkedInAt),
    u.lastStayDay >= 0 ? DAY_LABELS[`day${u.lastStayDay}`] || `day${u.lastStayDay}` : "",
    (u.unreturned || []).join(" "),
  ]);
const PEOPLE_HEADERS = ["Name", "Email", "Phone", "College", "Gender", "Hostel", "Room", "Checked in", "Last night", "Unreturned items"];

export default function HospitalityEBScreen() {
  const navigation = useAdminNavigation();
  const insets = useSafeAreaInsets();
  const c = useHospitalityColors();
  const { userData } = useUserStore();
  const allowed = hasAnyRole(userData, [ROLE_ADMIN, ...HOSPITALITY_EB_ROLES]);

  const [tab, setTab] = useState<Tab>("inhouse");
  const [hostels, setHostels] = useState<AdminHostel[]>([]);
  const [totals, setTotals] = useState({ cap: 0, occ: 0 });
  const [rows, setRows] = useState<HospitalityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hostelFilter, setHostelFilter] = useState("");

  // Meals
  const [mealDay, setMealDay] = useState(getCurrentEventDay());
  const [mealSlot, setMealSlot] = useState("all");
  const [mealCount, setMealCount] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  // Hostels
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState<"male" | "female" | "any">("male");
  const [newCap, setNewCap] = useState("");
  const [capEdits, setCapEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadHostels = useCallback(async () => {
    const res = await getHostels();
    setHostels(res.hostels);
    setTotals({ cap: res.totalCapacity, occ: res.totalOccupied });
  }, []);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError(null);
    try {
      await loadHostels();
      if (tab === "inhouse") setRows((await getInHouse(hostelFilter || undefined)).users);
      else if (tab === "checkouts") setRows((await getCheckoutsToday()).users);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [allowed, tab, hostelFilter, loadHostels]);

  useEffect(() => {
    setRows([]);
    setMealCount(null);
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((u) =>
      [u.displayName, u.email, u.phoneNumber, u.collegeName, u.hostel, u.roomNo].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [rows, search]);

  const exportMeals = async () => {
    setExporting(true);
    try {
      const { logs, count } = await getMealLogs(mealDay, mealSlot);
      setMealCount(count);
      if (!logs.length) {
        showAlert("No data", "Nobody has availed a meal for this selection yet.");
        return;
      }
      await exportRowsToCSV(
        `meals_${mealDay}_${mealSlot}`,
        ["Name", "Email", "Phone", "College", "Gender", "Day", "Slot", "Time (IST)", "Method", "Verified by"],
        logs.map((l) => [l.name, l.email, l.phone, l.college, l.gender, DAY_LABELS[l.day] || l.day, MEAL_SLOT_LABELS[l.slot] || l.slot, fmtTime(l.at), l.method, l.verifiedBy]),
        "Export meal logs"
      );
    } catch (e: any) {
      showAlert("Export failed", e?.message || "Could not load meal logs");
    } finally {
      setExporting(false);
    }
  };

  const addHostel = async () => {
    const cap = parseInt(newCap, 10);
    if (!newName.trim() || isNaN(cap) || cap < 0) {
      showAlert("Missing details", "Enter a hostel name and a capacity.");
      return;
    }
    setSavingId("__new");
    try {
      await createHostel({ name: newName.trim(), gender: newGender, capacity: cap });
      setNewName("");
      setNewCap("");
      await loadHostels();
    } catch (e: any) {
      showAlert("Could not add hostel", e?.message || "Failed");
    } finally {
      setSavingId(null);
    }
  };

  const saveCapacity = async (h: AdminHostel) => {
    const cap = parseInt(capEdits[h.id] ?? "", 10);
    if (isNaN(cap) || cap < 0) return;
    if (cap < h.occupied) {
      showAlert("Too low", `${h.name} already has ${h.occupied} occupants.`);
      return;
    }
    setSavingId(h.id);
    try {
      await updateHostel(h.id, { capacity: cap });
      setCapEdits((p) => {
        const n = { ...p };
        delete n[h.id];
        return n;
      });
      await loadHostels();
    } catch (e: any) {
      showAlert("Could not update", e?.message || "Failed");
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (h: AdminHostel) => {
    setSavingId(h.id);
    try {
      await updateHostel(h.id, { active: !h.active });
      await loadHostels();
    } catch (e: any) {
      showAlert("Could not update", e?.message || "Failed");
    } finally {
      setSavingId(null);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: c.cardBorder,
    backgroundColor: c.inputBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: c.textPrimary,
    fontFamily: "Poppins_400Regular",
  } as const;

  if (!allowed) {
    return (
      <View style={{ flex: 1, backgroundColor: c.isDark ? "#131316" : "#F3F4F6", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Ionicons name="lock-closed-outline" size={36} color={c.textSecondary} />
        <Text style={{ fontFamily: "Poppins_600SemiBold", color: c.textPrimary, fontSize: 16, marginTop: 12 }}>EB Hospitality only</Text>
        <ActionButton label="Go back" variant="outline" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.isDark ? "#131316" : "#F3F4F6", paddingTop: insets.top }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: c.cardBorder,
          backgroundColor: c.isDark ? "#18181B" : "#FFFFFF",
        }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 18, color: c.textPrimary }}>Hospitality Control</Text>
          <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: c.accent }}>
            Beds {totals.occ}/{totals.cap} occupied
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, gap: 6 }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: active ? c.accent : c.cardBg,
                borderWidth: 1,
                borderColor: active ? c.accent : c.cardBorder,
              }}
            >
              <Ionicons name={t.icon} size={16} color={active ? "#fff" : c.textSecondary} />
              <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 11, color: active ? "#fff" : c.textSecondary, marginTop: 2 }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.accent} />}
        keyboardShouldPersistTaps="handled"
      >
        {error ? <Text style={{ color: c.danger, fontFamily: "Poppins_500Medium", marginBottom: 10 }}>{error}</Text> : null}

        {(tab === "inhouse" || tab === "checkouts") && (
          <>
            {tab === "inhouse" ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
                <Chip label="All hostels" active={!hostelFilter} onPress={() => setHostelFilter("")} />
                {hostels.map((h) => (
                  <Chip key={h.id} label={`${h.name} (${h.occupied})`} active={hostelFilter === h.id} onPress={() => setHostelFilter(h.id)} />
                ))}
              </ScrollView>
            ) : (
              <Text style={{ fontFamily: "Poppins_400Regular", color: c.textSecondary, fontSize: 12, marginBottom: 8 }}>
                Participants whose last booked night was yesterday and who haven't checked out yet.
              </Text>
            )}
            <TextInput value={search} onChangeText={setSearch} placeholder="Search name, college, room…" placeholderTextColor={c.textSecondary} style={{ ...inputStyle, marginBottom: 10 }} />
            <Card title={`${filtered.length} ${tab === "inhouse" ? "in accommodation now" : "checking out today"}`}>
              {loading && !rows.length ? <ActivityIndicator color={c.accent} /> : null}
              {!loading && !filtered.length ? (
                <Text style={{ fontFamily: "Poppins_400Regular", color: c.textSecondary }}>Nobody here.</Text>
              ) : null}
              {filtered.map((u) => (
                <PersonRow
                  key={u.userId}
                  u={u}
                  hostels={hostels}
                  extra={tab === "inhouse" && u.checkedInAt ? `Checked in ${fmtTime(u.checkedInAt)}` : undefined}
                />
              ))}
            </Card>
            {filtered.length ? (
              <ActionButton
                label="Export CSV"
                variant="outline"
                icon="download-outline"
                onPress={() =>
                  exportRowsToCSV(
                    tab === "inhouse" ? `inhouse_${hostelFilter || "all"}` : `checkouts_${getCurrentEventDay()}`,
                    PEOPLE_HEADERS,
                    peopleCsvRows(filtered, hostels)
                  )
                }
              />
            ) : null}
          </>
        )}

        {tab === "meals" && (
          <Card title="Export who availed meals">
            <Text style={{ fontFamily: "Poppins_500Medium", color: c.textSecondary, fontSize: 12, marginBottom: 6 }}>Day</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {DAY_KEYS.map((d) => (
                <Chip key={d} label={DAY_LABELS[d]} active={mealDay === d} onPress={() => setMealDay(d)} />
              ))}
            </View>
            <Text style={{ fontFamily: "Poppins_500Medium", color: c.textSecondary, fontSize: 12, marginBottom: 6 }}>Slot</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {["all", "breakfast", "lunch", "dinner"].map((s) => (
                <Chip key={s} label={s === "all" ? "All slots" : MEAL_SLOT_LABELS[s]} active={mealSlot === s} onPress={() => setMealSlot(s)} />
              ))}
            </View>
            <ActionButton label="Export CSV" icon="download-outline" onPress={exportMeals} loading={exporting} />
            {mealCount !== null ? (
              <Text style={{ fontFamily: "Poppins_500Medium", color: c.textSecondary, fontSize: 12, marginTop: 8, textAlign: "center" }}>
                {mealCount} meal{mealCount === 1 ? "" : "s"} recorded
              </Text>
            ) : null}
          </Card>
        )}

        {tab === "hostels" && (
          <>
            <Card title="Add hostel">
              <TextInput value={newName} onChangeText={setNewName} placeholder="Hostel name" placeholderTextColor={c.textSecondary} style={{ ...inputStyle, marginBottom: 8 }} />
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                {(["male", "female", "any"] as const).map((g) => (
                  <Chip key={g} label={g === "male" ? "Boys" : g === "female" ? "Girls" : "Any"} active={newGender === g} onPress={() => setNewGender(g)} />
                ))}
              </View>
              <TextInput value={newCap} onChangeText={setNewCap} placeholder="Capacity (beds)" placeholderTextColor={c.textSecondary} keyboardType="number-pad" style={inputStyle} />
              <ActionButton label="Add hostel" icon="add-outline" onPress={addHostel} loading={savingId === "__new"} />
            </Card>

            <Card title={`${hostels.length} hostels`}>
              {!hostels.length ? <Text style={{ fontFamily: "Poppins_400Regular", color: c.textSecondary }}>No hostels yet.</Text> : null}
              {hostels.map((h) => {
                const edit = capEdits[h.id];
                return (
                  <View key={h.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.cardBorder, opacity: h.active ? 1 : 0.55 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Poppins_600SemiBold", color: c.textPrimary, fontSize: 14 }}>{h.name}</Text>
                        <Text style={{ fontFamily: "Poppins_400Regular", color: c.textSecondary, fontSize: 12 }}>
                          {h.gender === "any" ? "Any" : h.gender === "female" ? "Girls" : "Boys"} · {h.occupied}/{h.capacity} occupied
                          {h.active ? "" : " · inactive"}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => toggleActive(h)} disabled={savingId === h.id} hitSlop={8}>
                        <Text style={{ fontFamily: "Poppins_500Medium", color: h.active ? c.danger : c.success, fontSize: 12 }}>
                          {h.active ? "Disable" : "Enable"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" }}>
                      <TextInput
                        value={edit ?? String(h.capacity)}
                        onChangeText={(t) => setCapEdits((p) => ({ ...p, [h.id]: t.replace(/[^0-9]/g, "") }))}
                        keyboardType="number-pad"
                        style={{ ...inputStyle, flex: 1, paddingVertical: 8 }}
                      />
                      <TouchableOpacity
                        onPress={() => saveCapacity(h)}
                        disabled={edit === undefined || edit === String(h.capacity) || savingId === h.id}
                        style={{
                          backgroundColor: c.accent,
                          borderRadius: 10,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          opacity: edit === undefined || edit === String(h.capacity) ? 0.4 : 1,
                        }}
                      >
                        {savingId === h.id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#fff", fontSize: 12 }}>Set capacity</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
