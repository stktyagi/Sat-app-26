package models

import (
	"strconv"
	"strings"
	"time"
)

// The production documents were written by two generations of admin panel, so
// the same logical field turns up under different names and different types:
// maxParticipants is a number on some docs and "" on others, graduationYear is
// sometimes 2027 and sometimes "2027". Every read goes through these helpers
// rather than firestore.DataTo, which would fail hard on the first mismatch.

// Int accepts int64/float64/int/string/nil and yields 0 for anything unusable.
// A zero here consistently means "unset" or "unlimited" in this dataset.
func Int(v any) int {
	switch t := v.(type) {
	case nil:
		return 0
	case int:
		return t
	case int64:
		return int(t)
	case float64:
		return int(t)
	case string:
		n, err := strconv.Atoi(strings.TrimSpace(t))
		if err != nil {
			return 0
		}
		return n
	default:
		return 0
	}
}

// Str renders numbers as strings so graduationYear is uniform on the way out.
func Str(v any) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return t
	case int:
		return strconv.Itoa(t)
	case int64:
		return strconv.FormatInt(t, 10)
	case float64:
		if t == float64(int64(t)) {
			return strconv.FormatInt(int64(t), 10)
		}
		return strconv.FormatFloat(t, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(t)
	case time.Time:
		return t.UTC().Format(TimeFormat)
	default:
		return ""
	}
}

func Bool(v any) bool {
	switch t := v.(type) {
	case bool:
		return t
	case string:
		b, err := strconv.ParseBool(strings.TrimSpace(t))
		return err == nil && b
	default:
		return false
	}
}

// StrSlice tolerates both a real array and a single comma-joined string, which
// is how additionalImages was stored on older event docs.
func StrSlice(v any) []string {
	switch t := v.(type) {
	case []any:
		out := make([]string, 0, len(t))
		for _, e := range t {
			if s := Str(e); s != "" {
				out = append(out, s)
			}
		}
		return out
	case []string:
		return t
	case string:
		if strings.TrimSpace(t) == "" {
			return nil
		}
		parts := strings.Split(t, ",")
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			if p = strings.TrimSpace(p); p != "" {
				out = append(out, p)
			}
		}
		return out
	default:
		return nil
	}
}

func Map(v any) map[string]any {
	if m, ok := v.(map[string]any); ok {
		return m
	}
	return map[string]any{}
}

func MapSlice(v any) []map[string]any {
	raw, ok := v.([]any)
	if !ok {
		return nil
	}
	out := make([]map[string]any, 0, len(raw))
	for _, e := range raw {
		if m, ok := e.(map[string]any); ok {
			out = append(out, m)
		}
	}
	return out
}

// Coalesce returns the first argument that carries a usable value. This is what
// resolves the legacy field pairs: Coalesce(m["coverImage"], m["coverImageUrl"]).
func Coalesce(vs ...any) any {
	for _, v := range vs {
		switch t := v.(type) {
		case nil:
		case string:
			if strings.TrimSpace(t) != "" {
				return v
			}
		case []any:
			if len(t) > 0 {
				return v
			}
		case map[string]any:
			if len(t) > 0 {
				return v
			}
		default:
			return v
		}
	}
	return nil
}

// Gender flattens the male/Male/Female/female drift in the users collection.
func Gender(v any) string { return strings.ToLower(strings.TrimSpace(Str(v))) }
