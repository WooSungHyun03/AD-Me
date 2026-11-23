# D022 independent OAuth credential boundary

Server-only AES256-GCM envelope bound to provider/owner/app/key/version, opaque one-use5-minute OAuth state with atomic-consume port, refresh with approved-scope/subject checks and generation-CAS write refusing revoke races. No token logging or new runtime key/config registration. Key bytes and refresh/repository adapters are injected; tests generate a random local key and fictional scopes/tokens.

This is an independently testable credential/flow core, not an active Instagram connection or actual Meta verification. U012 supported account type/scopes/API-version/approval, callback and encrypted DB storage/RLS, provider exchange/refresh/revoke and actual account sync remain unimplemented. No endpoint/official API version is fabricated and no Meta request is made. IN_PROGRESS.
