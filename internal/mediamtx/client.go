package mediamtx

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// Client calls the MediaMTX control API (in-cluster).
type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) *Client {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

type pathListEntry struct {
	Name    string          `json:"name"`
	Source  json.RawMessage `json:"source"`
	Online  bool            `json:"online"`
	Ready   bool            `json:"ready"`
	Available bool          `json:"available"`
}

type pathListResponse struct {
	Items []pathListEntry `json:"items"`
}

func sourcePresent(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return false
	}
	s := strings.TrimSpace(string(raw))
	return s != "" && s != "null"
}

// PathHasPublisher reports whether MediaMTX sees an active source on the path (e.g. live/<streamKey>).
func (e pathListEntry) PathHasPublisher() bool {
	if sourcePresent(e.Source) {
		return true
	}
	return e.Online || e.Ready || e.Available
}

// ListPaths returns active paths from GET /v3/paths/list.
func (c *Client) ListPaths(ctx context.Context) ([]pathListEntry, error) {
	if c.baseURL == "" {
		return nil, fmt.Errorf("mediamtx api url is empty")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/v3/paths/list?page=0&itemsPerPage=500", nil)
	if err != nil {
		return nil, err
	}
	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("mediamtx paths list: status %d", res.StatusCode)
	}
	var body pathListResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, err
	}
	return body.Items, nil
}

// PublisherPathNames returns path names that have an active publisher.
func (c *Client) PublisherPathNames(ctx context.Context) (map[string]struct{}, error) {
	items, err := c.ListPaths(ctx)
	if err != nil {
		return nil, err
	}
	out := make(map[string]struct{})
	for _, it := range items {
		if it.Name != "" && it.PathHasPublisher() {
			out[it.Name] = struct{}{}
		}
	}
	return out, nil
}
