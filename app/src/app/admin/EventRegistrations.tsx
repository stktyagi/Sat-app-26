import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Users } from "lucide-react-native";
import { FirebaseEvent } from "@/types/models";
import { UserEventRegistration } from "@/api/admin";
import {
  getEventRegistrations,
  getEventTeamSummaries,
  getTeamMembers,
  getAllEventRegistrations,
  getAllTeamRegistrationsWithMembers,
  updateTeamRegistrationStatus,
  TeamSummary,
} from "@/api/admin";
import { getRegistrationTransaction } from "@/api/admin";
import { PaymentTransaction } from "@/types/adminTypes";
import { showAlert } from "@/components";
import { exportRegistrationsToCSV } from "@/utils/csvExport";
import {
  RegistrationCard,
  TeamRegistrationCard,
  TeamDetailsModal,
  RegistrationHeader,
  PaymentTransactionModal,
} from "@/components/admin/registrations";

interface EventRegistrationsProps {
  eventId: string;
  event: FirebaseEvent;
  navigation: any;
}

interface TeamRegistrationView {
  teamId: string;
  teamName: string;
  leaderId: string;
  members?: UserEventRegistration[];
  memberCount: number;
  maxSize: number;
  status: "confirmed" | "pending" | "payment_pending" | "rejected";
  createdAt: string;
  inviteCode: string;
}

