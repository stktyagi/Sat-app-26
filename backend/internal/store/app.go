package store

import (
	"context"
	"strings"

	"cloud.google.com/go/firestore"

	"backend/internal/models"
)

const (
	DocAppLink          = "link"
	DocAppMaintenance   = "maintenance"
	DocAppVersions      = "versions"
	DocAppAccommodation = "accommodation"
)

func (s *Store) appDoc(docID string) *firestore.DocumentRef {
	return s.FS.Collection(ColApp).Doc(docID)
}

// GetAppLinks fetches the app store / play store links document (app/link).
func (s *Store) GetAppLinks(ctx context.Context) (*models.AppLinks, error) {
	snap, err := s.appDoc(DocAppLink).Get(ctx)
	if err != nil {
		if wrap(err) == ErrNotFound {
			return &models.AppLinks{
				AppleStore: "https://apps.apple.com/app/saturnalia/id6738927814",
				PlayStore:  "https://play.google.com/store/apps/details?id=com.gauransh.saturnaliaapp2026",
			}, nil
		}
		return nil, wrap(err)
	}

	var l models.AppLinks
	if err := snap.DataTo(&l); err != nil {
		return nil, err
	}
	return &l, nil
}

// GetAppMaintenance fetches the platform maintenance document (app/maintenance).
func (s *Store) GetAppMaintenance(ctx context.Context) (*models.AppMaintenance, error) {
	snap, err := s.appDoc(DocAppMaintenance).Get(ctx)
	if err != nil {
		if wrap(err) == ErrNotFound {
			return &models.AppMaintenance{
				Android: false,
				IOS:     false,
				Web:     false,
			}, nil
		}
		return nil, wrap(err)
	}

	var m models.AppMaintenance
	_ = snap.DataTo(&m)

	// Fallback for case-insensitive Firestore fields
	data := snap.Data()
	for k, v := range data {
		if b, ok := v.(bool); ok {
			switch strings.ToLower(k) {
			case "android":
				m.Android = b
			case "ios":
				m.IOS = b
			case "web":
				m.Web = b
			}
		}
	}
	return &m, nil
}

// GetAppVersions fetches the platform minimum versions document (app/versions).
func (s *Store) GetAppVersions(ctx context.Context) (*models.AppVersions, error) {
	snap, err := s.appDoc(DocAppVersions).Get(ctx)
	if err != nil {
		if wrap(err) == ErrNotFound {
			return &models.AppVersions{
				Android: "1.0.0",
				IOS:     "1.0.0",
			}, nil
		}
		return nil, wrap(err)
	}

	var v models.AppVersions
	if err := snap.DataTo(&v); err != nil {
		return nil, err
	}
	return &v, nil
}

// GetAppAccommodation fetches the dynamic accommodation pricing document (app/accommodation).
func (s *Store) GetAppAccommodation(ctx context.Context) (*models.AppAccommodation, error) {
	snap, err := s.appDoc(DocAppAccommodation).Get(ctx)
	if err != nil {
		if wrap(err) == ErrNotFound {
			return &models.AppAccommodation{
				Amount:          650,
				Price:           650,
				TechnicalAmount: 650,
				CulturalAmount:  650,
				FoodAmount:      150,
			}, nil
		}
		return nil, wrap(err)
	}

	var a models.AppAccommodation
	if err := snap.DataTo(&a); err != nil {
		// Fallback manual map extraction
		data := snap.Data()
		amt := 650
		foodAmt := 150
		techAmt := 650
		cultAmt := 650
		techFoodAmt := 150
		cultFoodAmt := 150
		if v, ok := data["amount"].(int64); ok {
			amt = int(v)
		} else if v, ok := data["price"].(int64); ok {
			amt = int(v)
		}
		if v, ok := data["technicalAmount"].(int64); ok {
			techAmt = int(v)
		}
		if v, ok := data["culturalAmount"].(int64); ok {
			cultAmt = int(v)
		}
		if v, ok := data["foodAmount"].(int64); ok {
			foodAmt = int(v)
		}
		if v, ok := data["technicalFoodAmount"].(int64); ok {
			techFoodAmt = int(v)
		}
		if v, ok := data["culturalFoodAmount"].(int64); ok {
			cultFoodAmt = int(v)
		}
		return &models.AppAccommodation{
			Amount:              amt,
			Price:               amt,
			TechnicalAmount:     techAmt,
			CulturalAmount:      cultAmt,
			FoodAmount:          foodAmt,
			TechnicalFoodAmount: techFoodAmt,
			CulturalFoodAmount:  cultFoodAmt,
		}, nil
	}
	if a.Amount == 0 && a.Price > 0 {
		a.Amount = a.Price
	}
	if a.Price == 0 && a.Amount > 0 {
		a.Price = a.Amount
	}
	if a.Amount <= 0 {
		a.Amount = 650
		a.Price = 650
	}
	if a.TechnicalAmount <= 0 {
		a.TechnicalAmount = a.Amount
	}
	if a.CulturalAmount <= 0 {
		a.CulturalAmount = a.Amount
	}
	if a.FoodAmount <= 0 {
		a.FoodAmount = 150
	}
	if a.TechnicalFoodAmount <= 0 {
		a.TechnicalFoodAmount = a.FoodAmount
	}
	if a.CulturalFoodAmount <= 0 {
		a.CulturalFoodAmount = a.FoodAmount
	}
	return &a, nil
}

