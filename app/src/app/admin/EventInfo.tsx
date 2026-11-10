import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Image,
} from "react-native";
import {
  Edit,
  Save,
  X,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  ImageIcon,
  Info,
  Settings,
  Award,
  UserPlus,
  Plus,
  Trash2,
  Upload,
  Mail,
  Phone,
  Check,
  Search,
} from "lucide-react-native";
import MarkdownText from "@/components/display/MarkdownText";
import { FirebaseEvent } from "@/types/models";
import {
  updateEventInfo,
  searchUsers,
  searchVenues,
  listVenues,
  uploadFile,
} from "@/api/admin";
import { Input } from "@/components";
import { useUserStore } from "@/state/userStore";
import { useThemeStore } from "@/state/themeStore";
import { showAlert } from "@/components";
import { canUserEditEvent } from "@/utils/roles";

// Phase 3: Custom Field Types
interface BaseCustomField {
  fieldId: string;
  label: string;
  isRequired: boolean;
}

interface TextField extends BaseCustomField {
  type: "text";
  placeholder?: string;
}

interface LinkField extends BaseCustomField {
  type: "link";
  placeholder?: string;
}

interface NumberField extends BaseCustomField {
  type: "number";
  minValue?: number;
  maxValue?: number;
  placeholder?: string;
}

interface SelectField extends BaseCustomField {
  type: "select";
  options: string[];
}

interface MultiSelectField extends BaseCustomField {
  type: "multi-select";
  options: string[];
}

type CustomField =
  | TextField
  | LinkField
  | NumberField
  | SelectField
  | MultiSelectField;

interface EventInfoProps {
  event: FirebaseEvent;
  onEventUpdate: (updatedEvent: FirebaseEvent) => void;
  navigation: any;
}

