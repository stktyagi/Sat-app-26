package fb

import (
	"context"
	"fmt"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"

	"backend/internal/config"
)

// Clients bundles the Firebase handles the API needs. Auth verifies the ID
// tokens the Expo app sends; Firestore is the datastore; Messaging handles FCM.
type Clients struct {
	Auth      *auth.Client
	FS        *firestore.Client
	Messaging *messaging.Client
}

func New(ctx context.Context, cfg *config.Config) (*Clients, error) {
	fbCfg := &firebase.Config{ProjectID: cfg.ProjectID}

	var opts []option.ClientOption
	// Against the emulators the SDK picks up FIRESTORE_EMULATOR_HOST and
	// FIREBASE_AUTH_EMULATOR_HOST on its own and needs no credentials.
	if !cfg.UseEmulator {
		opts = append(opts, option.WithCredentialsFile(cfg.CredentialsFile))
	}

	app, err := firebase.NewApp(ctx, fbCfg, opts...)
	if err != nil {
		return nil, fmt.Errorf("firebase app: %w", err)
	}

	authClient, err := app.Auth(ctx)
	if err != nil {
		return nil, fmt.Errorf("firebase auth: %w", err)
	}

	fsClient, err := app.Firestore(ctx)
	if err != nil {
		return nil, fmt.Errorf("firestore: %w", err)
	}

	messagingClient, err := app.Messaging(ctx)
	if err != nil {
		return nil, fmt.Errorf("messaging: %w", err)
	}

	return &Clients{Auth: authClient, FS: fsClient, Messaging: messagingClient}, nil
}

func (c *Clients) Close() error { return c.FS.Close() }