// GetAppConfig retrieves links, maintenance, versions, and accommodation in a single combined response.
func (s *Store) GetAppConfig(ctx context.Context) (*models.AppConfig, error) {
	links, err := s.GetAppLinks(ctx)
	if err != nil {
		return nil, err
	}
	maintenance, err := s.GetAppMaintenance(ctx)
	if err != nil {
		return nil, err
	}
	versions, err := s.GetAppVersions(ctx)
	if err != nil {
		return nil, err
	}
	accommodation, err := s.GetAppAccommodation(ctx)
	if err != nil {
		return nil, err
	}

	return &models.AppConfig{
		Links:         *links,
		Maintenance:   *maintenance,
		Versions:      *versions,
		Accommodation: *accommodation,
	}, nil
}

// SetAppLinks updates or creates the app/link document.
func (s *Store) SetAppLinks(ctx context.Context, links *models.AppLinks) error {
	_, err := s.appDoc(DocAppLink).Set(ctx, links)
	return wrap(err)
}

// SetAppMaintenance updates or creates the app/maintenance document.
func (s *Store) SetAppMaintenance(ctx context.Context, m *models.AppMaintenance) error {
	_, err := s.appDoc(DocAppMaintenance).Set(ctx, m)
	return wrap(err)
}

// SetAppVersions updates or creates the app/versions document.
func (s *Store) SetAppVersions(ctx context.Context, v *models.AppVersions) error {
	_, err := s.appDoc(DocAppVersions).Set(ctx, v)
	return wrap(err)
}

// SetAppAccommodation updates or creates the app/accommodation document.
func (s *Store) SetAppAccommodation(ctx context.Context, a *models.AppAccommodation) error {
	if a.Amount <= 0 && a.Price > 0 {
		a.Amount = a.Price
	}
	if a.Price <= 0 && a.Amount > 0 {
		a.Price = a.Amount
	}
	_, err := s.appDoc(DocAppAccommodation).Set(ctx, a)
	return wrap(err)
}

// EnsureAppDefaults initializes the "app" collection documents in Firestore if they do not exist.
func (s *Store) EnsureAppDefaults(ctx context.Context) error {
	// 1. link
	if _, err := s.appDoc(DocAppLink).Get(ctx); wrap(err) == ErrNotFound {
		defaultLinks := &models.AppLinks{
			AppleStore: "https://apps.apple.com/app/saturnalia/id6738927814",
			PlayStore:  "https://play.google.com/store/apps/details?id=com.gauransh.saturnaliaapp2026",
		}
		if _, err := s.appDoc(DocAppLink).Set(ctx, defaultLinks); err != nil {
			return wrap(err)
		}
	}

	// 2. maintenance
	if _, err := s.appDoc(DocAppMaintenance).Get(ctx); wrap(err) == ErrNotFound {
		defaultMaint := &models.AppMaintenance{
			Android: false,
			IOS:     false,
			Web:     false,
		}
		if _, err := s.appDoc(DocAppMaintenance).Set(ctx, defaultMaint); err != nil {
			return wrap(err)
		}
	}

	// 3. versions
	if _, err := s.appDoc(DocAppVersions).Get(ctx); wrap(err) == ErrNotFound {
		defaultVersions := &models.AppVersions{
			Android: "1.0.0",
			IOS:     "1.0.0",
		}
		if _, err := s.appDoc(DocAppVersions).Set(ctx, defaultVersions); err != nil {
			return wrap(err)
		}
	}

	// 4. accommodation
	if _, err := s.appDoc(DocAppAccommodation).Get(ctx); wrap(err) == ErrNotFound {
		defaultAcc := &models.AppAccommodation{
			Amount:              650,
			Price:               650,
			TechnicalAmount:     650,
			CulturalAmount:      650,
			FoodAmount:          150,
			TechnicalFoodAmount: 150,
			CulturalFoodAmount:  150,
		}
		if _, err := s.appDoc(DocAppAccommodation).Set(ctx, defaultAcc); err != nil {
			return wrap(err)
		}
	}

	return nil
}
