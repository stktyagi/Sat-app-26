FROM golang:1.26-alpine AS builder
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -p 1 -ldflags="-s -w" -o /api ./cmd/api

FROM alpine:3.22
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY --from=builder /api /app/api
COPY --from=builder /app/app_config.json /app/app_config.json
COPY --from=builder /app/colleges.json /app/colleges.json
EXPOSE 8080
CMD ["/app/api"]
