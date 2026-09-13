package handlers

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/models"
	"backend/internal/store"
)

// faqBody uses pointers so PATCH can leave omitted fields alone.
type faqBody struct {
	Question *string `json:"question"`
	Answer   *string `json:"answer"`
	Order    *int    `json:"order"`
}

// ListFaqs is the public FAQ page, already sorted by order.
func (a *API) ListFaqs(c *gin.Context) {
	faqs, err := a.Faqs.All(c.Request.Context())
	if err != nil {
		log.Printf("ListFaqs error: %v", err)
		apierr.Respond(c, apierr.Internal("could not load FAQs"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": faqs})
}

func (a *API) CreateFaq(c *gin.Context) {
	var body faqBody
	if !bind(c, &body) {
		return
	}

	faq := &models.Faq{}
	applyFaqBody(faq, &body)
	if err := validateFaq(faq); err != nil {
		apierr.Respond(c, err)
		return
	}

	if err := a.Store.CreateFaq(c.Request.Context(), faq); err != nil {
		apierr.Respond(c, apierr.Internal("could not create the FAQ"))
		return
	}
	a.Faqs.Invalidate()

	c.JSON(http.StatusCreated, gin.H{"faq": faq})
}

func (a *API) UpdateFaq(c *gin.Context) {
	ctx := c.Request.Context()

	faq, err := a.Store.GetFaq(ctx, c.Param("id"))
	if err != nil {
		respondFaqLookup(c, err)
		return
	}

	var body faqBody
	if !bind(c, &body) {
		return
	}
	if applyFaqBody(faq, &body) == 0 {
		apierr.Respond(c, apierr.BadRequest("empty_patch", "no updatable fields supplied"))
		return
	}
	if err := validateFaq(faq); err != nil {
		apierr.Respond(c, err)
		return
	}

	if err := a.Store.SaveFaq(ctx, faq); err != nil {
		apierr.Respond(c, apierr.Internal("could not update the FAQ"))
		return
	}
	a.Faqs.Invalidate()

	c.JSON(http.StatusOK, gin.H{"faq": faq})
}

func (a *API) DeleteFaq(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	if _, err := a.Store.GetFaq(ctx, id); err != nil {
		respondFaqLookup(c, err)
		return
	}
	if err := a.Store.DeleteFaq(ctx, id); err != nil {
		apierr.Respond(c, apierr.Internal("could not delete the FAQ"))
		return
	}
	a.Faqs.Invalidate()

	c.Status(http.StatusNoContent)
}

func respondFaqLookup(c *gin.Context, err error) {
	if errors.Is(err, store.ErrNotFound) {
		apierr.Respond(c, apierr.NotFound("faq_not_found", "no such FAQ"))
		return
	}
	apierr.Respond(c, apierr.Internal("could not load the FAQ"))
}

// applyFaqBody overlays the supplied fields and reports how many were set.
func applyFaqBody(f *models.Faq, b *faqBody) int {
	n := 0
	if b.Question != nil {
		f.Question = strings.TrimSpace(*b.Question)
		n++
	}
	if b.Answer != nil {
		f.Answer = strings.TrimSpace(*b.Answer)
		n++
	}
	if b.Order != nil {
		f.Order = *b.Order
		n++
	}
	return n
}

func validateFaq(f *models.Faq) *apierr.Error {
	if f.Question == "" || f.Answer == "" {
		return apierr.BadRequest("missing_fields", "question and answer are required")
	}
	return nil
}