export default function EventRegistrations({
  eventId,
  event,
  navigation,
}: EventRegistrationsProps) {
  // All data from backend (no pagination)
  const [allRegistrations, setAllRegistrations] = useState<UserEventRegistration[]>([]);
  const [allTeamRegistrations, setAllTeamRegistrations] = useState<TeamSummary[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCollegeFilter, setSelectedCollegeFilter] = useState<string>("all");

  // Modal state
  const [selectedTeam, setSelectedTeam] = useState<TeamRegistrationView | null>(null);
  const [showTeamDetails, setShowTeamDetails] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Payment transaction modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<PaymentTransaction | null>(null);
  const [loadingTransaction, setLoadingTransaction] = useState(false);

  // Use ref to track if it's the initial mount
  const isInitialMount = useRef(true);

  const isTeamEvent = event?.eventType === "team";

  // Load ALL registrations once (no pagination on backend)
  const loadAllRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      if (isTeamEvent) {
        const teams = await getEventTeamSummaries(eventId);
        setAllTeamRegistrations(teams);
      } else {
        const regs = await getEventRegistrations(eventId);
        setAllRegistrations(regs);
      }
    } catch (error) {
      console.error("Error loading registrations:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId, isTeamEvent]);

  // Initial load only
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      loadAllRegistrations();
    }
  }, [loadAllRegistrations]);

  // Frontend filtering with useMemo for performance
  const filteredRegistrations = useMemo(() => {
    let filtered = allRegistrations;

    // Apply search filter
    if (searchQuery.trim()) {
      const searchLower = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((reg) => {
        const email = (reg.user?.email || "").toLowerCase();
        const name = (reg.user?.name || reg.user?.displayName || "").toLowerCase();
        const phone = (reg.user?.phoneNumber || "").toLowerCase();
        return email.includes(searchLower) || name.includes(searchLower) || phone.includes(searchLower);
      });
    }

    // Apply status filter
    if (selectedStatus !== "all") {
      filtered = filtered.filter((reg) => reg.status === selectedStatus);
    }

    // Apply college filter
    if (selectedCollegeFilter === "thapar") {
      filtered = filtered.filter((reg) => (reg.user?.collegeName || "").toLowerCase().includes("thapar"));
    } else if (selectedCollegeFilter === "outside") {
      filtered = filtered.filter((reg) => !(reg.user?.collegeName || "").toLowerCase().includes("thapar"));
    }

    return filtered;
  }, [allRegistrations, searchQuery, selectedStatus, selectedCollegeFilter]);

  const filteredTeamRegistrations = useMemo(() => {
    let filtered: TeamRegistrationView[] = allTeamRegistrations.map((team) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      leaderId: team.leaderId,
      memberCount: team.memberCount,
      maxSize: team.maxSize,
      status: team.status,
      createdAt: team.createdAt,
      inviteCode: team.inviteCode,
    }));

    // Apply search filter (search by team name)
    if (searchQuery.trim()) {
      const searchLower = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((team) => team.teamName.toLowerCase().includes(searchLower));
    }

    // Apply status filter
    if (selectedStatus !== "all") {
      filtered = filtered.filter((team) => team.status === selectedStatus);
    }

    // Apply college filter using first member's college name
    if (selectedCollegeFilter === "thapar") {

      filtered = filtered.filter((team) => {
        const teamData = allTeamRegistrations.find((t) => t.teamId === team.teamId);
        return teamData?.firstMemberCollegeName?.toLowerCase().includes("thapar");
      });
    } else if (selectedCollegeFilter === "outside") {
      filtered = filtered.filter((team) => {
        const teamData = allTeamRegistrations.find((t) => t.teamId === team.teamId);
        return teamData?.firstMemberCollegeName && !teamData.firstMemberCollegeName.toLowerCase().includes("thapar");
      });
    }

    return filtered;
  }, [allTeamRegistrations, searchQuery, selectedStatus, selectedCollegeFilter]);

  const statuses = ["all", "confirmed", "pending", "payment_pending", "rejected"];

  // Search and filter handlers
  const handleSearch = useCallback((searchTerm: string) => {
    setSearchQuery(searchTerm);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const handleCollegeFilterChange = useCallback((filter: string) => {
    setSelectedCollegeFilter(filter);
  }, []);

  // Export functions
  const handleExportCSV = async (exportType: "summary" | "detailed" = "summary") => {
    if (isExporting) return;

    try {
      setIsExporting(true);

      if (isTeamEvent) {
        let allTeamRegistrations;

        if (exportType === "detailed") {
          allTeamRegistrations = await getAllTeamRegistrationsWithMembers(eventId);

          if (allTeamRegistrations.length === 0) {
            showAlert("No Data", "There are no team registrations to export.");
            return;
          }
        } else {
          const allTeams = await getAllTeamRegistrationsWithMembers(eventId);

          if (allTeams.length === 0) {
            showAlert("No Data", "There are no team registrations to export.");
            return;
          }

          allTeamRegistrations = allTeams;
        }

        await exportRegistrationsToCSV(
          allTeamRegistrations,
          event.title,
          isTeamEvent,
          exportType
        );
      } else {
        const allRegistrations = await getAllEventRegistrations(eventId);

        if (allRegistrations.length === 0) {
          showAlert("No Data", "There are no registrations to export.");
          return;
        }

        await exportRegistrationsToCSV(
          allRegistrations,
          event.title,
          isTeamEvent,
          exportType
        );
      }
    } catch (error) {
      console.error("Export error:", error);
      showAlert(
        "Export Failed",
        "There was an error exporting the CSV file. Please try again."
      );
    } finally {
      setIsExporting(false);
    }
  };

  const showExportOptions = () => {
    if (isTeamEvent) {
      showAlert("Export Options", "Choose the type of export you want:", [
        {
          text: "Team Summary (All Teams)",
          onPress: () => handleExportCSV("summary"),
        },
        {
          text: "Detailed Members (All Teams & Members)",
          onPress: () => handleExportCSV("detailed"),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]);
    } else {
      handleExportCSV("summary");
    }
  };


  const handleTeamClick = async (team: TeamRegistrationView) => {
    setSelectedTeam(team);
    setShowTeamDetails(true);
    setLoadingTeamMembers(true);

    try {
      const members = await getTeamMembers(eventId, team.teamId);
      setSelectedTeam({
        ...team,
        members,
      });
    } catch (error) {
      console.error("Error loading team members:", error);
      showAlert("Error", "Failed to load team members");
    } finally {
      setLoadingTeamMembers(false);
    }
  };

  const handleSaveStatus = async (
    teamId: string,
    newStatus: "confirmed" | "pending" | "payment_pending" | "rejected"
  ) => {
    const result = await updateTeamRegistrationStatus(eventId, teamId, newStatus);

    if (result.success) {
      const updatedTeam = { ...selectedTeam!, status: newStatus };
      setSelectedTeam(updatedTeam);

      // Update the allTeamRegistrations state
      setAllTeamRegistrations((prev) =>
        prev.map((team) => (team.teamId === teamId ? { ...team, status: newStatus } : team))
      );
    } else {
      throw new Error(result.error || "Failed to update status");
    }
  };

  // Handle viewing payment for individual registration
  const handleViewIndividualPayment = async (registration: UserEventRegistration) => {
    setShowPaymentModal(true);
    setLoadingTransaction(true);
    setSelectedTransaction(null);

    try {
      const transaction = await getRegistrationTransaction(
        eventId,
        registration.userId,
        undefined
      );
      setSelectedTransaction(transaction);
    } catch (error) {
      console.error("Error loading payment transaction:", error);
      showAlert("Error", "Failed to load payment transaction");
    } finally {
      setLoadingTransaction(false);
    }
  };

  // Handle viewing payment for team registration
  const handleViewTeamPayment = async (team: TeamRegistrationView) => {
    setShowPaymentModal(true);
    setLoadingTransaction(true);
    setSelectedTransaction(null);

    try {
      // For team events, we need to get any member's userId to query the transaction
      // The transaction should be linked by teamId
      const transaction = await getRegistrationTransaction(
        eventId,
        team.leaderId,
        // team.teamId
      );
      setSelectedTransaction(transaction);
    } catch (error) {
      console.error("Error loading payment transaction:", error);
      showAlert("Error", "Failed to load payment transaction");
    } finally {
      setLoadingTransaction(false);
    }
  };


  if (loading) {
    return (
      <View className="flex-1 bg-transparent items-center justify-center">
        <ActivityIndicator size="large" color="#EEB170" />
        <Text className="text-[#2175C0] mt-4">Loading registrations...</Text>
      </View>
    );
  }


  const renderEmptyState = () => (
    <View className="bg-[#FFFFFF66] rounded-2xl p-8 items-center border border-[#A0B3D0] mx-6">
      <Users size={48} color="#555" />
      <Text className="text-[#2175C0] text-center mt-4">
        {searchQuery || selectedStatus !== "all" || selectedCollegeFilter !== "all"
          ? "No registrations match your filters"
          : "No registrations found for this event"}
      </Text>
    </View>
  );

  const renderRegistrationItem = ({ item }: { item: UserEventRegistration }) => (
    <View className="px-6 mb-4">
      <RegistrationCard
        registration={item}
        onViewPayment={handleViewIndividualPayment}
      />
    </View>
  );

  const renderTeamRegistrationItem = ({ item }: { item: TeamRegistrationView }) => (
    <View className="px-6 mb-0">
      <TeamRegistrationCard
        team={item}
        onPress={handleTeamClick}
        onViewPayment={handleViewTeamPayment}
      />
    </View>
  );

  return (
    <View className="flex-1 bg-transparent">
      {isTeamEvent ? (
        <FlatList
          data={filteredTeamRegistrations}
          renderItem={renderTeamRegistrationItem}
          keyExtractor={(item, index) => `team-${item.teamId}-${index}`}
          ListHeaderComponent={
            <RegistrationHeader
              isExporting={isExporting}
              displaySearchInput={searchQuery}
              activeSearchQuery={searchQuery}
              selectedStatus={selectedStatus}
              statuses={statuses}
              isTeamEvent={isTeamEvent}
              registrationCount={filteredTeamRegistrations.length}
              selectedCollegeFilter={selectedCollegeFilter}
              onExport={showExportOptions}
              onSearch={handleSearch}
              onClearSearch={handleClearSearch}
              onStatusChange={setSelectedStatus}
              onCollegeFilterChange={handleCollegeFilterChange}
            />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 }}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
        />
      ) : (
        <FlatList
          data={filteredRegistrations}
          renderItem={renderRegistrationItem}
          keyExtractor={(item, index) => `user-${item.userId}-${index}`}
          ListHeaderComponent={
            <RegistrationHeader
              isExporting={isExporting}
              displaySearchInput={searchQuery}
              activeSearchQuery={searchQuery}
              selectedStatus={selectedStatus}
              statuses={statuses}
              isTeamEvent={isTeamEvent}
              registrationCount={filteredRegistrations.length}
              selectedCollegeFilter={selectedCollegeFilter}
              onExport={showExportOptions}
              onSearch={handleSearch}
              onClearSearch={handleClearSearch}
              onStatusChange={setSelectedStatus}
              onCollegeFilterChange={handleCollegeFilterChange}
            />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 }}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
        />
      )}

      {/* Team Details Modal */}
      {isTeamEvent && (
        <TeamDetailsModal
          visible={showTeamDetails}
          team={selectedTeam}
          eventId={eventId}
          loadingMembers={loadingTeamMembers}
          onClose={() => setShowTeamDetails(false)}
          onStatusUpdate={handleSaveStatus}
        />
      )}

      {/* Payment Transaction Modal */}
      <PaymentTransactionModal
        visible={showPaymentModal}
        transaction={selectedTransaction}
        loading={loadingTransaction}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedTransaction(null);
        }}
      />
    </View>
  );
};