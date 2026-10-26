package main

import (
	"context"
	"log"

	"backend/internal/models"

	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
)

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

	// 1. link - Play Store and App Store links
	links := models.AppLinks{
		AppleStore: "https://apps.apple.com/app/saturnalia/id6738927814",
		PlayStore:  "https://play.google.com/store/apps/details?id=com.gauransh.saturnaliaapp2026",
	}
	if _, err := client.Collection("app").Doc("link").Set(ctx, links); err != nil {
		log.Fatalf("error seeding app/link: %v\n", err)
	}
	log.Printf("Seeded app/link: %+v", links)

	// 2. maintenance - bool flags for android, ios, and web
	maint := models.AppMaintenance{
		Android: false,
		IOS:     false,
		Web:     false,
	}
	if _, err := client.Collection("app").Doc("maintenance").Set(ctx, maint); err != nil {
		log.Fatalf("error seeding app/maintenance: %v\n", err)
	}
	log.Printf("Seeded app/maintenance: %+v", maint)

	// 3. versions - current minimum required versions for android and ios
	versions := models.AppVersions{
		Android: "1.0.0",
		IOS:     "1.0.0",
	}
	if _, err := client.Collection("app").Doc("versions").Set(ctx, versions); err != nil {
		log.Fatalf("error seeding app/versions: %v\n", err)
	}
	log.Printf("Seeded app/versions: %+v", versions)

	// 4. accommodation - dynamic accommodation and food amounts
	acc := models.AppAccommodation{
		Amount:              650,
		Price:               650,
		TechnicalAmount:     650,
		CulturalAmount:      650,
		FoodAmount:          150,
		TechnicalFoodAmount: 150,
		CulturalFoodAmount:  150,
	}
	if _, err := client.Collection("app").Doc("accommodation").Set(ctx, acc); err != nil {
		log.Fatalf("error seeding app/accommodation: %v\n", err)
	}
	log.Printf("Seeded app/accommodation: %+v", acc)

	log.Println("Successfully seeded 'app' collection in Firestore!")
}
