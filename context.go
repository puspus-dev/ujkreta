package main

import (
	"context"
	"net/http"
)

// ============================================================
// REQUEST CONTEXT – bejelentkezett session
// ============================================================

type ctxKey int

const sessionCtxKey ctxKey = 1

func contextWithSession(ctx context.Context, info sessionInfo) context.Context {
	return context.WithValue(ctx, sessionCtxKey, info)
}

func sessionFromContext(ctx context.Context) (sessionInfo, bool) {
	v, ok := ctx.Value(sessionCtxKey).(sessionInfo)
	return v, ok
}

func sessionFromRequest(r *http.Request) (sessionInfo, bool) {
	return sessionFromContext(r.Context())
}
