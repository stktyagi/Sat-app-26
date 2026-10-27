package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"backend/internal/models"
)

// External accounts need a face photo and a college ID to register; host
// students and admins do not.
func TestRequireFullyRegisteredIdentityGate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	base := func() *models.User { return &models.User{FullyRegistered: true, Roles: []string{models.RoleUser}} }

	cases := []struct {
		name     string
		user     func() *models.User
		wantCode string // empty means the request passes
	}{
		{"external, nothing uploaded", base, "photo_required"},
		{"external, photo only", func() *models.User { u := base(); u.PhotoURL = "p"; return u }, "college_id_required"},
		{"external, both", func() *models.User { u := base(); u.PhotoURL, u.CollegeIDURL = "p", "i"; return u }, ""},
		{"host student", func() *models.User { u := base(); u.IsHostCollegeStudent = true; return u }, ""},
		{"admin", func() *models.User { u := base(); u.Roles = []string{models.RoleAdmin}; return u }, ""},
	}

	for _, tc := range cases {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/", nil)
		c.Set(ctxUser, tc.user())

		RequireFullyRegistered()(c)

		if tc.wantCode == "" {
			if c.IsAborted() {
				t.Errorf("%s: should pass, got %d %s", tc.name, w.Code, w.Body)
			}
			continue
		}
		if w.Code != http.StatusForbidden || !strings.Contains(w.Body.String(), tc.wantCode) {
			t.Errorf("%s: want 403 %s, got %d %s", tc.name, tc.wantCode, w.Code, w.Body)
		}
	}
}
