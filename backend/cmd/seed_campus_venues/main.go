package main

import (
	"context"
	"log"
	"strings"

	"backend/internal/cache"
	"backend/internal/config"
	"backend/internal/models"
	"backend/internal/slug"
	"backend/internal/store"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

type CampusItem struct {
	ID       string
	Name     string
	Lat      float64
	Lng      float64
	Keywords []string
}

var campusLocations = []CampusItem{
	// Academic & Core
	{ID: "csed", Name: "CSED", Lat: 30.354872422722643, Lng: 76.3697552290389, Keywords: []string{"csed ground floor", "csed labs", "computer science"}},
	{ID: "lt", Name: "LT (Lecture Theatres)", Lat: 30.354377328586363, Lng: 76.36913852795698, Keywords: []string{"lt 101", "lt 102", "lt 103", "lt 201", "lt 202", "lt101", "lt102", "lt103", "lt201", "lt202", "lecture theatres"}},
	{ID: "lp", Name: "LP (Lecture P-Block)", Lat: 30.354281057154452, Lng: 76.36869365006349, Keywords: []string{"lp 103", "lp 104", "lp 108", "lp 109", "lp-108", "lp-109", "lp103", "lp104", "lp108", "lp109", "p block"}},
	{ID: "as", Name: "AS / Activity Space", Lat: 30.355230415103595, Lng: 76.36886515246013, Keywords: []string{"as1", "as2", "activity space", "activity space 1", "activity space 2"}},
	{ID: "main_audi", Name: "Main Auditorium", Lat: 30.352024147329622, Lng: 76.37090951955399, Keywords: []string{"main audi", "auditorium"}},
	{ID: "tan", Name: "TAN Auditorium", Lat: 30.353824516700595, Lng: 76.3685458971172, Keywords: []string{"tan audi", "tan", "tan 101", "tan 102", "tan 103", "tan 104", "tan 105", "tan 106"}},
	{ID: "c_hall", Name: "C Hall", Lat: 30.353216158229223, Lng: 76.37217070767521, Keywords: []string{"chall", "c-hall"}},
	{ID: "library", Name: "Central Library", Lat: 30.354243494542697, Lng: 76.36959239332523, Keywords: []string{"library", "central library", "library stairs"}},
	{ID: "health_center", Name: "Health Center", Lat: 30.35595006947753, Lng: 76.36855108259431, Keywords: []string{"hospital", "dispensary", "medical", "health center"}},

	// Grounds & Outdoors
	{ID: "fete", Name: "Fete Area", Lat: 30.35396214206167, Lng: 76.36481001844584, Keywords: []string{"fete area main stage", "fete stage", "fete area"}},
	{ID: "cos", Name: "COS", Lat: 30.353964101317814, Lng: 76.36265569607752, Keywords: []string{"cos", "cos complex"}},
	{ID: "oat", Name: "OAT (Open Air Theatre)", Lat: 30.354405138715784, Lng: 76.36252602522457, Keywords: []string{"cos oat", "oat", "open air theatre"}},
	{ID: "lp_lawns", Name: "LP Lawns", Lat: 30.35477120493254, Lng: 76.36845137888686, Keywords: []string{"lp lawns"}},
	{ID: "dosa_lawn", Name: "Dosa Lawn", Lat: 30.354939240479453, Lng: 76.37087525081559, Keywords: []string{"waterbody", "dosa lawn"}},
	{ID: "central_park", Name: "Central Park", Lat: 30.35319079019932, Lng: 76.36680133578665, Keywords: []string{"central park", "central park stage"}},
	{ID: "athletic_track", Name: "Athletic Track", Lat: 30.35400005637751, Lng: 76.36125881218773, Keywords: []string{"synthetic track", "running track", "ground", "athletic track"}},
	{ID: "hockey_ground", Name: "Hockey Ground", Lat: 30.355054260749046, Lng: 76.36350586160543, Keywords: []string{"hockey ground", "hockey"}},
	{ID: "sports_complex", Name: "Sports Complex", Lat: 30.355595211646577, Lng: 76.36508296431039, Keywords: []string{"sports complex", "gym", "badminton", "table tennis"}},

	// Hostels
	{ID: "hostel_a", Name: "A Hostel", Lat: 30.351327991274847, Lng: 76.36453276525843, Keywords: []string{"a hostel", "hostel a"}},
	{ID: "hostel_b", Name: "B Hostel", Lat: 30.351246903377668, Lng: 76.36314165240258, Keywords: []string{"b hostel", "hostel b"}},
	{ID: "hostel_c", Name: "C Hostel", Lat: 30.350940861204013, Lng: 76.3612482838114, Keywords: []string{"c hostel", "hostel c"}},
	{ID: "hostel_d", Name: "D Hostel", Lat: 30.35106587926319, Lng: 76.36006174804133, Keywords: []string{"d hostel", "hostel d"}},
	{ID: "hostel_e", Name: "E Hostel", Lat: 30.355072699678075, Lng: 76.36652406644723, Keywords: []string{"e hostel", "hostel e"}},
	{ID: "hostel_g", Name: "G Hostel", Lat: 30.354252046207215, Lng: 76.36684696615157, Keywords: []string{"g hostel", "hostel g"}},
	{ID: "hostel_h", Name: "H Hostel", Lat: 30.352985996456145, Lng: 76.36465472696462, Keywords: []string{"h hostel", "hostel h", "h chowk"}},
	{ID: "hostel_i", Name: "I Hostel", Lat: 30.355068346942055, Lng: 76.36766681779083, Keywords: []string{"i hostel", "hostel i"}},
	{ID: "hostel_j", Name: "J Hostel", Lat: 30.35286593527545, Lng: 76.36368291231285, Keywords: []string{"j hostel", "hostel j"}},
	{ID: "hostel_m", Name: "M Hostel", Lat: 30.352959595421428, Lng: 76.36104889932882, Keywords: []string{"m hostel", "hostel m"}},
	{ID: "hostel_n", Name: "N Hostel", Lat: 30.35456115154435, Lng: 76.36775258431018, Keywords: []string{"n hostel", "hostel n"}},
	{ID: "hostel_o", Name: "O Hostel", Lat: 30.351246097829083, Lng: 76.36232422905654, Keywords: []string{"o hostel", "hostel o"}},
	{ID: "paavni", Name: "Paavni Hall", Lat: 30.351473899916197, Lng: 76.36570446264417, Keywords: []string{"paavni hall", "paavni"}},
	{ID: "dhriti", Name: "Dhriti Hall", Lat: 30.351514671439784, Lng: 76.36646041570212, Keywords: []string{"dhriti hall", "dhriti"}},
	{ID: "vahni", Name: "Vahni Hall", Lat: 30.351784052551714, Lng: 76.36759097042464, Keywords: []string{"vahni hall", "vahni"}},

	// Blocks & Others
	{ID: "block_b", Name: "B Block", Lat: 30.353152590588927, Lng: 76.37142332674016, Keywords: []string{"b block", "b-block"}},
	{ID: "block_c", Name: "C Block", Lat: 30.35354389079774, Lng: 76.37093571665477, Keywords: []string{"c block", "c-block"}},
	{ID: "block_d", Name: "D Block", Lat: 30.354056345897625, Lng: 76.37085792538132, Keywords: []string{"d block", "d-block"}},
	{ID: "block_e", Name: "E Block", Lat: 30.353501204419373, Lng: 76.37235055617016, Keywords: []string{"e block", "e-block"}},
	{ID: "block_f", Name: "F Block", Lat: 30.354005472911407, Lng: 76.37215323385776, Keywords: []string{"f block", "f-block", "f 106"}},
	{ID: "block_h", Name: "H Block", Lat: 30.35325561867089, Lng: 76.37282488468304, Keywords: []string{"h block", "h-block"}},
	{ID: "sbop", Name: "State Bank ATM (SBOP)", Lat: 30.352733845728167, Lng: 76.3704635249458, Keywords: []string{"sbop", "bank", "atm", "sbop lawns"}},
}

// normalize cleans up a string for comparison
func normalize(s string) string {
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, "-", "")
	s = strings.ReplaceAll(s, "_", "")
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "(", "")
	s = strings.ReplaceAll(s, ")", "")
	s = strings.ReplaceAll(s, "/", "")
	return s
}

