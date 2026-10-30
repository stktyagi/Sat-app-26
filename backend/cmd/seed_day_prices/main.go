// seed_day_prices fills the per-day price maps on app/accommodation from the
// current flat prices. Days that already have a price are kept, so it is safe
// to re-run. Only the four map fields are written.
package main

import (
	"context"
	"log"

	"backend/internal/store"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
)

var days = []string{"day0", "day1", "day2", "day3", "day4"}

func fill(existing map[string]int, price int) map[string]int {
	out := map[string]int{}
	for _, d := range days {
		out[d] = price
		if val, ok := existing[d]; ok {
			out[d] = val
		}
	}
	return out
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
		log.Fatalf("firestore: %v\n", err)
	}
	defer client.Close()

	// GetAppAccommodation fills in missing flat prices with the defaults.
	acc, err := store.New(client, nil).GetAppAccommodation(ctx)
	if err != nil {
		log.Fatalf("error reading app/accommodation: %v\n", err)
	}
	log.Printf("Current app/accommodation: %+v", acc)

	update := map[string]any{
		"technicalDays":     fill(acc.TechnicalDays, acc.TechnicalAmount),
		"culturalDays":      fill(acc.CulturalDays, acc.CulturalAmount),
		"technicalFoodDays": fill(acc.TechnicalFoodDays, acc.TechnicalFoodAmount),
		"culturalFoodDays":  fill(acc.CulturalFoodDays, acc.CulturalFoodAmount),
	}
	if _, err := client.Collection("app").Doc("accommodation").Set(ctx, update, firestore.MergeAll); err != nil {
		log.Fatalf("error writing app/accommodation: %v\n", err)
	}
	log.Printf("Seeded per-day prices: %+v", update)
}
