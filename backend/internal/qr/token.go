package qr

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strings"
)

var ErrInvalid = errors.New("invalid qr token")

// Signer produces the QR payload the app renders. The registration document ID
// is the identifier, and the signature lets a scanner reject a forged code
// before it ever reaches Firestore. Nothing is stored: the token is derived on
// read, so no schema change is needed to support it.
type Signer struct{ secret []byte }

func New(secret []byte) *Signer { return &Signer{secret: secret} }

func (s *Signer) Sign(registrationID string) string {
	enc := base64.RawURLEncoding
	return enc.EncodeToString([]byte(registrationID)) + "." + enc.EncodeToString(s.mac(registrationID))
}

// Verify returns the registration ID carried by a token, or ErrInvalid.
func (s *Signer) Verify(token string) (string, error) {
	payload, sig, ok := strings.Cut(token, ".")
	if !ok {
		return "", ErrInvalid
	}
	enc := base64.RawURLEncoding
	idBytes, err := enc.DecodeString(payload)
	if err != nil {
		return "", ErrInvalid
	}
	sigBytes, err := enc.DecodeString(sig)
	if err != nil {
		return "", ErrInvalid
	}
	if !hmac.Equal(sigBytes, s.mac(string(idBytes))) {
		return "", ErrInvalid
	}
	return string(idBytes), nil
}

func (s *Signer) mac(id string) []byte {
	m := hmac.New(sha256.New, s.secret)
	m.Write([]byte(id))
	return m.Sum(nil)
}
