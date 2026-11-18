package handlers

import (
	"context"
	"log"
	"time"

	"backend/internal/config"
)

// StartAutomatedNotificationScheduler launches a standing background scheduler
// that runs every day at 22:00 (10:00 PM) IST to send the daily hospitality summary.
func (a *API) StartAutomatedNotificationScheduler(ctx context.Context) {
	go func() {
		log.Printf("[Scheduler] Daily hospitality notification scheduler running (target: 22:00 IST)")
		for {
			now := time.Now().In(config.IST)
			target := time.Date(now.Year(), now.Month(), now.Day(), 22, 0, 0, 0, config.IST)
			if now.After(target) {
				// Target is tomorrow at 22:00 IST
				target = target.Add(24 * time.Hour)
			}

			waitDuration := target.Sub(now)
			log.Printf("[Scheduler] Next hospitality daily summary scheduled in %v (at %s IST)",
				waitDuration.Round(time.Minute), target.Format("2006-01-02 15:04:05"))

			select {
			case <-ctx.Done():
				log.Printf("[Scheduler] Background scheduler cancelled")
				return
			case <-time.After(waitDuration):
				log.Printf("[Scheduler] Triggering 10:00 PM IST daily hospitality notification job...")
				res, err := a.RunDailyHospitalitySummary(context.Background())
				if err != nil {
					log.Printf("[Scheduler] Error running daily hospitality notification job: %v", err)
				} else {
					log.Printf("[Scheduler] Daily hospitality notification job succeeded: %+v", res)
				}
				// Prevent double trigger in the same minute
				time.Sleep(90 * time.Second)
			}
		}
	}()
}
