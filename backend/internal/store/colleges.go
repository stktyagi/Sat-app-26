package store

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

var (
	collegesMu      sync.RWMutex
	collegesMemory  []string
	collegesFileMod time.Time
)

func (s *Store) collegesPath() string {
	// Standard candidate paths resolved in the code across prod, dev, and test environments
	candidates := []string{
		"colleges.json",
		"backend/colleges.json",
		"../colleges.json",
		"../../colleges.json",
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return "colleges.json"
}

// AllColleges returns the full list of colleges loaded from the single backend/colleges.json file.
func (s *Store) AllColleges(ctx context.Context) ([]string, error) {
	collegesMu.RLock()
	filePath := s.collegesPath()
	stat, statErr := os.Stat(filePath)
	if statErr == nil && !stat.ModTime().Equal(collegesFileMod) {
		collegesMu.RUnlock()
		collegesMu.Lock()
		defer collegesMu.Unlock()
		return s.loadCollegesLocked(filePath)
	}
	if collegesMemory != nil {
		out := make([]string, len(collegesMemory))
		copy(out, collegesMemory)
		collegesMu.RUnlock()
		return out, nil
	}
	collegesMu.RUnlock()

	collegesMu.Lock()
	defer collegesMu.Unlock()
	return s.loadCollegesLocked(filePath)
}

func (s *Store) loadCollegesLocked(filePath string) ([]string, error) {
	stat, err := os.Stat(filePath)
	if err != nil {
		if collegesMemory != nil {
			out := make([]string, len(collegesMemory))
			copy(out, collegesMemory)
			return out, nil
		}
		return nil, fmt.Errorf("colleges file not found at %s: %w", filePath, err)
	}

	bytes, err := os.ReadFile(filePath)
	if err != nil {
		if collegesMemory != nil {
			out := make([]string, len(collegesMemory))
			copy(out, collegesMemory)
			return out, nil
		}
		return nil, fmt.Errorf("failed reading %s: %w", filePath, err)
	}
	collegesFileMod = stat.ModTime()

	var parsed []string
	if err := json.Unmarshal(bytes, &parsed); err != nil {
		log.Printf("[store/colleges] failed parsing JSON from %s: %v", filePath, err)
		if collegesMemory != nil {
			out := make([]string, len(collegesMemory))
			copy(out, collegesMemory)
			return out, nil
		}
		return nil, err
	}

	// deduplicate and normalize
	seen := make(map[string]bool, len(parsed))
	clean := make([]string, 0, len(parsed))
	for _, c := range parsed {
		trimmed := strings.TrimSpace(c)
		if trimmed != "" && !seen[trimmed] {
			seen[trimmed] = true
			clean = append(clean, trimmed)
		}
	}

	collegesMemory = clean
	out := make([]string, len(collegesMemory))
	copy(out, collegesMemory)
	return out, nil
}

// SearchColleges returns matching colleges according to the query.
// It prioritizes exact/prefix matches first, followed by substring matches, alphabetically.
func (s *Store) SearchColleges(ctx context.Context, query string) ([]string, error) {
	all, err := s.AllColleges(ctx)
	if err != nil {
		return nil, err
	}

	q := strings.TrimSpace(strings.ToLower(query))
	if q == "" {
		return all, nil
	}

	var matches []string
	for _, c := range all {
		if strings.Contains(strings.ToLower(c), q) {
			matches = append(matches, c)
		}
	}

	sort.SliceStable(matches, func(i, j int) bool {
		aLower := strings.ToLower(matches[i])
		bLower := strings.ToLower(matches[j])

		aStarts := strings.HasPrefix(aLower, q)
		bStarts := strings.HasPrefix(bLower, q)

		if aStarts && !bStarts {
			return true
		}
		if !aStarts && bStarts {
			return false
		}
		return matches[i] < matches[j]
	})

	return matches, nil
}
