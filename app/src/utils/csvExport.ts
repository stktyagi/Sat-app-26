// src/utils/csvExporter.ts
import * as FileSystem from "expo-file-system"; 
import { Platform } from "react-native";
import { showAlert } from "../components";
import * as Sharing from "expo-sharing";

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
          ? member.responses.map((r) => `${r.label}: ${r.value}`).join("; ")
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

/* Removed API call */