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
  PanGestureHandler,
  GestureHandlerRootView,
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
import { User, CalendarDays, MapPin, Search, X, Navigation } from "lucide-react-native";
import { Venue, FirebaseEvent } from '@/types/models';
import { CAMPUS_LOCATIONS } from '@/data/campusLocations';
import * as Location from "expo-location";

const MAPBOX_TOKEN = "pk.eyJ1IjoiamFzaGFuMjAwMyIsImEiOiJjbWdhbHRkNTkwbm1vMmlxdGRrdnpvazR4In0.Uy3g_PaeGdaoUAmTdRl_-w";
// TODO: Set your Mapbox public access token here
Mapbox.setAccessToken(MAPBOX_TOKEN);

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
};

export default function MapScreen() {
  const router = useRouter();
  const cameraRef = useRef<Camera>(null);
  const [showCarousel, setShowCarousel] = useState(false);
  const carouselRef = useRef<FlatList>(null);
  const mapRef = useRef<MapView>(null);

  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<FirebaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
  const [fullRouteCoordinates, setFullRouteCoordinates] = useState<[number, number][] | null>(null);
  const [currentRouteIndex, setCurrentRouteIndex] = useState(0);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const [destination, setDestination] = useState<{lat: number, lng: number, name: string} | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const initialCenter = {
    lat: 30.353539,
    lng: 76.368524,
  };

  // Carousel animation values
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  const CAROUSEL_HEIGHT = screenHeight * 0.25; // 25% of screen height
  const CARD_WIDTH = screenWidth * 0.8; // 80% of screen width
  const CARD_MARGIN = 10; // Gap between cards
  const SIDE_SPACING = (screenWidth - CARD_WIDTH) / 2; // Equal spacing on both sides
  const translateY = useSharedValue(CAROUSEL_HEIGHT);
  const buttonsTranslateY = useSharedValue(0); // Separate animation for buttons

  // Get user location
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

      setUserLocation(userLoc);
      setIsFollowingUser(true);

      // Fly to user location
      if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: [userLoc.lng, userLoc.lat],
          zoomLevel: 17,
          animationDuration: 1000,
        });
      }

      // Start watcher
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 2, // Every 2 meters
          timeInterval: 2000, // Or every 2 seconds
        },
        (loc) => {
          setUserLocation({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        }
      );

    } catch (error) {
      console.error("Error getting user location:", error);
      showAlert("Error", "Failed to get your location");
    }
  }, []);

  // Cleanup location watcher on unmount
  useEffect(() => {
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  // Handle live tracking and route trimming
  useEffect(() => {
    if (!userLocation) return;

    // 1. Camera Tracking
    if (isFollowingUser && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [userLocation.lng, userLocation.lat],
        animationDuration: 1000,
      });
    }

    // 2. Route Trimming
    if (fullRouteCoordinates && fullRouteCoordinates.length > 0) {
      let minDistance = Infinity;
      let closestIndex = currentRouteIndex;

      // Only search forward (lookahead of 20 points) to prevent snapping to past segments if paths cross
      const lookahead = Math.min(currentRouteIndex + 20, fullRouteCoordinates.length);

      for (let i = currentRouteIndex; i < lookahead; i++) {
        const coord = fullRouteCoordinates[i];
        // Mapbox coordinates are [lng, lat]
        const dist = getDistance(userLocation.lat, userLocation.lng, coord[1], coord[0]);
        if (dist < minDistance) {
          minDistance = dist;
          closestIndex = i;
        }
      }

      // Advance the user's progress along the route
      if (closestIndex > currentRouteIndex) {
        setCurrentRouteIndex(closestIndex);
      }

      // If user is reasonably close to the path (e.g., within 100 meters), trim it.
      if (minDistance < 100) {
        let nextWaypointIndex = closestIndex;
        
        // Prevent drawing backwards: determine which segment the user is on
        if (closestIndex > 0 && closestIndex < fullRouteCoordinates.length - 1) {
          const prevCoord = fullRouteCoordinates[closestIndex - 1];
          const nextCoord = fullRouteCoordinates[closestIndex + 1];
          
          const distPrev = getDistance(userLocation.lat, userLocation.lng, prevCoord[1], prevCoord[0]);
          const distNext = getDistance(userLocation.lat, userLocation.lng, nextCoord[1], nextCoord[0]);
          
          if (distNext < distPrev) {
            // User has passed closestIndex and is moving towards nextCoord
            nextWaypointIndex = closestIndex + 1;
          }
        }

        const remainingCoords = fullRouteCoordinates.slice(nextWaypointIndex);
        // Insert user's exact current location at the start for a smooth connection
        remainingCoords.unshift([userLocation.lng, userLocation.lat]);

        setRouteGeoJSON({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: remainingCoords,
              },
            },
          ],
        });
      }
    }
  }, [userLocation, fullRouteCoordinates, isFollowingUser, currentRouteIndex]);

  // Fetch venues from Firebase
  const fetchVenues = useCallback(async () => {
    try {
      setLoading(true);
      /* Removed API call */
      setVenues(venuesData);
    } catch (error) {
      console.error("Error fetching venues:", error);
      showAlert("Error", "Failed to load venue locations");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch events from Firebase
  /* Removed API call */

  // Fetch venues on component mount
  useEffect(() => {
    fetchVenues();
    getUserLocation();
  }, [fetchVenues, getUserLocation]);

  // Roads data as GeoJSON
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

  // Control functions
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
  }, [initialCenter]);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 3) {
      setSearchResults([]);
      return;
    }
    
    try {
      setIsSearching(true);

      // 1. Search Local Campus Locations
      const queryLower = text.toLowerCase();
      const localMatches = CAMPUS_LOCATIONS.filter(loc => {
        if (loc.name.toLowerCase().includes(queryLower)) return true;
        if (loc.keywords && loc.keywords.some(kw => kw.toLowerCase().includes(queryLower))) return true;
        return false;
      }).map(loc => ({
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

  const getRoute = async (destCoords: [number, number], destName: string) => {
    if (!userLocation) {
      showAlert("Location Required", "We need your location to provide directions.");
      return;
    }
    
    try {
      setLoading(true);
      setSearchResults([]);
      Keyboard.dismiss();
      
      const start = `${userLocation.lng},${userLocation.lat}`;
      const end = `${destCoords[0]},${destCoords[1]}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${start};${end}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        setRouteGeoJSON({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: data.routes[0].geometry,
            },
          ],
        });
        
        setDestination({
          lat: destCoords[1],
          lng: destCoords[0],
          name: destName
        });
        
        const coords = data.routes[0].geometry.coordinates;
        setFullRouteCoordinates(coords);
        setCurrentRouteIndex(0); // Reset index for new route
        
        const bounds = coords.reduce((acc: any, coord: any) => {
          return {
            ne: [Math.max(acc.ne[0], coord[0]), Math.max(acc.ne[1], coord[1])],
            sw: [Math.min(acc.sw[0], coord[0]), Math.min(acc.sw[1], coord[1])],
          };
        }, {
          ne: [coords[0][0], coords[0][1]],
          sw: [coords[0][0], coords[0][1]],
        });
        
        cameraRef.current?.fitBounds(
          bounds.ne,
          bounds.sw,
          [100, 50, 100, 50],
          1000
        );
      }
    } catch (error) {
      console.error("Error fetching route:", error);
      showAlert("Error", "Failed to fetch directions.");
    } finally {
      setLoading(false);
    }
  };

  const clearRoute = () => {
    setRouteGeoJSON(null);
    setFullRouteCoordinates(null);
    setCurrentRouteIndex(0);
    setDestination(null);
    setSearchQuery("");
    if (userLocation) {
      cameraRef.current?.setCamera({
        centerCoordinate: [userLocation.lng, userLocation.lat],
        zoomLevel: 17,
        animationDuration: 1000,
      });
    }
  };

  const handleMarkerPress = useCallback(
    (venue: Venue) => {
      setSelectedVenue(venue);
      setShowCarousel(true);
      translateY.value = withSpring(0);
      buttonsTranslateY.value = withSpring(-CAROUSEL_HEIGHT); // Immediately animate buttons up
    },
    [translateY, buttonsTranslateY, CAROUSEL_HEIGHT]
  );

  const handleMapPress = useCallback(() => {
    if (showCarousel) {
      // Immediately update state for faster response
      setShowCarousel(false);
      setSelectedVenue(null);
      translateY.value = withSpring(CAROUSEL_HEIGHT);
      buttonsTranslateY.value = withSpring(0); // Immediately animate buttons down
    }
  }, [showCarousel, CAROUSEL_HEIGHT, translateY, buttonsTranslateY]);

  // Get events for selected venue
  const venueEvents = useMemo(() => {
    if (!selectedVenue) return [];
    const filteredEvents = events.filter(
      (event) => event.venueId === selectedVenue.venueId
    );

    // Simple array with unique keys for each event
    return filteredEvents.map((event, index) => ({
      ...event,
      uniqueKey: `${event.eventId}-${index}`,
    }));
  }, [selectedVenue, events]);

  // Swipe down gesture handler
  const startY = useSharedValue(0);
  const gestureHandler = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      // Only respond to vertical swipes (more vertical than horizontal)
      if (
        event.translationY > 0 &&
        Math.abs(event.translationY) > Math.abs(event.translationX)
      ) {
        translateY.value = startY.value + event.translationY;
      }
    })
    .onEnd((event) => {
      // Only dismiss if it's a clear downward swipe
      if (
        event.translationY > 100 &&
        Math.abs(event.translationY) > Math.abs(event.translationX)
      ) {
        // Immediately update state for faster UI response
        runOnJS(setShowCarousel)(false);
        runOnJS(setSelectedVenue)(null);
        translateY.value = withSpring(CAROUSEL_HEIGHT);
        buttonsTranslateY.value = withSpring(0); // Animate buttons down
      } else {
        translateY.value = withSpring(0);
        buttonsTranslateY.value = withSpring(-CAROUSEL_HEIGHT); // Keep buttons up
      }
    });

  // Carousel animated style
  const carouselStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  // Control buttons animated style - move up when carousel is visible
  const controlButtonsStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: buttonsTranslateY.value }],
    };
  });

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
        <Camera
          ref={cameraRef}
          zoomLevel={10}
          minZoomLevel={15}
          maxBounds={{
            ne: [76.37379609251491, 30.358568702840508],
            sw: [76.35853463768679, 30.350454984234354],
          }}
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
            {/* Accuracy circles */}
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
                    10,
                    10,
                    40,
                    40,
                    60,
                    60,
                  ],
                  circleColor: [
                    "match",
                    ["get", "radius"],
                    10,
                    "transparent",
                    40,
                    "#FFB6C1",
                    60,
                    "#FFB6C1",
                    "#FFB6C1",
                  ],
                  circleOpacity: [
                    "match",
                    ["get", "radius"],
                    10,
                    0.8,
                    40,
                    0.3,
                    60,
                    0.2,
                    0.2,
                  ],
                  circleStrokeWidth: 1,
                  circleStrokeColor: [
                    "match",
                    ["get", "radius"],
                    10,
                    "transparent",
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

        {/* Navigation Route */}
        {routeGeoJSON && (
          <ShapeSource id="route-source" shape={routeGeoJSON}>
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
            <View style={{ alignItems: 'center' }}>
              <View style={{ backgroundColor: '#4285F4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 4 }}>
                <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>{destination.name}</Text>
              </View>
              <MapPin size={32} color="#4285F4" fill="#ffffff" />
            </View>
          </MarkerView>
        )}
      </MapView>

      {/* Header with Search */}
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
              <TouchableOpacity onPress={() => {
                setSearchQuery("");
                setSearchResults([]);
              }} style={{ padding: 5, marginRight: 5 }}>
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
                        {item.place_name.replace(`${item.text}, `, '')}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* Control Buttons */}
      <Animated.View style={[styles.controlButtons, controlButtonsStyle]}>
        {routeGeoJSON && (
          <TouchableOpacity style={[styles.controlButton, { backgroundColor: '#FF4444' }]} onPress={clearRoute}>
            <X size={24} color="#FFF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.controlButton} onPress={zoomIn}>
          <Ionicons name="add" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={zoomOut}>
          <Ionicons name="remove" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={goToMainLocation}
        >
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
            color={userLocation ? (isFollowingUser ? "#4285F4" : "#333") : "#666"}
          />
        </TouchableOpacity>
      </Animated.View>

      {/* Loading Overlay */}
      {(loading || !mapLoaded) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#FFBA00" />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        </View>
      )}

      {/* Event Carousel */}
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
              snapToInterval={CARD_WIDTH + CARD_MARGIN * 2} // Card width + margins
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={[
                styles.carouselContent,
                {
                  paddingHorizontal: SIDE_SPACING - CARD_MARGIN, // Adjust for card margins
                },
              ]}
              renderItem={({ item: event }) => (
                <TouchableOpacity
                  style={styles.carouselCard}
                  onPress={() => {
                    setShowCarousel(false);
                    setSelectedVenue(null);
                    router.push({ pathname: "/events/EventDetails", params: { eventData: JSON.stringify(event) } });
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

// Helper function to calculate distance
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingCard: {
    backgroundColor: "transparent",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
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
  venueMarkerInner: {
    justifyContent: "center",
    alignItems: "center",
  },
  venueMarkerText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  headerContainer: {
    position: 'absolute',
    top: Platform.OS === "ios" ? 50 : 40,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
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
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  searchResultSubtitle: {
    fontSize: 13,
    color: '#666',
  },
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
  locationStatus: {
    fontSize: 12,
    color: "#4285F4",
    marginTop: 2,
  },
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
  carouselContent: {
    // Dynamic padding will be applied inline based on number of events
  },
  carouselCard: {
    width: Dimensions.get("window").width * 0.8, // 80% width
    height: Dimensions.get("window").height * 0.2,
    marginHorizontal: 10, // Gap between cards
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
  carouselCardImage: {
    width: "100%",
    height: "100%",
  },
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
  carouselCardDate: {
    fontSize: 11,
    color: "#666",
    fontWeight: "500",
  },
  carouselCardPriceContainer: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  carouselCardPrice: {
    fontSize: 11,
    fontWeight: "600",
    color: "#333",
  },
  carouselEmptyContainer: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal:
      (Dimensions.get("window").width - Dimensions.get("window").width * 0.8) /
        2 -
      10, // Same as SIDE_SPACING - CARD_MARGIN
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
