import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Image,
  ActivityIndicator,
  FlatList,
  Dimensions,
  TextInput,
  Keyboard,
} from "react-native";
import { showAlert } from "../index";
import Mapbox, {
  Camera,
  MapView,
  MarkerView,
  ShapeSource,
  LineLayer,
  CircleLayer,
} from "@rnmapbox/maps";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  User,
  CalendarDays,
  MapPin,
  Search,
  X,
  Navigation,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  CornerDownLeft,
  CornerDownRight,
  Flag,
  CheckCircle,
} from "lucide-react-native";
import { Venue, FirebaseEvent } from "@/types/models";
import { CAMPUS_LOCATIONS } from "@/data/campusLocations";
import { useVenues } from "@/hooks/useVenues";
import { listEvents } from "@/api/events";
import * as Location from "expo-location";
import {
  useNavigationLogic,
  parseSteps,
  buildFallbackInstruction,
  formatDistance,
  RouteStep,
  MapboxDirectionsResponse,
} from "@/hooks/useNavigation";

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

const MAPBOX_TOKEN =
  "pk.eyJ1IjoiamFzaGFuMjAwMyIsImEiOiJjbWdhbHRkNTkwbm1vMmlxdGRrdnpvazR4In0.Uy3g_PaeGdaoUAmTdRl_-w";
Mapbox.setAccessToken(MAPBOX_TOKEN);

// ---------------------------------------------------------------------------
// Destination type
// ---------------------------------------------------------------------------

interface Destination {
  lat: number;
  lng: number;
  name: string;
}

// ---------------------------------------------------------------------------
// Maneuver icon helper
// ---------------------------------------------------------------------------