func main() {
	ctx := context.Background()

	sa := option.WithCredentialsFile("serviceAccountKey.json")
	app, err := firebase.NewApp(ctx, nil, sa)
	if err != nil {
		log.Fatalf("error initializing app: %v\n", err)
	}

	client, err := app.Firestore(ctx)
	if err != nil {
		log.Fatalln(err)
	}
	defer client.Close()

	// 1. Fetch all existing venues
	existingVenues := make(map[string]*models.Venue)
	iter := client.Collection("venues").Documents(ctx)
	defer iter.Stop()

	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Fatalf("failed to read venues: %v", err)
		}
		var v models.Venue
		if err := doc.DataTo(&v); err != nil {
			log.Printf("skipping malformed venue doc %s: %v", doc.Ref.ID, err)
			continue
		}
		v.VenueID = doc.Ref.ID
		existingVenues[v.VenueID] = &v
	}
	log.Printf("Found %d existing venues in Firestore", len(existingVenues))

	// Helper to find matching existing venue
	findExisting := func(item CampusItem) *models.Venue {
		itemSlug := slug.Make(item.Name)
		itemNorm := normalize(item.Name)
		itemIdNorm := normalize(item.ID)

		// Check direct ID or slug match
		for id, v := range existingVenues {
			if id == item.ID || id == itemSlug {
				return v
			}
			vNorm := normalize(v.VenueName)
			vIdNorm := normalize(v.VenueID)

			if vNorm == itemNorm || vIdNorm == itemIdNorm || vNorm == itemIdNorm || vIdNorm == itemNorm {
				return v
			}
		}

		// Alias / semantic matches
		aliases := map[string][]string{
			"csed":           {"csed"},
			"lt":             {"lt101", "lt102", "lt201", "lt202", "lt301"},
			"lp":             {"lp104", "lp105", "lp106", "lp107", "lp108", "lp109", "lp110"},
			"as":             {"activityspace1", "activityspace2"},
			"main_audi":      {"mainauditorium"},
			"tan":            {"tan", "tanauditorium"},
			"c_hall":         {"chall"},
			"library":        {"centrallibrary", "librarystairs"},
			"fete":           {"fetearea"},
			"oat":            {"oat"},
			"athletic_track": {"synthetictrack"},
			"block_f":        {"fblock", "f106"},
			"sbop":           {"sboplawns"},
			"central_park":   {"centralparkstage1", "centralparkoat2"},
		}

		if matchKeys, ok := aliases[item.ID]; ok {
			for _, mk := range matchKeys {
				for id, v := range existingVenues {
					if normalize(id) == mk || normalize(v.VenueName) == mk {
						return v
					}
				}
			}
		}

		return nil
	}

	updatedCount := 0
	createdCount := 0

	for _, item := range campusLocations {
		match := findExisting(item)

		if match != nil {
			// Found existing venue: DO NOT duplicate!
			// Merge keywords so search works seamlessly.
			keywordMap := make(map[string]bool)
			for _, kw := range match.Keywords {
				keywordMap[strings.ToLower(strings.TrimSpace(kw))] = true
			}
			// Add item name and keywords
			keywordMap[strings.ToLower(strings.TrimSpace(item.Name))] = true
			for _, kw := range item.Keywords {
				keywordMap[strings.ToLower(strings.TrimSpace(kw))] = true
			}

			mergedKeywords := make([]string, 0, len(keywordMap))
			for kw := range keywordMap {
				if kw != "" {
					mergedKeywords = append(mergedKeywords, kw)
				}
			}

			// Update document with merged keywords
			_, err := client.Collection("venues").Doc(match.VenueID).Update(ctx, []firestore.Update{
				{Path: "keywords", Value: mergedKeywords},
			})
			if err != nil {
				// If field doesn't exist yet, Set with merge
				match.Keywords = mergedKeywords
				_, err = client.Collection("venues").Doc(match.VenueID).Set(ctx, match)
				if err != nil {
					log.Printf("Failed to update keywords on %s: %v", match.VenueID, err)
					continue
				}
			}
			log.Printf("[MERGED] Existing venue %q (%s) updated with %d keywords (no duplicate created)", match.VenueName, match.VenueID, len(mergedKeywords))
			updatedCount++
		} else {
			// Create new venue document
			docID := slug.Make(item.Name)
			if docID == "" {
				docID = item.ID
			}

			// Ensure lowercase and unique keywords
			keywordMap := make(map[string]bool)
			keywordMap[strings.ToLower(strings.TrimSpace(item.Name))] = true
			for _, kw := range item.Keywords {
				keywordMap[strings.ToLower(strings.TrimSpace(kw))] = true
			}
			var keywords []string
			for kw := range keywordMap {
				if kw != "" {
					keywords = append(keywords, kw)
				}
			}

			newVenue := &models.Venue{
				VenueID:   docID,
				VenueName: item.Name,
				Lat:       item.Lat,
				Lng:       item.Lng,
				Keywords:  keywords,
			}

			_, err := client.Collection("venues").Doc(docID).Set(ctx, newVenue)
			if err != nil {
				log.Printf("Failed to create venue %s: %v", docID, err)
				continue
			}
			existingVenues[docID] = newVenue
			log.Printf("[CREATED] New campus venue %q (%s) added to Firestore with %d keywords", item.Name, docID, len(keywords))
			createdCount++
		}
	}

	log.Printf("\n=== Campus Venues Migration Complete ===")
	log.Printf("Merged/Updated existing venues: %d", updatedCount)
	log.Printf("Newly created venues:          %d", createdCount)
	log.Printf("Total venues now in Firestore: %d", len(existingVenues))

	// Invalidate Redis list cache so backend reflects changes immediately
	cfg, _ := config.Load()
	if r, err := cache.NewRedis(ctx, cfg.RedisURL, cfg.RedisNamespace); err == nil {
		if err := r.Delete(ctx, store.KeyVenues); err != nil {
			log.Printf("Warning: failed to invalidate redis key %s: %v", store.KeyVenues, err)
		} else {
			log.Printf("Successfully invalidated Redis cache key: %s (namespace: %s)", store.KeyVenues, cfg.RedisNamespace)
		}
		_ = r.Close()
	} else {
		log.Printf("Note: Redis not reached for cache invalidation: %v", err)
	}
}