export default function EventInfo({
  event,
  onEventUpdate,
  navigation,
}: EventInfoProps) {
  const { isDark } = useThemeStore();
  const [isEditing, setIsEditing] = useState(false);
  const { userData: userProfile } = useUserStore();

  const bgColor = isDark ? '#131316' : '#E0E0E0';
  const cardBg = isDark ? '#1C1C20' : '#FFFFFF';
  const cardBorder = isDark ? '#2A2A30' : '#D5D5D5';
  const textColor = isDark ? '#FFFFFF' : '#111827';
  const subTextColor = isDark ? '#A0A0A0' : '#6B7280';
  const inputBg = isDark ? '#26262B' : '#F3F4F6';

  // Safety check for undefined event
  if (!event) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#41B8F0" />
        <Text style={{ fontFamily: 'Poppins_500Medium', color: subTextColor, marginTop: 16 }}>Loading event information...</Text>
      </View>
    );
  }

  // Check if user can edit this event
  const canEdit = () => {
    return canUserEditEvent(userProfile, event);
  };
  const [editData, setEditData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Phase 2: Advanced Features State
  const [uploadingImageIdx, setUploadingImageIdx] = useState<number | null>(
    null
  );
  const [uploadError, setUploadError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearchedUser, setHasSearchedUser] = useState(false);
  const [venueSearchTerm, setVenueSearchTerm] = useState("");
  const [venueResults, setVenueResults] = useState<any[]>([]);
  const [allVenues, setAllVenues] = useState<any[]>([]);

  // Load venues catalog on mount
  useEffect(() => {
    listVenues()
      .then((venues) => {
        if (Array.isArray(venues)) {
          setAllVenues(venues);
        }
      })
      .catch((err) => {
        console.warn("Failed to load venues list:", err);
      });
  }, []);

  // Coordinator management state
  const [showManualAddCoordinator, setShowManualAddCoordinator] = useState(false);
  const [manualCoordName, setManualCoordName] = useState("");
  const [manualCoordEmail, setManualCoordEmail] = useState("");
  const [manualCoordPhone, setManualCoordPhone] = useState("");

  const [editingCoordIndex, setEditingCoordIndex] = useState<number | null>(null);
  const [editCoordName, setEditCoordName] = useState("");
  const [editCoordEmail, setEditCoordEmail] = useState("");
  const [editCoordPhone, setEditCoordPhone] = useState("");

  // Refs for search timeout
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEdit = () => {
    // Double-check permissions before allowing edit
    if (!canEdit()) {
      showAlert("Access Denied", "You don't have permission to edit this event");
      return;
    }

    setShowManualAddCoordinator(false);
    setEditingCoordIndex(null);
    setSearchTerm("");
    setSearchResults([]);
    setHasSearchedUser(false);
    setVenueSearchTerm(event.venueName || "");
    setVenueResults([]);

    setEditData({
      // Basic Information
      title: event.title || "",
      category: event.category || "Technical",
      shortDescription: event.shortDescription || "",
      description: event.description || "",
      coverImage: event.coverImage || "",
      eventType: event.eventType || "individual",
      isFeatured: event.isFeatured || false,
      externalUrl: (event as any).externalUrl || "",

      // Team-specific fields
      minTeamSize: event.minTeamSize || 0,
      maxTeamSize: event.maxTeamSize || 0,
      sameCollegeOnly: event.sameCollegeOnly || false,

      // Event Dates & Venue
      registrationDeadline: parseInputDate(event.registrationDeadline) || event.registrationDeadline || "",
      startDateTime: parseInputDate(event.startDateTime) || event.startDateTime || "",
      endDateTime: parseInputDate(event.endDateTime) || event.endDateTime || "",
      dateTime: parseInputDate(event.dateTime) || event.dateTime || "",
      venueName: event.venueName || "",
      venueId: event.venueId || "",
      maxParticipants: (event as any).maxParticipants ? Number((event as any).maxParticipants) : 0,

      // Event Settings
      isPublic: event.isPublic !== false,
      paymentRequired: event.paymentRequired || false,
      paymentStarted: event.paymentStarted || false,
      requireAdminApproval: (event as any).requireAdminApproval || false,
      paymentType: (event as any).paymentType || "fixed",

      // Payment fees
      registrationFee: {
        host: event.registrationFee?.host || 0,
        other: event.registrationFee?.other || 0,
      },

      // Prizes & Media
      prizes: event.prizes || "",
      shortPrizes: event.shortPrizes || "",
      rules: event.rules || "",

      // Arrays for media
      images: event.images || [],
      links: event.links || [],
      reelsId: event.reelsId || [],

      // Coordinators
      coordinators: event.coordinators || [],

      // Custom Fields
      customFields: (event as any).customFields || [],
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditData({});
    setIsEditing(false);
    setShowManualAddCoordinator(false);
    setEditingCoordIndex(null);
    setSearchTerm("");
    setSearchResults([]);
    setHasSearchedUser(false);
    setVenueSearchTerm("");
    setVenueResults([]);
  };

  const handleSave = async () => {
    // Check permissions before saving
    if (!canEdit()) {
      showAlert("Access Denied", "You don't have permission to edit this event");
      return;
    }

    // All event fields are optional: empty values are allowed and saved.
    // Validation below only checks values that were actually entered.

    // Custom registration fields are optional subrecords: a row left
    // completely blank is dropped on save, while a partially filled row
    // still needs its missing pieces.
    const isBlankCustomField = (field: CustomField) => {
      if (field.label?.trim()) return false;
      if (field.type === "select" || field.type === "multi-select") {
        return !(field.options || []).some((opt: string) => opt.trim());
      }
      return !(field.placeholder?.trim());
    };
    const customFields = (editData.customFields || []).filter(
      (field: CustomField) => !isBlankCustomField(field)
    );
    for (let i = 0; i < customFields.length; i++) {
      const field = customFields[i];

      if (!field.label?.trim()) {
        showAlert(
          "Error",
          `Custom field ${i + 1} has details entered but no label - add a label or clear the row`
        );
        return;
      }

      if (field.type === "select" || field.type === "multi-select") {
        const validOptions = field.options.filter((opt: string) => opt.trim());
        if (validOptions.length === 0) {
          showAlert(
            "Error",
            `Custom field "${field.label}" must have at least one option`
          );
          return;
        }
      }
    }

    // Sanitize and convert date fields to RFC3339
    const deadlineISO = parseInputDate(editData.registrationDeadline);
    const startISO = parseInputDate(editData.startDateTime);
    const endISO = parseInputDate(editData.endDateTime);
    // A cleared Event Date & Time stays empty; it does not fall back to Start.
    const dateTimeISO = parseInputDate(editData.dateTime);

    if (editData.registrationDeadline && editData.registrationDeadline.trim() && !deadlineISO) {
      showAlert("Error", "Registration Deadline is invalid. Please use DD/MM/YYYY HH:MM format.");
      return;
    }

    if (editData.startDateTime && editData.startDateTime.trim() && !startISO) {
      showAlert("Error", "Start Date & Time is invalid. Please use DD/MM/YYYY HH:MM format.");
      return;
    }

    if (editData.endDateTime && editData.endDateTime.trim() && !endISO) {
      showAlert("Error", "End Date & Time is invalid. Please use DD/MM/YYYY HH:MM format.");
      return;
    }

    if (startISO && endISO && new Date(endISO).getTime() < new Date(startISO).getTime()) {
      showAlert("Error", "End Date & Time cannot be before Start Date & Time.");
      return;
    }

    if (startISO && deadlineISO && new Date(startISO).getTime() < new Date(deadlineISO).getTime()) {
      showAlert("Error", "Registration Deadline cannot be after Start Date & Time.");
      return;
    }

    setSaving(true);
    try {
      // Prepare sanitized numeric values
      const parsedMaxParticipants = editData.maxParticipants !== undefined && editData.maxParticipants !== null && editData.maxParticipants !== ""
        ? parseInt(String(editData.maxParticipants), 10)
        : 0;

      // Team sizes are optional: empty stays empty (0 = no minimum / no
      // maximum, the same unset convention as maxParticipants).
      const parsedMinTeamSize = editData.minTeamSize !== undefined && editData.minTeamSize !== null && editData.minTeamSize !== ""
        ? parseInt(String(editData.minTeamSize), 10)
        : 0;

      const parsedMaxTeamSize = editData.maxTeamSize !== undefined && editData.maxTeamSize !== null && editData.maxTeamSize !== ""
        ? parseInt(String(editData.maxTeamSize), 10)
        : 0;

      // Sanitize venue: backend rejects non-existent venueId with "no venue with that id"
      let finalVenueName = (editData.venueName || "").trim();
      let finalVenueId = (editData.venueId || "").trim();

      if (!finalVenueName) {
        finalVenueName = "";
        finalVenueId = "";
      } else {
        let currentVenues = allVenues;
        if (currentVenues.length === 0) {
          try {
            currentVenues = await listVenues();
          } catch (e) {
            console.warn("Could not fetch venues for validation:", e);
          }
        }

        if (currentVenues && currentVenues.length > 0) {
          const matchById = currentVenues.find((v: any) => v.venueId === finalVenueId);
          if (!matchById) {
            // Try matching by venue name or slug
            const matchByName = currentVenues.find(
              (v: any) =>
                (v.venueName || "").toLowerCase() === finalVenueName.toLowerCase() ||
                (v.venueId || "").toLowerCase() === finalVenueName.toLowerCase()
            );
            if (matchByName) {
              finalVenueId = matchByName.venueId;
              finalVenueName = matchByName.venueName;
            } else {
              // Custom or non-catalog venue:
              // Backend strictly checks VenueExists if venueId != "".
              // By sending venueId as "", backend safely stores venueName without rejecting.
              finalVenueId = "";
            }
          } else {
            finalVenueName = matchById.venueName || finalVenueName;
          }
        } else if (finalVenueId && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(finalVenueId)) {
          finalVenueId = "";
        }
      }

      const cleanedData = {
        ...editData,
        venueName: finalVenueName,
        venueId: finalVenueId,
        // Ensure date fields are valid RFC3339 timestamps (or empty string if not set)
        registrationDeadline: deadlineISO,
        startDateTime: startISO,
        endDateTime: endISO,
        dateTime: dateTimeISO,
        // Ensure integer fields are numbers, never strings
        maxParticipants: !isNaN(parsedMaxParticipants) && parsedMaxParticipants > 0 ? parsedMaxParticipants : 0,
        minTeamSize: !isNaN(parsedMinTeamSize) && parsedMinTeamSize > 0 ? parsedMinTeamSize : 0,
        maxTeamSize: !isNaN(parsedMaxTeamSize) && parsedMaxTeamSize > 0 ? parsedMaxTeamSize : 0,
        registrationFee: {
          host: Number(editData.registrationFee?.host) || 0,
          other: Number(editData.registrationFee?.other) || 0,
        },
        // Remove empty strings from arrays
        images: (editData.images || []).filter((img: any) => typeof img === "string" && img.trim()),
        links: (editData.links || [])
          .filter((link: any) => (typeof link === "string" ? link.trim() : (link?.url || link?.title)))
          .map((link: any) => (typeof link === "string" ? { title: link.trim(), url: link.trim() } : link)),
        reelsId: (editData.reelsId || []).filter((reel: any) => typeof reel === "string" && reel.trim()),
        // Ensure coordinators array is properly formatted
        coordinators: (editData.coordinators || []).map((c: any) => ({
          name: c.name || "",
          email: c.email || "",
          phone: c.phone || "",
          userID: c.userID || c.userId || "",
        })),
        // Clean up custom fields ensuring fieldId is always set (blank
        // rows were already dropped during validation above)
        customFields: customFields.map(
          (field: CustomField, idx: number) => {
            const fieldId = field.fieldId && field.fieldId.trim()
              ? field.fieldId.trim()
              : `field_${Date.now()}_${idx}`;

            if (field.type === "select" || field.type === "multi-select") {
              return {
                ...field,
                fieldId,
                options: (field.options || []).filter((opt: string) => opt.trim()),
              };
            }

            return {
              ...field,
              fieldId,
            };
          }
        ),
      };

      const result = await updateEventInfo(event.eventId, cleanedData);

      if (result.success) {
        const updatedEvent = { ...event, ...cleanedData };
        onEventUpdate(updatedEvent);
        setIsEditing(false);
        setEditData({});
        setVenueSearchTerm("");
        setVenueResults([]);
        showAlert("Success", "Event updated successfully!");
      } else {
        showAlert("Error", result.error || "Failed to update event");
      }
    } catch (error) {
      console.error("Save error:", error);
      showAlert("Error", "Failed to update event");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      });
    } catch {
      return "Date not set";
    }
  };

  // Format date for display in input fields (DD/MM/YYYY HH:MM)
  const formatDateForInput = (dateString: string | undefined | null) => {
    if (!dateString) return "";
    try {
      // If it doesn't contain "T" but already matches DD/MM/YYYY, return as-is
      if (!dateString.includes("T") && /^\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(dateString.trim())) {
        return dateString.trim();
      }
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;

      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");

      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return dateString || "";
    }
  };

  // Robust date parser that converts any human or ISO date string to RFC3339 ISO string
  const parseInputDate = (inputString: string | undefined | null): string => {
    if (!inputString || !inputString.trim()) return "";
    const s = inputString.trim();

    // If it's already in ISO format, validate and return
    if (s.includes("T")) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toISOString();
    }

    // Match DD/MM/YYYY or DD-MM-YYYY with optional HH:MM or HH:MM:SS
    const dmyMatch = s.match(
      /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
    );
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10);
      const year = parseInt(dmyMatch[3], 10);
      const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
      const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
      const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

      const date = new Date(year, month - 1, day, hour, min, sec);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // Match YYYY-MM-DD or YYYY/MM/DD with optional HH:MM or HH:MM:SS
    const ymdMatch = s.match(
      /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
    );
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10);
      const day = parseInt(ymdMatch[3], 10);
      const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
      const min = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
      const sec = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;

      const date = new Date(year, month - 1, day, hour, min, sec);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // Generic Date fallback
    const fallback = new Date(s);
    if (!isNaN(fallback.getTime())) {
      return fallback.toISOString();
    }

    return "";
  };

  // Custom DateTimeInput component (text input only)
  const renderDateTimeInput = (
    label: string,
    field: string,
    value: string,
    required: boolean = false
  ) => {
    const displayValue = formatDateForInput(value);

    return (
      <View className="mb-4">
        <Input
          label={`${label}${required ? " *" : ""}`}
          value={displayValue}
          onChangeText={(inputValue) => {
            const iso = parseInputDate(inputValue);
            if (iso) {
              setEditData({ ...editData, [field]: iso });
            } else {
              setEditData({ ...editData, [field]: inputValue });
            }
          }}
          placeholder="DD/MM/YYYY HH:MM (IST)"
        />
      </View>
    );
  };

  // Search users using real API (triggered via Search button)
  const handleUserSearch = async (term: string) => {
    const q = (term || "").trim();
    if (!q) {
      setSearchResults([]);
      setSearching(false);
      setHasSearchedUser(false);
      return;
    }

    setSearching(true);
    setHasSearchedUser(true);
    try {
      const users = await searchUsers(q);
      setSearchResults(users);
    } catch (error) {
      console.error("User search error:", error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Search venues using real API or loaded catalog
  const handleVenueSearch = async (term: string) => {
    const q = (term || "").trim().toLowerCase();
    if (!q) {
      if (allVenues.length > 0) {
        setVenueResults(allVenues.slice(0, 10));
      } else {
        setVenueResults([]);
      }
      return;
    }

    if (allVenues.length > 0) {
      const filtered = allVenues.filter((v: any) =>
        (v.venueName || "").toLowerCase().includes(q) ||
        (v.venueId || "").toLowerCase().includes(q)
      );
      setVenueResults(filtered.slice(0, 15));
    } else {
      try {
        const venues = await searchVenues(term);
        setVenueResults(venues.slice(0, 15));
      } catch (error) {
        console.error("Venue search error:", error);
        setVenueResults([]);
      }
    }
  };

  // Add coordinator from search
  const addCoordinator = (user: any) => {
    const current = editData.coordinators || [];
    const userEmail = (user.email || "").toLowerCase().trim();
    const userId = user.userId || user.userID || "";

    const alreadyExists = current.some((c: any) => {
      const cEmail = (c.email || "").toLowerCase().trim();
      const cId = c.userID || c.userId || "";
      return (userEmail && cEmail && cEmail === userEmail) || (userId && cId && cId === userId);
    });

    if (alreadyExists) {
      showAlert("Notice", "This coordinator is already added");
      return;
    }

    setEditData({
      ...editData,
      coordinators: [
        ...current,
        {
          name: user.displayName || user.name || "Coordinator",
          phone: user.phoneNumber || user.phone || "",
          email: user.email || "",
          userID: userId,
        },
      ],
    });
    setSearchTerm("");
    setSearchResults([]);
    setHasSearchedUser(false);
  };

  // Add coordinator manually
  const handleManualAddCoordinator = () => {
    const name = manualCoordName.trim();
    const email = manualCoordEmail.trim().toLowerCase();
    const phone = manualCoordPhone.trim();

    if (!name) {
      showAlert("Error", "Please enter the coordinator's name");
      return;
    }

    if (!email || !email.includes("@")) {
      showAlert("Error", "Please enter a valid email address");
      return;
    }

    const current = editData.coordinators || [];
    if (current.some((c: any) => (c.email || "").toLowerCase().trim() === email)) {
      showAlert("Notice", "A coordinator with this email is already added");
      return;
    }

    setEditData({
      ...editData,
      coordinators: [
        ...current,
        {
          name,
          email,
          phone,
          userID: "",
        },
      ],
    });

    setManualCoordName("");
    setManualCoordEmail("");
    setManualCoordPhone("");
    setShowManualAddCoordinator(false);
  };

  // Start editing a coordinator
  const startEditCoordinator = (index: number) => {
    const coord = (editData.coordinators || [])[index];
    if (!coord) return;
    setEditingCoordIndex(index);
    setEditCoordName(coord.name || "");
    setEditCoordEmail(coord.email || "");
    setEditCoordPhone(coord.phone || "");
  };

  // Save coordinator edit
  const saveCoordinatorEdit = (index: number) => {
    const name = editCoordName.trim();
    const email = editCoordEmail.trim().toLowerCase();
    const phone = editCoordPhone.trim();

    if (!name) {
      showAlert("Error", "Coordinator name cannot be empty");
      return;
    }

    if (!email || !email.includes("@")) {
      showAlert("Error", "Please enter a valid email address");
      return;
    }

    const current = editData.coordinators || [];
    const duplicate = current.some(
      (c: any, i: number) => i !== index && (c.email || "").toLowerCase().trim() === email
    );
    if (duplicate) {
      showAlert("Notice", "Another coordinator with this email already exists");
      return;
    }

    const newCoordinators = [...current];
    newCoordinators[index] = {
      ...newCoordinators[index],
      name,
      email,
      phone,
    };

    setEditData({ ...editData, coordinators: newCoordinators });
    setEditingCoordIndex(null);
  };

  // Cancel coordinator edit
  const cancelCoordinatorEdit = () => {
    setEditingCoordIndex(null);
  };

  // Remove coordinator
  const removeCoordinator = (index: number) => {
    const current = editData.coordinators || [];
    if (current.length <= 1) {
      showAlert(
        "Cannot Remove",
        "An event must have at least one coordinator. Please add the new coordinator before removing this one, or edit their details directly."
      );
      return;
    }
    const newCoordinators = [...current];
    newCoordinators.splice(index, 1);
    setEditData({ ...editData, coordinators: newCoordinators });
    if (editingCoordIndex === index) {
      setEditingCoordIndex(null);
    }
  };

  // Add array item (for images, links, reels)
  const addArrayItem = (arrayName: string) => {
    setEditData({
      ...editData,
      [arrayName]: [...(editData[arrayName] || []), ""],
    });
  };

  // Remove array item
  const removeArrayItem = (arrayName: string, index: number) => {
    const newArray = [...(editData[arrayName] || [])];
    newArray.splice(index, 1);
    setEditData({ ...editData, [arrayName]: newArray });
  };

  // Update array item
  const updateArrayItem = (arrayName: string, index: number, value: string) => {
    const newArray = [...(editData[arrayName] || [])];
    newArray[index] = value;
    setEditData({ ...editData, [arrayName]: newArray });
  };

  // Phase 3: Custom Field Management Functions

  const addCustomField = () => {
    const newField: TextField = {
      fieldId: Date.now().toString(),
      label: "",
      type: "text",
      isRequired: false,
      placeholder: "",
    };

    setEditData({
      ...editData,
      customFields: [...(editData.customFields || []), newField],
    });
  };

  const removeCustomField = (index: number) => {
    const newFields = [...(editData.customFields || [])];
    newFields.splice(index, 1);
    setEditData({ ...editData, customFields: newFields });
  };

  const updateCustomField = (index: number, updates: Partial<CustomField>) => {
    const newFields = [...(editData.customFields || [])];
    newFields[index] = { ...newFields[index], ...updates };
    setEditData({ ...editData, customFields: newFields });
  };

  const changeCustomFieldType = (
    index: number,
    newType: CustomField["type"]
  ) => {
    const currentField = editData.customFields[index];
    let newField: CustomField;

    switch (newType) {
      case "text":
        newField = {
          fieldId: currentField.fieldId,
          label: currentField.label,
          isRequired: currentField.isRequired,
          type: "text",
          placeholder: "",
        };
        break;
      case "link":
        newField = {
          fieldId: currentField.fieldId,
          label: currentField.label,
          isRequired: currentField.isRequired,
          type: "link",
          placeholder: "",
        };
        break;
      case "number":
        newField = {
          fieldId: currentField.fieldId,
          label: currentField.label,
          isRequired: currentField.isRequired,
          type: "number",
          minValue: undefined,
          maxValue: undefined,
          placeholder: "",
        };
        break;
      case "select":
        newField = {
          fieldId: currentField.fieldId,
          label: currentField.label,
          isRequired: currentField.isRequired,
          type: "select",
          options: [""],
        };
        break;
      case "multi-select":
        newField = {
          fieldId: currentField.fieldId,
          label: currentField.label,
          isRequired: currentField.isRequired,
          type: "multi-select",
          options: [""],
        };
        break;
      default:
        newField = currentField;
    }

    const newFields = [...(editData.customFields || [])];
    newFields[index] = newField;
    setEditData({ ...editData, customFields: newFields });
  };

  const addFieldOption = (fieldIndex: number) => {
    const field = editData.customFields[fieldIndex];
    if (field.type === "select" || field.type === "multi-select") {
      const newOptions = [...field.options, ""];
      updateCustomField(fieldIndex, { options: newOptions });
    }
  };

  const removeFieldOption = (fieldIndex: number, optionIndex: number) => {
    const field = editData.customFields[fieldIndex];
    if (field.type === "select" || field.type === "multi-select") {
      const newOptions = [...field.options];
      newOptions.splice(optionIndex, 1);
      if (newOptions.length === 0) newOptions.push("");
      updateCustomField(fieldIndex, { options: newOptions });
    }
  };

  const updateFieldOption = (
    fieldIndex: number,
    optionIndex: number,
    value: string
  ) => {
    const field = editData.customFields[fieldIndex];
    if (field.type === "select" || field.type === "multi-select") {
      const newOptions = [...field.options];
      newOptions[optionIndex] = value;
      updateCustomField(fieldIndex, { options: newOptions });
    }
  };

  const renderViewMode = () => (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
      {/* Hero Image */}
      <View style={{ marginBottom: 16 }}>
        {event.coverImage ? (
          <View style={{ height: 220, borderRadius: 20, overflow: 'hidden', backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder }}>
            <Image
              source={{
                uri: event.coverImage,
              }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              onError={() => {}}
            />
          </View>
        ) : (
          <View style={{ height: 160, borderRadius: 20, backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <ImageIcon size={44} color={subTextColor} />
            <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 13, marginTop: 8 }}>
              No cover image uploaded
            </Text>
          </View>
        )}
      </View>

      {/* Header Section */}
      <View style={{ backgroundColor: cardBg, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: cardBorder }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontFamily: "Talina", color: textColor, fontSize: 24, marginBottom: 6 }}>
              {event.title}
            </Text>
            <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 14, lineHeight: 22 }}>
              {event.shortDescription}
            </Text>
          </View>
          {canEdit() && (
            <TouchableOpacity
              style={{ backgroundColor: '#41B8F0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, flexDirection: 'row', alignItems: 'center' }}
              onPress={handleEdit}
              activeOpacity={0.7}
            >
              <Edit size={16} color="#FFFFFF" />
              <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', marginLeft: 6, fontSize: 13 }}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status Badges */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {event.isFeatured && (
            <View style={{ backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
              <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#22c55e", fontSize: 12 }}>
                Featured
              </Text>
            </View>
          )}
          {event.paymentRequired && (
            <View style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
              <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#f59e0b", fontSize: 12 }}>
                Paid Event
              </Text>
            </View>
          )}
          {!event.isPublic && (
            <View style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
              <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#ef4444", fontSize: 12 }}>
                Private
              </Text>
            </View>
          )}
          <View style={{ backgroundColor: isDark ? 'rgba(65, 184, 240, 0.15)' : '#E0F2FE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
            <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", fontSize: 12, textTransform: 'capitalize' }}>
              {event.category}
            </Text>
          </View>
        </View>
      </View>

      {/* Event Details */}
      <View style={{ backgroundColor: cardBg, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: cardBorder }}>
        <Text style={{ fontFamily: "Poppins_600SemiBold", color: '#41B8F0', fontSize: 17, marginBottom: 16 }}>
          Event Details
        </Text>

        {/* Date & Time */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Calendar size={18} color="#41B8F0" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontFamily: "Poppins_500Medium", color: textColor, fontSize: 14 }}>Event Date</Text>
            <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 12 }}>
              {formatDate(event.dateTime || event.startDateTime)}
            </Text>
          </View>
        </View>

        {/* Venue */}
        {event.venueName && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <MapPin size={18} color="#41B8F0" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontFamily: "Poppins_500Medium", color: textColor, fontSize: 14 }}>Venue</Text>
              <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 12 }}>{event.venueName}</Text>
            </View>
          </View>
        )}

        {/* Event Type */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Users size={18} color="#41B8F0" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontFamily: "Poppins_500Medium", color: textColor, fontSize: 14 }}>Event Type</Text>
            <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 12, textTransform: 'capitalize' }}>
              {event.eventType}
              {event.eventType === "team" &&
                event.maxTeamSize &&
                ` (Max ${event.maxTeamSize} members)`}
            </Text>
          </View>
        </View>

        {/* Registration Fee */}
        {event.paymentRequired && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <DollarSign size={18} color="#41B8F0" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontFamily: "Poppins_500Medium", color: textColor, fontSize: 14 }}>Registration Fee</Text>
              <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 12 }}>
                Host: ₹{event.registrationFee?.host || 0} • Other: ₹
                {event.registrationFee?.other || 0}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Description */}
      <View style={{ backgroundColor: cardBg, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: cardBorder }}>
        <Text style={{ fontFamily: "Poppins_600SemiBold", color: '#41B8F0', fontSize: 17, marginBottom: 12 }}>
          Description
        </Text>
        <MarkdownText
          lightMode={!isDark}
          style={{ fontSize: 14, lineHeight: 22, fontFamily: "Poppins_400Regular", color: textColor }}
        >
          {event.description}
        </MarkdownText>
      </View>

      {/* Rules */}
      {event.rules && (
        <View style={{ backgroundColor: cardBg, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: cardBorder }}>
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: '#41B8F0', fontSize: 17, marginBottom: 12 }}>Rules</Text>
          <MarkdownText
            lightMode={!isDark}
            style={{ fontSize: 14, lineHeight: 22, fontFamily: "Poppins_400Regular", color: textColor }}
          >
            {event.rules}
          </MarkdownText>
        </View>
      )}

      {/* Prizes */}
      {event.prizes && (
        <View style={{ backgroundColor: cardBg, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: cardBorder }}>
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: '#41B8F0', fontSize: 17, marginBottom: 12 }}>Prizes</Text>
          <MarkdownText
            lightMode={!isDark}
            style={{ fontSize: 14, lineHeight: 22, fontFamily: "Poppins_400Regular", color: textColor }}
          >
            {event.prizes}
          </MarkdownText>
        </View>
      )}

      {/* Coordinators */}
      {event.coordinators && event.coordinators.length > 0 && (
        <View style={{ backgroundColor: cardBg, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: cardBorder }}>
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: '#41B8F0', fontSize: 17, marginBottom: 12 }}>
            Coordinators
          </Text>
          <View style={{ gap: 10 }}>
            {event.coordinators.map((coordinator, idx) => (
              <View
                key={idx}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? '#26262B' : '#F9FAFB',
                  padding: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: cardBorder,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: '#41B8F0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontFamily: 'Poppins_700Bold', fontSize: 15 }}>
                    {coordinator.name?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Poppins_600SemiBold', color: textColor, fontSize: 14 }}>
                    {coordinator.name}
                  </Text>
                  {coordinator.email ? (
                    <Text style={{ fontFamily: 'Poppins_400Regular', color: subTextColor, fontSize: 12 }}>
                      {coordinator.email}
                    </Text>
                  ) : null}
                  {coordinator.phone ? (
                    <Text style={{ fontFamily: 'Poppins_400Regular', color: subTextColor, fontSize: 12 }}>
                      {coordinator.phone}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );

  const categories = [
    "Technical",
    "Cultural",
    "Workshop",
    "Business",
    "Informal",
  ];

  const renderCategorySelector = () => (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 14, marginBottom: 10 }}>
        Category
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {categories.map((cat) => {
            const isSelected = editData.category === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: isSelected ? '#41B8F0' : cardBorder,
                  backgroundColor: isSelected ? (isDark ? 'rgba(65, 184, 240, 0.15)' : '#E0F2FE') : cardBg,
                }}
                onPress={() => setEditData({ ...editData, category: cat })}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    fontFamily: isSelected ? "Poppins_600SemiBold" : "Poppins_500Medium",
                    fontSize: 13,
                    color: isSelected ? '#41B8F0' : subTextColor,
                  }}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  const renderEventTypeSelector = () => (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 14, marginBottom: 10 }}>
        Event Type *
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {["individual", "team", "externalLink"].map((type) => {
          const isSelected = editData.eventType === type;
          return (
            <TouchableOpacity
              key={type}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: isSelected ? '#41B8F0' : cardBorder,
                backgroundColor: isSelected ? (isDark ? 'rgba(65, 184, 240, 0.15)' : '#E0F2FE') : cardBg,
                alignItems: 'center',
              }}
              onPress={() => {
                const updates: any = { eventType: type };
                if (type === "individual") {
                  updates.minTeamSize = undefined;
                  updates.maxTeamSize = updates.sameCollegeOnly = undefined;
                  updates.externalUrl = "";
                } else if (type === "externalLink") {
                  updates.minTeamSize = undefined;
                  updates.maxTeamSize = undefined;
                  updates.sameCollegeOnly = undefined;
                  updates.venueName = "";
                  updates.venueId = "";
                  updates.maxParticipants = 0;
                } else if (type === "team") {
                  updates.externalUrl = "";
                  if (!editData.minTeamSize) updates.minTeamSize = 2;
                  if (!editData.maxTeamSize) updates.maxTeamSize = 5;
                }
                setEditData({ ...editData, ...updates });
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontFamily: isSelected ? "Poppins_600SemiBold" : "Poppins_500Medium",
                  fontSize: 12,
                  color: isSelected ? '#41B8F0' : subTextColor,
                }}
              >
                {type === "externalLink"
                  ? "External"
                  : type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderSwitchField = (
    label: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
    description?: string
  ) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <View style={{ flex: 1, marginRight: 14 }}>
        <Text style={{ fontFamily: "Poppins_500Medium", color: textColor, fontSize: 14 }}>{label}</Text>
        {description && (
          <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 12, marginTop: 2 }}>{description}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: isDark ? '#323238' : '#D1D5DB', true: '#41B8F0' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  const renderSection = (
    title: string,
    children: React.ReactNode,
    icon?: React.ReactNode
  ) => (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        {icon}
        <Text style={{ fontFamily: "Poppins_600SemiBold", color: '#41B8F0', fontSize: 16, marginLeft: 8 }}>{title}</Text>
      </View>
      <View style={{ backgroundColor: cardBg, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: cardBorder }}>
        {children}
      </View>
    </View>
  );

  // Phase 2: Dynamic Array Rendering Components

  const renderImageArray = (
    label: string,
    arrayName: string,
    isReel = false
  ) => (
    <View className="mb-4">
      <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 15, marginBottom: 8 }}>{label}</Text>
      {(editData[arrayName] || []).map((item: string, index: number) => (
        <View key={index} className="flex-row items-center mb-3">
          <View className="flex-1 mr-3">
            <Input
              value={item}
              onChangeText={(value) => updateArrayItem(arrayName, index, value)}
              placeholder={isReel ? "Reel ID or upload" : "Image URL or upload"}
            />
          </View>
          <TouchableOpacity
            style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
            className="p-3 rounded-xl mr-2"
            onPress={() => {
              showAlert("Upload", "File upload would be implemented here");
            }}
            disabled={uploadingImageIdx === index}
          >
            {uploadingImageIdx === index ? (
              <ActivityIndicator size="small" color="#41B8F0" />
            ) : (
              <Upload size={16} color="#41B8F0" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-red-500/20 border border-red-500/40 p-3 rounded-xl"
            onPress={() => removeArrayItem(arrayName, index)}
          >
            <Trash2 size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        style={{ borderColor: "#41B8F0", borderWidth: 1.5, backgroundColor: isDark ? "rgba(65, 184, 240, 0.1)" : "rgba(65, 184, 240, 0.08)" }}
        className="px-4 py-3 rounded-xl flex-row items-center justify-center"
        onPress={() => addArrayItem(arrayName)}
      >
        <Plus size={16} color="#41B8F0" />
        <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", marginLeft: 8 }}>
          Add {isReel ? "Reel" : "Image"}
        </Text>
      </TouchableOpacity>
      {uploadError && (
        <Text style={{ fontFamily: "Poppins_400Regular" }} className="text-red-400 text-sm mt-2">{uploadError}</Text>
      )}
    </View>
  );

  const renderLinkArray = () => (
    <View className="mb-4">
      <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 15, marginBottom: 8 }}>Links</Text>
      {(editData.links || []).map((link: string, index: number) => (
        <View key={index} className="flex-row items-center mb-3">
          <View className="flex-1 mr-3">
            <Input
              value={link}
              onChangeText={(value) => updateArrayItem("links", index, value)}
              placeholder="Link URL"
            />
          </View>
          <TouchableOpacity
            className="bg-red-500/20 border border-red-500/40 p-3 rounded-xl"
            onPress={() => removeArrayItem("links", index)}
          >
            <Trash2 size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        style={{ borderColor: "#41B8F0", borderWidth: 1.5, backgroundColor: isDark ? "rgba(65, 184, 240, 0.1)" : "rgba(65, 184, 240, 0.08)" }}
        className="px-4 py-3 rounded-xl flex-row items-center justify-center"
        onPress={() => addArrayItem("links")}
      >
        <Plus size={16} color="#41B8F0" />
        <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", marginLeft: 8 }}>Add Link</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCoordinatorSearch = () => {
    const currentCoordinators = editData.coordinators || [];

    return (
      <View className="mb-4">
        {/* Header with counter & Add Manually button */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 15 }}>
            Coordinators ({currentCoordinators.length})
          </Text>
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: isDark ? "rgba(65, 184, 240, 0.15)" : "#E0F2FE",
              borderColor: "#41B8F0",
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
            }}
            onPress={() => {
              const nextVal = !showManualAddCoordinator;
              setShowManualAddCoordinator(nextVal);
              if (nextVal && searchTerm && searchTerm.includes("@")) {
                setManualCoordEmail(searchTerm.trim());
              }
            }}
            activeOpacity={0.7}
          >
            {showManualAddCoordinator ? (
              <>
                <X size={14} color="#41B8F0" />
                <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", fontSize: 12, marginLeft: 4 }}>
                  Cancel
                </Text>
              </>
            ) : (
              <>
                <Plus size={14} color="#41B8F0" />
                <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", fontSize: 12, marginLeft: 4 }}>
                  Add Manually
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Current coordinators list */}
        {currentCoordinators.length === 0 ? (
          <View
            style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
            className="rounded-xl p-4 mb-4 items-center justify-center"
          >
            <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 13, textAlign: "center" }}>
              No coordinators assigned yet. Please add at least one coordinator.
            </Text>
          </View>
        ) : (
          currentCoordinators.map((coordinator: any, index: number) => {
            const isEditingThis = editingCoordIndex === index;

            if (isEditingThis) {
              return (
                <View
                  key={index}
                  style={{
                    backgroundColor: isDark ? "#232328" : "#F8FAFC",
                    borderColor: "#41B8F0",
                    borderWidth: 1.5,
                  }}
                  className="rounded-xl p-4 mb-3"
                >
                  <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", fontSize: 14, marginBottom: 10 }}>
                    Edit Coordinator #{index + 1}
                  </Text>
                  <Input
                    label="Full Name *"
                    value={editCoordName}
                    onChangeText={setEditCoordName}
                    placeholder="Coordinator Name"
                    className="mb-2"
                  />
                  <Input
                    label="Email Address *"
                    value={editCoordEmail}
                    onChangeText={setEditCoordEmail}
                    placeholder="email@thapar.edu"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="mb-2"
                  />
                  <Input
                    label="Phone Number"
                    value={editCoordPhone}
                    onChangeText={setEditCoordPhone}
                    placeholder="e.g. +91 9876543210"
                    keyboardType="phone-pad"
                    className="mb-3"
                  />
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      style={{ backgroundColor: "#41B8F0" }}
                      className="flex-1 py-3 rounded-xl items-center justify-center flex-row"
                      onPress={() => saveCoordinatorEdit(index)}
                      activeOpacity={0.8}
                    >
                      <Check size={16} color="#FFFFFF" />
                      <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", marginLeft: 6, fontSize: 13 }}>
                        Done
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ backgroundColor: isDark ? "#2A2A30" : "#E5E7EB" }}
                      className="px-4 py-3 rounded-xl items-center justify-center"
                      onPress={cancelCoordinatorEdit}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 13 }}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }

            return (
              <View
                key={index}
                style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
                className="rounded-xl p-4 mb-3 flex-row items-center"
              >
                <View className="w-10 h-10 bg-[#41B8F0] rounded-full items-center justify-center mr-3">
                  <Text className="text-white font-bold text-base">
                    {coordinator.name?.charAt(0)?.toUpperCase() || "?"}
                  </Text>
                </View>
                <View className="flex-1 mr-2">
                  <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 14 }}>
                    {coordinator.name}
                  </Text>
                  <View className="flex-row items-center mt-0.5">
                    <Mail size={12} color={subTextColor} />
                    <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 12, marginLeft: 4 }}>
                      {coordinator.email}
                    </Text>
                  </View>
                  {coordinator.phone ? (
                    <View className="flex-row items-center mt-0.5">
                      <Phone size={12} color={subTextColor} />
                      <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 12, marginLeft: 4 }}>
                        {coordinator.phone}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View className="flex-row items-center gap-1.5">
                  <TouchableOpacity
                    style={{ backgroundColor: isDark ? "rgba(65, 184, 240, 0.15)" : "#E0F2FE", borderColor: "#41B8F0", borderWidth: 1 }}
                    className="p-2 rounded-lg"
                    onPress={() => startEditCoordinator(index)}
                    activeOpacity={0.7}
                  >
                    <Edit size={15} color="#41B8F0" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="bg-red-500/20 border border-red-500/40 p-2 rounded-lg"
                    onPress={() => removeCoordinator(index)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={15} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* Manual Add Form */}
        {showManualAddCoordinator && (
          <View
            style={{
              backgroundColor: isDark ? "#232328" : "#F8FAFC",
              borderColor: "#41B8F0",
              borderWidth: 1.5,
            }}
            className="rounded-xl p-4 mb-4"
          >
            <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", fontSize: 14, marginBottom: 10 }}>
              Add Coordinator Manually
            </Text>
            <Input
              label="Full Name *"
              value={manualCoordName}
              onChangeText={setManualCoordName}
              placeholder="e.g. John Doe"
              className="mb-2"
            />
            <Input
              label="Email Address *"
              value={manualCoordEmail}
              onChangeText={setManualCoordEmail}
              placeholder="e.g. jdoe_be24@thapar.edu"
              keyboardType="email-address"
              autoCapitalize="none"
              className="mb-2"
            />
            <Input
              label="Phone Number"
              value={manualCoordPhone}
              onChangeText={setManualCoordPhone}
              placeholder="e.g. +91 9876543210"
              keyboardType="phone-pad"
              className="mb-3"
            />
            <View className="flex-row gap-2">
              <TouchableOpacity
                style={{ backgroundColor: "#41B8F0" }}
                className="flex-1 py-3 rounded-xl items-center justify-center flex-row"
                onPress={handleManualAddCoordinator}
                activeOpacity={0.8}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", marginLeft: 6, fontSize: 13 }}>
                  Add to Coordinators
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ backgroundColor: isDark ? "#2A2A30" : "#E5E7EB" }}
                className="px-4 py-3 rounded-xl items-center justify-center"
                onPress={() => {
                  setShowManualAddCoordinator(false);
                  setManualCoordName("");
                  setManualCoordEmail("");
                  setManualCoordPhone("");
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 13 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Search for new coordinators */}
        <View className="mb-2">
          <Text style={{ fontFamily: "Poppins_500Medium", color: subTextColor, fontSize: 13, marginBottom: 6 }}>
            Or Search Registered User by Email
          </Text>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Input
                value={searchTerm}
                onChangeText={(value) => {
                  setSearchTerm(value);
                  setHasSearchedUser(false);
                  if (!value.trim()) {
                    setSearchResults([]);
                  }
                }}
                placeholder="Enter email (e.g. user@thapar.edu)..."
                autoCapitalize="none"
                keyboardType="email-address"
                containerStyle={{ marginBottom: 0 }}
              />
            </View>
            <TouchableOpacity
              style={{
                backgroundColor: "#41B8F0",
                height: 48,
                paddingHorizontal: 16,
                borderRadius: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                opacity: searching || !searchTerm.trim() ? 0.6 : 1,
              }}
              onPress={() => handleUserSearch(searchTerm)}
              disabled={searching || !searchTerm.trim()}
              activeOpacity={0.7}
            >
              {searching ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Search size={16} color="#FFFFFF" />
                  <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", fontSize: 13, marginLeft: 6 }}>
                    Search
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {searching && (
          <View className="flex-row items-center mb-3 mt-1">
            <ActivityIndicator size="small" color="#41B8F0" />
            <Text style={{ fontFamily: "Poppins_500Medium", color: subTextColor, marginLeft: 8, fontSize: 13 }}>
              Searching users...
            </Text>
          </View>
        )}

        {searchResults.length > 0 && (
          <View className="mb-3 mt-1">
            <Text style={{ fontFamily: "Poppins_500Medium", color: subTextColor, fontSize: 13, marginBottom: 8 }}>
              Found {searchResults.length} user
              {searchResults.length !== 1 ? "s" : ""}
            </Text>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              {searchResults.map((user) => (
                <TouchableOpacity
                  key={user.userId || user.email}
                  style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
                  className="rounded-xl p-3 mb-2 flex-row items-center"
                  onPress={() => addCoordinator(user)}
                  activeOpacity={0.7}
                >
                  <View className="w-9 h-9 bg-[#41B8F0] rounded-full items-center justify-center mr-3">
                    <Text className="text-white font-bold text-xs">
                      {user.displayName?.charAt(0)?.toUpperCase() || "?"}
                    </Text>
                  </View>
                  <View className="flex-1 mr-2">
                    <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 13 }}>
                      {user.displayName}
                    </Text>
                    <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 12 }}>
                      {user.email}
                    </Text>
                    {user.phoneNumber ? (
                      <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 11 }}>
                        {user.phoneNumber}
                      </Text>
                    ) : null}
                  </View>
                  <View className="bg-[#41B8F0]/20 border border-[#41B8F0]/30 px-2.5 py-1.5 rounded-lg flex-row items-center">
                    <Plus size={12} color="#41B8F0" />
                    <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", fontSize: 11, marginLeft: 3 }}>
                      Add
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {!searching && hasSearchedUser && searchResults.length === 0 && (
          <View style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }} className="rounded-xl p-3 mb-3">
            <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 12, marginBottom: 6 }}>
              No registered user found for "{searchTerm}".
            </Text>
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "flex-start",
                backgroundColor: isDark ? "rgba(65, 184, 240, 0.15)" : "#E0F2FE",
                borderColor: "#41B8F0",
                borderWidth: 1,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 8,
              }}
              onPress={() => {
                setShowManualAddCoordinator(true);
                if (searchTerm.includes("@")) {
                  setManualCoordEmail(searchTerm.trim());
                } else {
                  setManualCoordName(searchTerm.trim());
                }
              }}
            >
              <Plus size={12} color="#41B8F0" />
              <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", fontSize: 12, marginLeft: 4 }}>
                Add "{searchTerm}" Manually
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderVenueSearch = () => (
    <View className="mb-4">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 15 }}>Venue</Text>
        {editData.venueId ? (
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: isDark ? "rgba(65, 184, 240, 0.15)" : "#E0F2FE", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
            <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 11, color: "#41B8F0" }}>
              ID: {editData.venueId}
            </Text>
          </View>
        ) : null}
      </View>
      <Input
        value={venueSearchTerm !== "" ? venueSearchTerm : (editData.venueName || "")}
        onChangeText={(value) => {
          setVenueSearchTerm(value);
          const q = value.trim().toLowerCase();
          const matched = allVenues.find(
            (v: any) =>
              (v.venueName || "").toLowerCase() === q ||
              (v.venueId || "").toLowerCase() === q
          );

          setEditData({
            ...editData,
            venueName: value,
            venueId: matched ? matched.venueId : "",
          });

          handleVenueSearch(value);
        }}
        placeholder="Search for venue (e.g. Main Auditorium, OAT, Online)..."
      />

      {venueResults.length > 0 && (
        <View className="mt-2">
          <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
            {venueResults.map((venue) => {
              const isSelected = editData.venueId === venue.venueId;
              return (
                <TouchableOpacity
                  key={venue.venueId}
                  style={{
                    backgroundColor: isSelected ? (isDark ? "rgba(65, 184, 240, 0.15)" : "#E0F2FE") : cardBg,
                    borderColor: isSelected ? "#41B8F0" : cardBorder,
                    borderWidth: 1,
                  }}
                  className="rounded-xl p-3 mb-2 flex-row justify-between items-center"
                  onPress={() => {
                    setEditData({
                      ...editData,
                      venueName: venue.venueName,
                      venueId: venue.venueId,
                    });
                    setVenueSearchTerm(venue.venueName);
                    setVenueResults([]);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor }}>
                      {venue.venueName}
                    </Text>
                    <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 12 }}>
                      ID: {venue.venueId}
                    </Text>
                  </View>
                  {isSelected && <Check size={18} color="#41B8F0" />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );

  // Phase 3: Custom Field Rendering Components

  const renderFieldTypeSelector = (
    fieldIndex: number,
    currentType: CustomField["type"]
  ) => (
    <View className="mb-3">
      <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 13, marginBottom: 6 }}>Field Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {(["text", "number", "link", "select", "multi-select"] as const).map(
            (type) => (
              <TouchableOpacity
                key={type}
                style={{
                  backgroundColor: currentType === type ? "#41B8F0" : cardBg,
                  borderColor: currentType === type ? "#41B8F0" : cardBorder,
                  borderWidth: 1,
                }}
                className="px-3 py-2 rounded-lg"
                onPress={() => changeCustomFieldType(fieldIndex, type)}
              >
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    color: currentType === type ? "#FFFFFF" : subTextColor,
                    fontSize: 12,
                  }}
                >
                  {type === "multi-select"
                    ? "Multi-Select"
                    : type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </ScrollView>
    </View>
  );

  const renderCustomFieldOptions = (field: CustomField, fieldIndex: number) => {
    if (field.type !== "select" && field.type !== "multi-select") return null;

    return (
      <View className="mb-3">
        <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 13, marginBottom: 6 }}>Options</Text>
        {field.options.map((option, optionIndex) => (
          <View key={optionIndex} className="flex-row items-center mb-2">
            <View className="flex-1 mr-2">
              <Input
                value={option}
                onChangeText={(value) =>
                  updateFieldOption(fieldIndex, optionIndex, value)
                }
                placeholder="Option"
              />
            </View>
            <TouchableOpacity
              className="bg-red-500/20 border border-red-500/40 p-3 rounded-lg"
              onPress={() => removeFieldOption(fieldIndex, optionIndex)}
              disabled={field.options.length <= 1}
            >
              <Trash2 size={14} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          style={{ borderColor: "#41B8F0", borderWidth: 1.5, backgroundColor: isDark ? "rgba(65, 184, 240, 0.1)" : "rgba(65, 184, 240, 0.08)" }}
          className="px-3 py-2 rounded-lg flex-row items-center justify-center"
          onPress={() => addFieldOption(fieldIndex)}
        >
          <Plus size={14} color="#41B8F0" />
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", marginLeft: 6, fontSize: 13 }}>
            Add Option
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCustomFieldTypeSpecificFields = (
    field: CustomField,
    fieldIndex: number
  ) => {
    switch (field.type) {
      case "text":
      case "link":
        return (
          <Input
            label="Placeholder"
            value={field.placeholder || ""}
            onChangeText={(value) =>
              updateCustomField(fieldIndex, { placeholder: value })
            }
            placeholder="Placeholder text"
            className="mb-3"
          />
        );

      case "number":
        return (
          <View className="mb-3">
            <View className="flex-row gap-3 mb-3">
              <View className="flex-1">
                <Input
                  label="Min Value"
                  value={field.minValue?.toString() || ""}
                  onChangeText={(value) =>
                    updateCustomField(fieldIndex, {
                      minValue: value ? Number(value) : undefined,
                    })
                  }
                  placeholder="Min"
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <Input
                  label="Max Value"
                  value={field.maxValue?.toString() || ""}
                  onChangeText={(value) =>
                    updateCustomField(fieldIndex, {
                      maxValue: value ? Number(value) : undefined,
                    })
                  }
                  placeholder="Max"
                  keyboardType="numeric"
                />
              </View>
            </View>
            <Input
              label="Placeholder"
              value={field.placeholder || ""}
              onChangeText={(value) =>
                updateCustomField(fieldIndex, { placeholder: value })
              }
              placeholder="Placeholder text"
            />
          </View>
        );

      case "select":
      case "multi-select":
        return renderCustomFieldOptions(field, fieldIndex);

      default:
        return null;
    }
  };

  const renderCustomFields = () => (
    <View className="mb-4">
      <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 15, marginBottom: 8 }}>
        Custom Registration Fields
      </Text>

      {(editData.customFields || []).map(
        (field: CustomField, index: number) => (
          <View
            key={field.fieldId}
            style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
            className="rounded-xl p-4 mb-4"
          >
            {/* Field Header */}
            <View className="flex-row items-center justify-between mb-3">
              <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor }}>
                Field {index + 1}
              </Text>
              <TouchableOpacity
                className="bg-red-500/20 border border-red-500/40 p-2 rounded-lg"
                onPress={() => removeCustomField(index)}
              >
                <Trash2 size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>

            {/* Field Label */}
            <Input
              label="Field Label"
              value={field.label}
              onChangeText={(value) =>
                updateCustomField(index, { label: value })
              }
              placeholder="Field Label"
              className="mb-3"
            />

            {/* Field Type Selector */}
            {renderFieldTypeSelector(index, field.type)}

            {/* Required Toggle */}
            <View className="flex-row items-center justify-between mb-3">
              <Text style={{ fontFamily: "Poppins_500Medium", color: textColor, fontSize: 13 }}>
                Required Field
              </Text>
              <Switch
                value={field.isRequired}
                onValueChange={(value) =>
                  updateCustomField(index, { isRequired: value })
                }
                trackColor={{ false: isDark ? "#2C2C2E" : "#E5E7EB", true: "#41B8F0" }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Type-specific fields */}
            {renderCustomFieldTypeSpecificFields(field, index)}
          </View>
        )
      )}

      {/* Add Custom Field Button */}
      <TouchableOpacity
        style={{ borderColor: "#41B8F0", borderWidth: 1.5, backgroundColor: isDark ? "rgba(65, 184, 240, 0.1)" : "rgba(65, 184, 240, 0.08)" }}
        className="px-4 py-3 rounded-xl flex-row items-center justify-center"
        onPress={addCustomField}
      >
        <Plus size={16} color="#41B8F0" />
        <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", marginLeft: 8 }}>Add Custom Field</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEditMode = () => (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
      {/* Basic Information */}
      {renderSection(
        "Basic Information",
        <>
          <Input
            label="Event Title"
            value={editData.title || ""}
            onChangeText={(value) => setEditData({ ...editData, title: value })}
            placeholder="e.g. Hackathon 2025"
            className="mb-4"
          />

          {renderCategorySelector()}

          <Input
            label="Short Description"
            value={editData.shortDescription || ""}
            onChangeText={(value) =>
              setEditData({ ...editData, shortDescription: value })
            }
            placeholder="A one-line summary for quick reference"
            className="mb-4"
          />

          <Input
            label="Full Description"
            value={editData.description || ""}
            onChangeText={(value) =>
              setEditData({ ...editData, description: value })
            }
            placeholder="Describe the event, rules, and what to expect. Supports Markdown formatting."
            multiline
            numberOfLines={6}
            className="mb-4"
          />

          <Input
            label="Cover Image URL"
            value={editData.coverImage || ""}
            onChangeText={(value) =>
              setEditData({ ...editData, coverImage: value })
            }
            placeholder="https://... (Recommended: 16:9 aspect ratio, high quality)"
            className="mb-4"
          />

          {/* Image Preview */}
          {editData.coverImage && (
            <View className="mb-4">
              <Text style={{ fontFamily: "Poppins_500Medium", color: subTextColor, fontSize: 13, marginBottom: 8 }}>Image Preview:</Text>
              <View style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }} className="h-32 rounded-xl overflow-hidden">
                <Image
                  source={{ uri: editData.coverImage }}
                  className="w-full h-full"
                  resizeMode="cover"
                  onError={() => {
                    // Handle image load error silently
                  }}
                />
              </View>
            </View>
          )}

          {renderEventTypeSelector()}

          {/* External URL field for external link events */}
          {editData.eventType === "externalLink" && (
            <Input
              label="External URL"
              value={editData.externalUrl || ""}
              onChangeText={(value) =>
                setEditData({ ...editData, externalUrl: value })
              }
              placeholder="https://..."
              className="mb-4"
            />
          )}

          {/* Team-specific fields */}
          {editData.eventType === "team" && (
            <>
              <View className="flex-row gap-4 mb-4">
                <View className="flex-1">
                  <Input
                    label="Min Team Size"
                    value={editData.minTeamSize ? editData.minTeamSize.toString() : ""}
                    onChangeText={(value) => {
                      if (value === "" || /^\d+$/.test(value)) {
                        setEditData({
                          ...editData,
                          minTeamSize:
                            value === "" ? "" : parseInt(value) || "",
                        });
                      }
                    }}
                    placeholder="Empty = no minimum"
                    keyboardType="numeric"
                  />
                </View>
                <View className="flex-1">
                  <Input
                    label="Max Team Size"
                    value={editData.maxTeamSize ? editData.maxTeamSize.toString() : ""}
                    onChangeText={(value) => {
                      if (value === "" || /^\d+$/.test(value)) {
                        setEditData({
                          ...editData,
                          maxTeamSize:
                            value === "" ? "" : parseInt(value) || "",
                        });
                      }
                    }}
                    placeholder="Empty = no maximum"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {renderSwitchField(
                "Same College Only",
                editData.sameCollegeOnly || false,
                (value) => setEditData({ ...editData, sameCollegeOnly: value }),
                "Restrict team members to same college"
              )}
            </>
          )}

          {renderSwitchField(
            "Featured Event",
            editData.isFeatured || false,
            (value) => setEditData({ ...editData, isFeatured: value }),
            "Display this event prominently on the homepage"
          )}
        </>,
        <Info size={20} color="#41B8F0" />
      )}

      {/* Event Dates & Venue */}
      {renderSection(
        "Event Dates & Venue",
        <>
          {renderDateTimeInput(
            "Registration Deadline",
            "registrationDeadline",
            editData.registrationDeadline || ""
          )}

          {renderDateTimeInput(
            "Start Date & Time",
            "startDateTime",
            editData.startDateTime || ""
          )}

          {renderDateTimeInput(
            "End Date & Time",
            "endDateTime",
            editData.endDateTime || ""
          )}

          {renderDateTimeInput(
            "Event Date & Time",
            "dateTime",
            editData.dateTime || ""
          )}

          {/* Venue and max participants only for non-external events */}
          {editData.eventType !== "externalLink" && (
            <>
              {renderVenueSearch()}

              <Input
                label="Max Participants"
                value={
                  editData.maxParticipants && Number(editData.maxParticipants) > 0
                    ? editData.maxParticipants.toString()
                    : ""
                }
                onChangeText={(value) => {
                  if (value === "" || /^\d+$/.test(value)) {
                    setEditData({
                      ...editData,
                      maxParticipants:
                        value === "" ? 0 : parseInt(value, 10) || 0,
                    });
                  }
                }}
                placeholder="Leave empty for unlimited"
                keyboardType="numeric"
              />
            </>
          )}
        </>,
        <Calendar size={20} color="#41B8F0" />
      )}

      {/* Event Settings */}
      {renderSection(
        "Event Settings",
        <>
          {renderSwitchField(
            "Public Event",
            editData.isPublic !== false,
            (value) => setEditData({ ...editData, isPublic: value }),
            "Make event visible to public"
          )}

          {renderSwitchField(
            "Payment Required",
            editData.paymentRequired || false,
            (value) =>
              setEditData({
                ...editData,
                paymentRequired: value,
                paymentStarted: false,
              }),
            "Enable registration fees"
          )}

          {renderSwitchField(
            "Require Admin Approval",
            editData.requireAdminApproval || false,
            (value) =>
              setEditData({ ...editData, requireAdminApproval: value }),
            "Registrations need admin approval"
          )}

          {/* Payment Type selector for team events */}
          {editData.eventType === "team" && (
            <View className="mb-4">
              <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 14, marginBottom: 8 }}>
                Payment Type
              </Text>
              <View className="flex-row gap-3">
                {["fixed", "perHead"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={{
                      backgroundColor: editData.paymentType === type ? "#41B8F0" : cardBg,
                      borderColor: editData.paymentType === type ? "#41B8F0" : cardBorder,
                      borderWidth: 1,
                    }}
                    className="flex-1 px-4 py-3 rounded-xl"
                    onPress={() =>
                      setEditData({ ...editData, paymentType: type })
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        color: editData.paymentType === type ? "#FFFFFF" : subTextColor,
                        textAlign: "center",
                        textTransform: "capitalize",
                      }}
                    >
                      {type === "perHead" ? "Per Head" : "Fixed"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 12, marginTop: 8 }}>
                Choose how registration fees are charged for teams
              </Text>
            </View>
          )}

          {/* Payment fields only show when payment is required */}
          {editData.paymentRequired && (
            <>
              {renderSwitchField(
                "Payment Started",
                editData.paymentStarted || false,
                (value) => setEditData({ ...editData, paymentStarted: value }),
                "Allow users to make payments"
              )}

              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Input
                    label="Host Fee (₹)"
                    value={editData.registrationFee?.host?.toString() || ""}
                    onChangeText={(value) => {
                      if (value === "" || /^\d+$/.test(value)) {
                        setEditData({
                          ...editData,
                          registrationFee: {
                            ...editData.registrationFee,
                            host: value === "" ? 0 : parseInt(value) || 0,
                          },
                        });
                      }
                    }}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
                <View className="flex-1">
                  <Input
                    label="Other Fee (₹)"
                    value={editData.registrationFee?.other?.toString() || ""}
                    onChangeText={(value) => {
                      if (value === "" || /^\d+$/.test(value)) {
                        setEditData({
                          ...editData,
                          registrationFee: {
                            ...editData.registrationFee,
                            other: value === "" ? 0 : parseInt(value) || 0,
                          },
                        });
                      }
                    }}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </>
          )}
        </>,
        <Settings size={20} color="#41B8F0" />
      )}

      {/* Prizes & Media */}
      {renderSection(
        "Prizes & Media",
        <>
          <Input
            label="Prizes"
            value={editData.prizes || ""}
            onChangeText={(value) =>
              setEditData({ ...editData, prizes: value })
            }
            placeholder="e.g. ₹10,000 Cash Prize, Goodies, Certificates. Supports Markdown."
            multiline
            numberOfLines={4}
            className="mb-4"
          />

          <Input
            label="Short Prizes"
            value={editData.shortPrizes || ""}
            onChangeText={(value) =>
              setEditData({ ...editData, shortPrizes: value })
            }
            placeholder="e.g. Cash, Goodies, Certificates"
            className="mb-4"
          />

          <Input
            label="Rules & Guidelines"
            value={editData.rules || ""}
            onChangeText={(value) => setEditData({ ...editData, rules: value })}
            placeholder="List the rules and guidelines for the event. Supports Markdown formatting."
            multiline
            numberOfLines={6}
            className="mb-4"
          />

          {/* Dynamic Arrays for Media */}
          {renderImageArray("Additional Images", "images")}
          {renderLinkArray()}
          {renderImageArray("Reels", "reelsId", true)}
        </>,
        <Award size={20} color="#41B8F0" />
      )}

      {/* Coordinators */}
      {renderSection(
        "Coordinators",
        <>
          {renderCoordinatorSearch()}
          <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 13 }}>
            Optional. Search by name or email to add coordinators.
          </Text>
        </>,
        <UserPlus size={20} color="#41B8F0" />
      )}

      {/* Custom Registration Fields */}
      {renderSection(
        "Custom Registration Fields",
        <>{renderCustomFields()}</>,
        <Info size={20} color="#41B8F0" />
      )}

      {/* Action Buttons */}
      <View
        style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
        className="rounded-2xl p-5 mb-6 shadow-sm"
      >
        <View className="flex-row gap-3">
          <TouchableOpacity
            style={{ backgroundColor: "#41B8F0", opacity: saving ? 0.7 : 1 }}
            className="flex-1 py-4 rounded-xl flex-row items-center justify-center shadow-sm"
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", marginLeft: 8 }}>Saving...</Text>
              </>
            ) : (
              <>
                <Save size={18} color="#FFFFFF" />
                <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", marginLeft: 8 }}>
                  Save Changes
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={{ backgroundColor: isDark ? "#2A2A30" : "#E5E7EB" }}
            className="flex-1 py-4 rounded-xl flex-row items-center justify-center"
            onPress={handleCancel}
            disabled={saving}
            activeOpacity={0.7}
          >
            <X size={18} color={textColor} />
            <Text style={{ fontFamily: "Poppins_600SemiBold", color: textColor, marginLeft: 8 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <View className="flex-1 bg-transparent p-6">
      {isEditing ? renderEditMode() : renderViewMode()}
    </View>
  );
}
