package storage

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	platformconfig "live-streaming-platform/internal/platform/config"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type UploadTarget struct {
	ObjectKey string            `json:"object_key"`
	UploadURL string            `json:"upload_url"`
	Headers   map[string]string `json:"headers"`
	PublicURL string            `json:"public_url"`
	ExpiresAt time.Time         `json:"expires_at"`
}

type Presigner struct {
	client *s3.PresignClient
	cfg    platformconfig.StorageConfig
}

func NewPresigner(ctx context.Context, cfg platformconfig.StorageConfig) (*Presigner, error) {
	options := []func(*awsconfig.LoadOptions) error{
		awsconfig.WithRegion(cfg.Region),
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, options...)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		if cfg.Endpoint != "" {
			o.BaseEndpoint = &cfg.Endpoint
		}
		o.UsePathStyle = cfg.UsePathStyle
	})

	return &Presigner{
		client: s3.NewPresignClient(client),
		cfg:    cfg,
	}, nil
}

func (p *Presigner) PresignPutObject(ctx context.Context, objectKey, contentType string) (UploadTarget, error) {
	expiresAt := time.Now().Add(p.cfg.UploadURLExpiry)
	req, err := p.client.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      &p.cfg.Bucket,
		Key:         &objectKey,
		ContentType: &contentType,
	}, func(options *s3.PresignOptions) {
		options.Expires = p.cfg.UploadURLExpiry
	})
	if err != nil {
		return UploadTarget{}, fmt.Errorf("presign put object: %w", err)
	}

	return UploadTarget{
		ObjectKey: objectKey,
		UploadURL: req.URL,
		Headers:   flattenHeader(req.SignedHeader),
		PublicURL: p.publicURL(objectKey),
		ExpiresAt: expiresAt,
	}, nil
}

func (p *Presigner) publicURL(objectKey string) string {
	if p.cfg.PublicBaseURL != "" {
		base := strings.TrimRight(p.cfg.PublicBaseURL, "/")
		return base + "/" + strings.TrimLeft(objectKey, "/")
	}

	if p.cfg.Endpoint != "" {
		endpoint := strings.TrimRight(p.cfg.Endpoint, "/")
		return endpoint + "/" + strings.TrimLeft(p.cfg.Bucket+"/"+objectKey, "/")
	}

	u := &url.URL{
		Scheme: "https",
		Host:   fmt.Sprintf("%s.s3.%s.amazonaws.com", p.cfg.Bucket, p.cfg.Region),
		Path:   path.Join("/", objectKey),
	}

	return u.String()
}

func flattenHeader(header http.Header) map[string]string {
	out := make(map[string]string, len(header))
	for key, values := range header {
		out[key] = strings.Join(values, ", ")
	}

	return out
}
