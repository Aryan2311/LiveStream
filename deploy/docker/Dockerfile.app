FROM golang:1.25.0 AS build

WORKDIR /src

COPY go.mod ./
RUN go mod download

COPY . .
ARG SERVICE
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/service ./cmd/${SERVICE}

FROM gcr.io/distroless/base-debian12

WORKDIR /app
COPY --from=build /out/service /app/service

ENTRYPOINT ["/app/service"]