function ManeuverIcon({
  step,
  size = 24,
  color = "#fff",
}: {
  step: RouteStep | null;
  size?: number;
  color?: string;
}) {
  if (!step) return <ArrowUp size={size} color={color} />;
  const { type, modifier } = step.maneuver;
  if (type === "arrive") return <Flag size={size} color={color} />;
  if (type === "turn") {
    if (modifier === "left" || modifier === "sharp left")
      return <ArrowLeft size={size} color={color} />;
    if (modifier === "right" || modifier === "sharp right")
      return <ArrowRight size={size} color={color} />;
    if (modifier === "slight left")
      return <CornerDownLeft size={size} color={color} />;
    if (modifier === "slight right")
      return <CornerDownRight size={size} color={color} />;
  }
  if (type === "depart") return <Navigation size={size} color={color} />;
  return <ArrowUp size={size} color={color} />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MapScreen() {
  const router = useRouter();
  const cameraRef = useRef<Camera>(null);
  const [showCarousel, setShowCarousel] = useState(false);
  const carouselRef = useRef<FlatList>(null);
  const mapRef = useRef<MapView>(null);

  const { venues, refresh: refreshVenues } = useVenues();
  const [events, setEvents] = useState<FirebaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null
  );
  const [destination, setDestination] = useState<Destination | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Keep a ref so the GPS callback can access the latest destination without
  // needing it in the dependency array (avoids recreating the subscription).
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;

  const initialCenter = { lat: 30.353539, lng: 76.368524 };

  // ── Carousel animation ────────────────────────────────────────────────────
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  const CAROUSEL_HEIGHT = screenHeight * 0.25;
  const CARD_WIDTH = screenWidth * 0.8;
  const CARD_MARGIN = 10;
  const SIDE_SPACING = (screenWidth - CARD_WIDTH) / 2;
  const translateY = useSharedValue(CAROUSEL_HEIGHT);
  const buttonsTranslateY = useSharedValue(0);

  // ── Navigation hook ───────────────────────────────────────────────────────
  const handleRerouteSuccess = useCallback(
    (coords: [number, number][], _steps: RouteStep[]) => {
      // Fit camera to new route after reroute
      if (coords.length >= 2) {
        const bounds = coords.reduce<{ ne: [number, number]; sw: [number, number] }>(
          (acc, coord) => ({
            ne: [Math.max(acc.ne[0], coord[0]), Math.max(acc.ne[1], coord[1])] as [number, number],
            sw: [Math.min(acc.sw[0], coord[0]), Math.min(acc.sw[1], coord[1])] as [number, number],
          }),
          { ne: [coords[0][0], coords[0][1]], sw: [coords[0][0], coords[0][1]] }
        );
        cameraRef.current?.fitBounds(bounds.ne, bounds.sw, [100, 50, 100, 50], 1000);
      }
    },
    []
  );

  const nav = useNavigationLogic(destination, MAPBOX_TOKEN, handleRerouteSuccess);

  // ── Stable ref to onLocationUpdate ───────────────────────────────────────
  // Keeps the watcher callback decoupled from the nav object identity so that
  // getUserLocation never needs to be recreated when nav re-renders.
  const onLocationUpdateRef = useRef(nav.onLocationUpdate);
  onLocationUpdateRef.current = nav.onLocationUpdate;

  // ── GPS subscription ──────────────────────────────────────────────────────
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // getUserLocation has NO dependency on nav — it reads via onLocationUpdateRef.
  const getUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showAlert("Location permission denied — continuing without location.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const userLoc = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };

      if (!isMountedRef.current) return;
      setUserLocation(userLoc);
      setIsFollowingUser(true);

      if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: [userLoc.lng, userLoc.lat],
          zoomLevel: 17,
          animationDuration: 1000,
        });
      }

      // Remove any existing watcher
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 3,
          timeInterval: 2000,
        },
        (loc) => {
          if (!isMountedRef.current) return;
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;
          setUserLocation({ lat, lng });
          // Read through ref — always calls the latest version without
          // needing nav in the dependency array.
          onLocationUpdateRef.current(lat, lng);
        }
      );
    } catch (error) {
      console.error("Error getting user location:", error);
      showAlert("Error", "Failed to get your location");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — intentionally no deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      locationSubscription.current?.remove();
    };
  }, []);

  // ── Camera tracking ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!userLocation || !isFollowingUser) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [userLocation.lng, userLocation.lat],
      animationDuration: 800,
    });
  }, [userLocation, isFollowingUser]);

  // ── Data fetching (cached in frontend via useVenues) ───────────────────────
  const fetchVenues = useCallback(async () => {
    try {
      setLoading(true);
      await refreshVenues();
    } catch (error) {
      console.error("Error refreshing venues:", error);
      showAlert("Error", "Failed to load venue locations");
    } finally {
      setLoading(false);
    }
  }, [refreshVenues]);

  const fetchEvents = useCallback(async () => {
    try {
      const fetchedEvents = await listEvents();
      setEvents(fetchedEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  }, []);

  // Run once on mount only. fetchVenues/fetchEvents/getUserLocation are all
  // stable useCallbacks with empty dep arrays, so listing them here is safe,
  // but we use [] to make the intent absolutely explicit and avoid any future
  // re-trigger if deps accidentally change.
  useEffect(() => {
    fetchVenues();
    fetchEvents();
    getUserLocation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only

  // ── Roads GeoJSON ─────────────────────────────────────────────────────────
  const roadsGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [76.359321, 30.350411],
              [76.358524, 30.356983],
            ],
          },
        },
        {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [76.359321, 30.350411],
              [76.373976, 30.352147],
            ],
          },
        },
        {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [76.373976, 30.352147],
              [76.373263, 30.35861],
            ],
          },
        },
        {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [76.358524, 30.356983],
              [76.373263, 30.35861],
            ],
          },
        },
      ],
    }),
    []
  );

  // ── Map controls ──────────────────────────────────────────────────────────
  const zoomIn = useCallback(async () => {
    const zoom = await mapRef.current?.getZoom();
    if (zoom !== undefined) {
      cameraRef.current?.setCamera({
        zoomLevel: Math.min(zoom + 1, 19),
        animationDuration: 300,
      });
    }
  }, []);

  const zoomOut = useCallback(async () => {
    const zoom = await mapRef.current?.getZoom();
    if (zoom !== undefined) {
      cameraRef.current?.setCamera({
        zoomLevel: Math.max(zoom - 1, 14),
        animationDuration: 300,
      });
    }
  }, []);

  const goToMainLocation = useCallback(() => {
    cameraRef.current?.setCamera({
      centerCoordinate: [initialCenter.lng, initialCenter.lat],
      zoomLevel: 16,
      animationDuration: 1000,
    });
  }, [initialCenter.lat, initialCenter.lng]);

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 3) {
      setSearchResults([]);
      return;
    }
    try {
      setIsSearching(true);
      const queryLower = text.toLowerCase();
      const localMatches = CAMPUS_LOCATIONS.filter((loc) => {
        if (loc.name.toLowerCase().includes(queryLower)) return true;
        if (
          loc.keywords &&
          loc.keywords.some((kw) => kw.toLowerCase().includes(queryLower))
        )
          return true;
        return false;
      }).map((loc) => ({
        id: `local_${loc.id}`,
        text: loc.name,
        place_name: "Campus Location",
        center: [loc.lng, loc.lat],
        isLocal: true,
      }));
      setSearchResults(localMatches);
    } catch (error) {
      console.error("Error searching location:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // ── Route fetching ────────────────────────────────────────────────────────
  const getRoute = async (destCoords: [number, number], destName: string) => {
    if (!userLocationRef.current) {
      showAlert("Location Required", "We need your location to provide directions.");
      return;
    }

    try {
      setLoading(true);
      setSearchResults([]);
      Keyboard.dismiss();

      const { lat, lng } = userLocationRef.current;
      const start = `${lng},${lat}`;
      const end = `${destCoords[0]},${destCoords[1]}`;
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/walking/${start};${end}` +
        `?geometries=geojson&steps=true&overview=full&banner_instructions=true` +
        `&voice_instructions=true&access_token=${MAPBOX_TOKEN}`;

      const response = await fetch(url);
      if (!response.ok) {
        showAlert("Error", `Directions request failed (${response.status})`);
        return;
      }

      const data: MapboxDirectionsResponse = await response.json();

      if (data.code !== "Ok" || !data.routes?.length) {
        showAlert("No Route", data.message ?? "Could not find a walking route.");
        return;
      }

      const route = data.routes[0];
      const coords: [number, number][] = route.geometry.coordinates;

      if (coords.length < 2) {
        showAlert("Error", "Route returned by server is invalid.");
        return;
      }

      const newDest: Destination = {
        lat: destCoords[1],
        lng: destCoords[0],
        name: destName,
      };
      setDestination(newDest);

      const steps = parseSteps(route);
      nav.initRoute(coords, steps);

      // Fit camera to route
      const bounds = coords.reduce<{ ne: [number, number]; sw: [number, number] }>(
        (acc, coord) => ({
          ne: [Math.max(acc.ne[0], coord[0]), Math.max(acc.ne[1], coord[1])] as [number, number],
          sw: [Math.min(acc.sw[0], coord[0]), Math.min(acc.sw[1], coord[1])] as [number, number],
        }),
        { ne: [coords[0][0], coords[0][1]], sw: [coords[0][0], coords[0][1]] }
      );
      cameraRef.current?.fitBounds(bounds.ne, bounds.sw, [100, 50, 100, 50], 1000);
      setIsFollowingUser(false);
    } catch (error) {
      console.error("Error fetching route:", error);
      showAlert("Error", "Failed to fetch directions.");
    } finally {
      setLoading(false);
    }
  };

  // ── Clear route / finish navigation ──────────────────────────────────────
  const clearRoute = useCallback(() => {
    nav.resetNavigation();
    setDestination(null);
    setSearchQuery("");
    if (userLocationRef.current) {
      cameraRef.current?.setCamera({
        centerCoordinate: [userLocationRef.current.lng, userLocationRef.current.lat],
        zoomLevel: 17,
        animationDuration: 1000,
      });
    }
  }, [nav]);

  // ── Marker / carousel handlers ────────────────────────────────────────────
  const handleMarkerPress = useCallback(
    (venue: Venue) => {
      setSelectedVenue(venue);
      setShowCarousel(true);
      translateY.value = withSpring(0);
      buttonsTranslateY.value = withSpring(-CAROUSEL_HEIGHT);
    },
    [translateY, buttonsTranslateY, CAROUSEL_HEIGHT]
  );

  const handleMapPress = useCallback(() => {
    if (showCarousel) {
      setShowCarousel(false);
      setSelectedVenue(null);
      translateY.value = withSpring(CAROUSEL_HEIGHT);
      buttonsTranslateY.value = withSpring(0);
    }
  }, [showCarousel, CAROUSEL_HEIGHT, translateY, buttonsTranslateY]);

  const venueEvents = useMemo(() => {
    if (!selectedVenue) return [];
    const targetVenueId = selectedVenue.venueId || "";
    const targetVenueName = (selectedVenue.venueName || "").trim().toLowerCase();

    const filteredEvents = events.filter((event) => {
      if (targetVenueId && event.venueId === targetVenueId) return true;
      if (
        targetVenueName &&
        event.venueName &&
        event.venueName.trim().toLowerCase() === targetVenueName
      )
        return true;
      return false;
    });

    return filteredEvents.map((event, index) => ({
      ...event,
      uniqueKey: `${event.eventId}-${index}`,
    }));
  }, [selectedVenue, events]);

  // ── Gesture handler ───────────────────────────────────────────────────────
  const startY = useSharedValue(0);
  const gestureHandler = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (
        event.translationY > 0 &&
        Math.abs(event.translationY) > Math.abs(event.translationX)
      ) {
        translateY.value = startY.value + event.translationY;
      }
    })
    .onEnd((event) => {
      if (
        event.translationY > 100 &&
        Math.abs(event.translationY) > Math.abs(event.translationX)
      ) {
        runOnJS(setShowCarousel)(false);
        runOnJS(setSelectedVenue)(null);
        translateY.value = withSpring(CAROUSEL_HEIGHT);
        buttonsTranslateY.value = withSpring(0);
      } else {
        translateY.value = withSpring(0);
        buttonsTranslateY.value = withSpring(-CAROUSEL_HEIGHT);
      }
    });

  const carouselStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const controlButtonsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: buttonsTranslateY.value }],
  }));

  // ── Current step for nav card ─────────────────────────────────────────────
  const currentStep: RouteStep | null = nav.steps[nav.currentStepIndex] ?? null;
  const nextStep: RouteStep | null = nav.steps[nav.currentStepIndex + 1] ?? null;
  const currentInstruction = currentStep
    ? buildFallbackInstruction(currentStep)
    : null;
  const currentDistance = currentStep ? formatDistance(currentStep.distance) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        styleURL="mapbox://styles/mapbox/streets-v12"
        onPress={handleMapPress}
        onTouchStart={() => setIsFollowingUser(false)}
        onDidFinishLoadingMap={() => setMapLoaded(true)}
      >
        {/* Camera – zoomLevel and minZoomLevel must be compatible */}
        <Camera
          ref={cameraRef}
          zoomLevel={15}
          minZoomLevel={13}
          centerCoordinate={[initialCenter.lng, initialCenter.lat]}
          animationMode="flyTo"
          animationDuration={1000}
        />

        {/* Roads layer */}
        <ShapeSource id="roads" shape={roadsGeoJSON}>
          <LineLayer
            id="roads-line"
            style={{
              lineColor: "#666666",
              lineWidth: 6,
              lineOpacity: 0.7,
            }}
          />
        </ShapeSource>

        {/* Venue markers */}
        {venues.map((venue) => {
          const lat = venue.lat || venue.latitude || 0;
          const lng = venue.lng || venue.longitude || 0;

          return (
            <MarkerView
              key={venue.venueId}
              coordinate={[lng, lat]}
              anchor={{ x: 0.5, y: 1 }}
            >
              <TouchableOpacity
                onPress={() => handleMarkerPress(venue)}
                style={styles.venueMarker}
              >
                <Image
                  source={require("@/assets/ic_tech.png")}
                  style={{ width: 35, height: 40, borderRadius: 12 }}
                />
              </TouchableOpacity>
            </MarkerView>
          );
        })}

        {/* User location marker */}
        {userLocation && (
          <>
            <ShapeSource
              id="user-location-circles"
              shape={{
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    properties: { radius: 60 },
                    geometry: {
                      type: "Point",
                      coordinates: [userLocation.lng, userLocation.lat],
                    },
                  },
                  {
                    type: "Feature",
                    properties: { radius: 40 },
                    geometry: {
                      type: "Point",
                      coordinates: [userLocation.lng, userLocation.lat],
                    },
                  },
                  {
                    type: "Feature",
                    properties: { radius: 10 },
                    geometry: {
                      type: "Point",
                      coordinates: [userLocation.lng, userLocation.lat],
                    },
                  },
                ],
              }}
            >
              <CircleLayer
                id="user-location-circle"
                style={{
                  circleRadius: [
                    "interpolate",
                    ["linear"],
                    ["get", "radius"],
                    10, 10,
                    40, 40,
                    60, 60,
                  ],
                  circleColor: [
                    "match",
                    ["get", "radius"],
                    10, "transparent",
                    40, "#FFB6C1",
                    60, "#FFB6C1",
                    "#FFB6C1",
                  ],
                  circleOpacity: [
                    "match",
                    ["get", "radius"],
                    10, 0.8,
                    40, 0.3,
                    60, 0.2,
                    0.2,
                  ],
                  circleStrokeWidth: 1,
                  circleStrokeColor: [
                    "match",
                    ["get", "radius"],
                    10, "transparent",
                    "#FFB6C1",
                  ],
                }}
              />
            </ShapeSource>

            <MarkerView
              coordinate={[userLocation.lng, userLocation.lat]}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <User size={28} />
            </MarkerView>
          </>
        )}

        {/* Navigation Route (trimmed) */}
        {nav.trimmedGeoJSON && (
          <ShapeSource id="route-source" shape={nav.trimmedGeoJSON}>
            <LineLayer
              id="route-line"
              style={{
                lineColor: "#4285F4",
                lineWidth: 5,
                lineJoin: "round",
                lineCap: "round",
              }}
            />
          </ShapeSource>
        )}

        {/* Destination Marker */}
        {destination && (
          <MarkerView
            coordinate={[destination.lng, destination.lat]}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  backgroundColor: "#4285F4",
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                  marginBottom: 4,
                }}
              >
                <Text style={{ color: "white", fontSize: 12, fontWeight: "bold" }}>
                  {destination.name}
                </Text>
              </View>
              <MapPin size={32} color="#4285F4" fill="#ffffff" />
            </View>
          </MarkerView>
        )}
      </MapView>

      {/* ── Header with Search ───────────────────────────────────────────── */}
      <View style={styles.headerContainer}>
        <View style={styles.searchBarContainer}>
          <TouchableOpacity
            style={styles.backButtonInline}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.searchInputContainer}>
            <Search size={20} color="#666" style={{ marginLeft: 10 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search destination..."
              value={searchQuery}
              onChangeText={handleSearch}
              placeholderTextColor="#999"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                style={{ padding: 5, marginRight: 5 }}
              >
                <X size={18} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <View style={styles.searchResultsContainer}>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 250 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => getRoute(item.center, item.text)}
                >
                  <MapPin size={20} color="#666" style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultTitle}>{item.text}</Text>
                    {item.place_name && (
                      <Text style={styles.searchResultSubtitle} numberOfLines={1}>
                        {item.place_name.replace(`${item.text}, `, "")}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* ── Navigation Instruction Card ──────────────────────────────────── */}
      {destination && !nav.hasArrived && nav.steps.length > 0 && (
        <View style={styles.navCard}>
          {nav.isRerouting ? (
            <View style={styles.navCardRerouting}>
              <ActivityIndicator size="small" color="#4285F4" />
              <Text style={styles.navCardReroutingText}>Finding new route…</Text>
            </View>
          ) : (
            <>
              <View style={styles.navCardIcon}>
                <ManeuverIcon step={currentStep} size={26} color="#fff" />
              </View>
              <View style={styles.navCardContent}>
                <Text style={styles.navCardInstruction} numberOfLines={2}>
                  {currentInstruction ?? "Follow the route"}
                </Text>
                {currentDistance && (
                  <Text style={styles.navCardDistance}>{currentDistance}</Text>
                )}
                {nextStep && (
                  <Text style={styles.navCardNext} numberOfLines={1}>
                    Then: {buildFallbackInstruction(nextStep)}
                  </Text>
                )}
              </View>
            </>
          )}
        </View>
      )}

      {/* ── Control Buttons ──────────────────────────────────────────────── */}
      <Animated.View style={[styles.controlButtons, controlButtonsStyle]}>
        {destination && (
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: "#FF4444" }]}
            onPress={clearRoute}
          >
            <X size={24} color="#FFF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.controlButton} onPress={zoomIn}>
          <Ionicons name="add" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={zoomOut}>
          <Ionicons name="remove" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={goToMainLocation}>
          <Ionicons name="navigate" size={22} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            setIsFollowingUser(true);
            if (userLocation && cameraRef.current) {
              cameraRef.current.setCamera({
                centerCoordinate: [userLocation.lng, userLocation.lat],
                zoomLevel: 17,
                animationDuration: 1000,
              });
            } else {
              getUserLocation();
            }
          }}
        >
          <Ionicons
            name="location"
            size={22}
            color={
              userLocation ? (isFollowingUser ? "#4285F4" : "#333") : "#666"
            }
          />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Loading Overlay ───────────────────────────────────────────────── */}
      {(loading || !mapLoaded) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#FFBA00" />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        </View>
      )}

      {/* ── Arrival Overlay ───────────────────────────────────────────────── */}
      {nav.hasArrived && destination && (
        <View style={styles.arrivalOverlay}>
          <View style={styles.arrivalCard}>
            <CheckCircle size={64} color="#4CAF50" />
            <Text style={styles.arrivalHeading}>You've Arrived!</Text>
            <Text style={styles.arrivalDestName}>{destination.name}</Text>
            <Text style={styles.arrivalSubtext}>
              You have reached your destination.
            </Text>
            <TouchableOpacity
              style={styles.arrivalFinishBtn}
              onPress={clearRoute}
            >
              <Text style={styles.arrivalFinishBtnText}>Finish Navigation</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Event Carousel ────────────────────────────────────────────────── */}
      {showCarousel && (
        <Animated.View style={[styles.carouselContainer, carouselStyle]}>
          <GestureDetector gesture={gestureHandler}>
            <Animated.View style={styles.carouselHandleArea}>
              <View style={styles.carouselHandle} />
            </Animated.View>
          </GestureDetector>
          {venueEvents.length > 0 ? (
            <FlatList
              ref={carouselRef}
              data={venueEvents}
              horizontal
              pagingEnabled={false}
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={[
                styles.carouselContent,
                { paddingHorizontal: SIDE_SPACING - CARD_MARGIN },
              ]}
              renderItem={({ item: event }) => (
                <TouchableOpacity
                  style={styles.carouselCard}
                  onPress={() => {
                    setShowCarousel(false);
                    setSelectedVenue(null);
                    router.push({
                      pathname: "/events/EventDetails",
                      params: { eventData: JSON.stringify(event) },
                    });
                  }}
                >
                  <View style={styles.carouselCardImageContainer}>
                    {event.coverImage ? (
                      <Image
                        source={{ uri: event.coverImage }}
                        style={styles.carouselCardImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.carouselCardImagePlaceholder}>
                        <CalendarDays size={30} color="#ccc" />
                      </View>
                    )}
                    <View style={styles.carouselCardBadge}>
                      <Text style={styles.carouselCardBadgeText}>
                        {event.category}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.carouselCardInfo}>
                    <Text style={styles.carouselCardTitle} numberOfLines={2}>
                      {event.title}
                    </Text>
                    <Text
                      style={styles.carouselCardDescription}
                      numberOfLines={2}
                    >
                      {event.shortDescription || event.description}
                    </Text>

                    <View style={styles.carouselCardFooter}>
                      <View style={styles.carouselCardDateContainer}>
                        <CalendarDays size={12} color="#666" />
                        <Text style={styles.carouselCardDate}>
                          {new Date(
                            event.dateTime || event.startDateTime
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                      </View>

                      {event.paymentRequired && (
                        <View style={styles.carouselCardPriceContainer}>
                          <Text style={styles.carouselCardPrice}>
                            ₹
                            {event.registrationFee?.host ||
                              event.registrationFee?.other ||
                              0}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.uniqueKey || item.eventId}
            />
          ) : (
            <View style={styles.carouselEmptyContainer}>
              <View style={styles.carouselEmptyCard}>
                <CalendarDays size={60} color="#ccc" />
                <Text style={styles.carouselEmptyText}>No Events</Text>
                <Text style={styles.carouselEmptySubtext}>
                  No events scheduled at this venue
                </Text>
              </View>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Loading
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingCard: { backgroundColor: "transparent", alignItems: "center" },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },

  // Venue markers
  venueMarker: {
    backgroundColor: "#FF4444",
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
    justifyContent: "center",
    alignItems: "center",
  },

  // Header / search
  headerContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 40,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButtonInline: {
    backgroundColor: "#fff",
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 25,
    height: 50,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#333",
  },
  searchResultsContainer: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    overflow: "hidden",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  searchResultSubtitle: { fontSize: 13, color: "#666" },

  // Navigation card (placed below the search header)
  navCard: {
    position: "absolute",
    top: Platform.OS === "ios" ? 120 : 110,
    left: 20,
    right: 20,
    backgroundColor: "#1A1A2E",
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    zIndex: 9,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  navCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#4285F4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  navCardContent: { flex: 1 },
  navCardInstruction: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 22,
  },
  navCardDistance: {
    fontSize: 13,
    color: "#A0AEC0",
    marginTop: 3,
  },
  navCardNext: {
    fontSize: 12,
    color: "#718096",
    marginTop: 3,
    fontStyle: "italic",
  },
  navCardRerouting: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  navCardReroutingText: {
    color: "#A0AEC0",
    fontSize: 14,
    fontStyle: "italic",
  },

  // Control buttons
  controlButtons: {
    position: "absolute",
    bottom: 100,
    right: 20,
    gap: 12,
  },
  controlButton: {
    backgroundColor: "#fff",
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginBottom: 12,
  },

  // Arrival overlay
  arrivalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  arrivalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    paddingVertical: 40,
    paddingHorizontal: 32,
    alignItems: "center",
    width: "80%",
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  arrivalHeading: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A2E",
    marginTop: 18,
    textAlign: "center",
  },
  arrivalDestName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4285F4",
    marginTop: 8,
    textAlign: "center",
  },
  arrivalSubtext: {
    fontSize: 14,
    color: "#718096",
    marginTop: 10,
    textAlign: "center",
    lineHeight: 20,
  },
  arrivalFinishBtn: {
    marginTop: 28,
    backgroundColor: "#4285F4",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 50,
  },
  arrivalFinishBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Carousel
  carouselContainer: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
  },
  carouselHandleArea: {
    paddingVertical: 15,
    paddingHorizontal: 50,
    alignSelf: "center",
  },
  carouselHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#DEDEDE",
    borderRadius: 2,
    alignSelf: "center",
  },
  carouselContent: {},
  carouselCard: {
    width: Dimensions.get("window").width * 0.8,
    height: Dimensions.get("window").height * 0.2,
    marginHorizontal: 10,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    flexDirection: "row",
  },
  carouselCardImageContainer: {
    width: "40%",
    height: "100%",
    position: "relative",
  },
  carouselCardImage: { width: "100%", height: "100%" },
  carouselCardImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  carouselCardBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#FFBA00",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  carouselCardBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#333",
    textTransform: "uppercase",
  },
  carouselCardInfo: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  carouselCardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  carouselCardDescription: {
    fontSize: 12,
    color: "#666",
    lineHeight: 16,
    marginBottom: 8,
  },
  carouselCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  carouselCardDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  carouselCardDate: { fontSize: 11, color: "#666", fontWeight: "500" },
  carouselCardPriceContainer: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  carouselCardPrice: { fontSize: 11, fontWeight: "600", color: "#333" },
  carouselEmptyContainer: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal:
      (Dimensions.get("window").width -
        Dimensions.get("window").width * 0.8) /
        2 -
      10,
  },
  carouselEmptyCard: {
    width: Dimensions.get("window").width * 0.8,
    height: Dimensions.get("window").height * 0.2,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  carouselEmptyText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#666",
    marginTop: 12,
  },
  carouselEmptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 4,
  },
});
