package handlers

import (
	"testing"
	"time"

	"backend/internal/config"
)

func TestFestDay(t *testing.T) {
	day0 := time.Date(2026, 11, 20, 0, 0, 0, 0, config.IST)
	cases := []struct {
		now  time.Time
		want string
		ok   bool
	}{
		{time.Date(2026, 11, 20, 8, 0, 0, 0, config.IST), "day0", true},
		{time.Date(2026, 11, 20, 23, 30, 0, 0, config.IST), "day0", true},
		{time.Date(2026, 11, 20, 18, 45, 0, 0, time.UTC), "day1", true}, // 00:15 IST next day
		{time.Date(2026, 11, 24, 12, 0, 0, 0, config.IST), "day4", true},
		{time.Date(2026, 11, 19, 23, 59, 0, 0, config.IST), "", false},
		{time.Date(2026, 11, 25, 0, 0, 0, 0, config.IST), "", false},
	}
	for _, tc := range cases {
		got, ok := festDay(day0, tc.now)
		if got != tc.want || ok != tc.ok {
			t.Errorf("festDay(%v) = %q,%v want %q,%v", tc.now, got, ok, tc.want, tc.ok)
		}
	}
}
