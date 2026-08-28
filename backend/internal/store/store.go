package store

import (
	"errors"

	"cloud.google.com/go/firestore"
	"cloud.google.com/go/firestore/apiv1/firestorepb"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"backend/internal/config"
)

// Collection names are inherited from the existing database and must not be
// renamed: the previous web app and admin panel read the same documents.
const (
	ColUsers         = "users"
	ColEvents        = "events"
	ColRegistrations = "userEventRegistrations"
	ColTeams         = "teamRegistrations"
	ColVenues        = "venues"
)

var (
	ErrNotFound = errors.New("not found")
	ErrExists   = errors.New("already exists")
)

type Store struct {
	FS  *firestore.Client
	Cfg *config.Config
}

func New(fs *firestore.Client, cfg *config.Config) *Store {
	return &Store{FS: fs, Cfg: cfg}
}

// wrap normalises the gRPC status codes Firestore returns into the two sentinel
// errors the handlers switch on.
func wrap(err error) error {
	switch status.Code(err) {
	case codes.NotFound:
		return ErrNotFound
	case codes.AlreadyExists, codes.FailedPrecondition:
		return ErrExists
	default:
		return err
	}
}

// decodeAggValue unwraps the protobuf value an aggregation query returns.
func decodeAggValue(v any) any {
	if pv, ok := v.(*firestorepb.Value); ok {
		return pv.GetIntegerValue()
	}
	return v
}
