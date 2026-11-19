package store

import (
	"context"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"

	"backend/internal/models"
)

// CreateAuditLog inserts a new audit log record into Firestore.
func (s *Store) CreateAuditLog(ctx context.Context, entry *models.AuditLog) error {
	if s == nil || s.FS == nil {
		return nil
	}
	docRef := s.FS.Collection(ColAuditLogs).NewDoc()
	entry.ID = docRef.ID
	_, err := docRef.Set(ctx, entry)
	return wrap(err)
}

// ListAuditLogs loads recent audit logs, optionally filtered by category or action.
func (s *Store) ListAuditLogs(ctx context.Context, limit int, category, action string) ([]*models.AuditLog, error) {
	if s == nil || s.FS == nil {
		return nil, nil
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	q := s.FS.Collection(ColAuditLogs).Query
	if category != "" {
		q = q.Where("category", "==", category)
	}
	if action != "" {
		q = q.Where("action", "==", action)
	}
	q = q.OrderBy("createdAt", firestore.Desc).Limit(limit)

	iter := q.Documents(ctx)
	defer iter.Stop()

	var logs []*models.AuditLog
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, wrap(err)
		}
		var l models.AuditLog
		if err := doc.DataTo(&l); err != nil {
			continue
		}
		l.ID = doc.Ref.ID
		logs = append(logs, &l)
	}
	return logs, nil
}
