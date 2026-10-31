import * as FileSystem from "expo-file-system/legacy"; 
import { Platform } from "react-native";
import { showAlert } from "../components";
import * as Sharing from "expo-sharing";
import { UserEventRegistration } from "@/api/admin";

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

// Escape CSV value
const escapeCSVValue = (value: string | null | undefined): string => {
  if (!value) return "";
  const stringValue = String(value);
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

// Format date nicely
const formatDateForCSV = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "Invalid Date";
  }
};

// === CSV GENERATORS (no change) ===
/* Removed API call */

export const generateTeamRegistrationsCSV = (
  teamRegistrations: TeamRegistrationView[],
  eventTitle: string
): string => {
  const headers = [
    "Team Name",
    "Team ID",
    "Invite Code",
    "Status",
    "Member Count",
    "Max Size",
    "Created Date",
  ];
  const csvRows = [headers.join(",")];
  teamRegistrations.forEach((team) => {
    const row = [
      escapeCSVValue(team.teamName),
      escapeCSVValue(team.teamId),
      escapeCSVValue(team.inviteCode),
      escapeCSVValue(team.status),
      escapeCSVValue(team.memberCount.toString()),
      escapeCSVValue(team.maxSize.toString()),
      escapeCSVValue(formatDateForCSV(team.createdAt)),
    ];
    csvRows.push(row.join(","));
  });
  return csvRows.join("\n");
};

export const generateTeamMembersCSV = (
  teamRegistrations: TeamRegistrationView[],
  eventTitle: string
): string => {
  const headers = [
    "Team Name",
    "Team ID",
    "Team Status",
    "Member Name",
    "Member Email",
    "Member Phone",
    "Member College",
    "Member Roll Number",
    "Is Leader",
    "Registration Date",
    "Custom Responses",
  ];
  const csvRows = [headers.join(",")];
  teamRegistrations.forEach((team) => {
    if (team.members && team.members.length > 0) {
      team.members.forEach((member) => {
        const isLeader = member.userId === team.leaderId;
        const customResponses = member.responses
          ? member.responses.map((r: any) => `${r.label}: ${r.value}`).join("; ")
          : "";
        const row = [
          escapeCSVValue(team.teamName),
          escapeCSVValue(team.teamId),
          escapeCSVValue(team.status),
          escapeCSVValue(member.user.name || (member.user as any).displayName || "Unknown User"),
          escapeCSVValue(member.user.email),
          escapeCSVValue(member.user.phoneNumber),
          escapeCSVValue(member.user.collegeName),
          escapeCSVValue(member.user.rollNumber),
          escapeCSVValue(isLeader ? "Yes" : "No"),
          escapeCSVValue(formatDateForCSV(member.registeredAt)),
          escapeCSVValue(customResponses),
        ];
        csvRows.push(row.join(","));
      });
    }
  });
  return csvRows.join("\n");
};

export const exportRegistrationsToCSV = async (
  data: any[],
  eventTitle: string,
  isTeamEvent: boolean,
  exportType: "summary" | "detailed" = "summary"
) => {
  try {
    let csvContent = "";
    if (isTeamEvent) {
      if (exportType === "detailed") {
        csvContent = generateTeamMembersCSV(data, eventTitle);
      } else {
        csvContent = generateTeamRegistrationsCSV(data, eventTitle);
      }
    } else {
      const headers = ["Name", "Email", "Phone", "College", "Status", "Registration Date"];
      const rows = data.map((reg: any) => [
        escapeCSVValue(reg.user?.name || reg.user?.displayName || "Unknown"),
        escapeCSVValue(reg.user?.email),
        escapeCSVValue(reg.user?.phoneNumber),
        escapeCSVValue(reg.user?.collegeName),
        escapeCSVValue(reg.status || "confirmed"),
        escapeCSVValue(formatDateForCSV(reg.registeredAt)),
      ]);
      csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }

    const filename = `${eventTitle.replace(/[^a-zA-Z0-9]/g, "_")}_registrations.csv`;
    const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || "";
    const fileUri = `${baseDir}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Export Registrations CSV",
      });
    } else {
      showAlert("Export", `CSV saved to ${fileUri}`);
    }
  } catch (error) {
    console.error("Error exporting CSV:", error);
    showAlert("Export Failed", "Failed to export CSV");
  }
};