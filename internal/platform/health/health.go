package health

import "context"

type Checker func(context.Context) error

type Registry struct {
	checkers map[string]Checker
}

func NewRegistry() *Registry {
	return &Registry{
		checkers: make(map[string]Checker),
	}
}

func (r *Registry) Add(name string, checker Checker) {
	r.checkers[name] = checker
}

func (r *Registry) Check(ctx context.Context) map[string]string {
	results := make(map[string]string, len(r.checkers))
	for name, checker := range r.checkers {
		if err := checker(ctx); err != nil {
			results[name] = err.Error()
			continue
		}

		results[name] = "ok"
	}

	return results
}
