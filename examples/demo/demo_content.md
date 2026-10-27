# LOCAL DEMO FIXTURE — not real user content

Rate limiting in FastAPI with slowapi.

- Without a limit, one client can flood an endpoint with requests.
- slowapi's Limiter identifies clients by IP with get_remote_address.
- @limiter.limit("5/minute") allows 5 requests per minute per client; the 6th gets HTTP 429 Too Many Requests.
- Register the RateLimitExceeded handler and attach the limiter to app.state.
- The endpoint must accept a `request: Request` parameter.
- In production: use shared storage such as Redis when running multiple workers, and make sure the real client IP
  is used when the app runs behind a proxy.
