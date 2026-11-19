// seed_hostels creates sample hostels. For hostels that already exist only the
// name, gender and active flag are synced; capacity and the live occupancy
// counter are never touched (change capacity from Hospitality Control).
package main

import (
	"context"
	"log"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"backend/internal/isotime"
	"backend/internal/models"
	"backend/internal/slug"
)

func main() {
	ctx := context.Background()

	app, err := firebase.NewApp(ctx, nil, option.WithCredentialsFile("serviceAccountKey.json"))
	if err != nil {
		log.Fatalf("error initializing app: %v", err)
	}
	client, err := app.Firestore(ctx)
	if err != nil {
		log.Fatalln(err)
	}
	defer client.Close()

	hostels := []models.Hostel{
		{Name: "Hostel-J", Gender: "male", Capacity: 100, Active: true},
	}

	now := isotime.Now()
	for _, h := range hostels {
		id := slug.Make(h.Name)
		h.CreatedAt, h.UpdatedAt = now, now
		_, err := client.Collection("hostels").Doc(id).Create(ctx, h)
		switch {
		case err == nil:
			log.Printf("created hostel %s (%s), capacity %d", h.Name, id, h.Capacity)
		case status.Code(err) == codes.AlreadyExists:
			_, uerr := client.Collection("hostels").Doc(id).Update(ctx, []firestore.Update{
				{Path: "name", Value: h.Name},
				{Path: "gender", Value: h.Gender},
				{Path: "active", Value: h.Active},
				{Path: "updatedAt", Value: now},
			})
			if uerr != nil {
				log.Fatalf("update %s: %v", id, uerr)
			}
			log.Printf("hostel %s (%s) exists, synced name/gender/active (gender=%s)", h.Name, id, h.Gender)
		default:
			log.Fatalf("create %s: %v", id, err)
		}
	}
}
