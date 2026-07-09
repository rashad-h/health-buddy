# Health Buddy API (demo)

Small Express API for auth sessions and payment charges. Used as a review demo target.

## Security notes

- Session tokens expire after 15 minutes.
- Global IP rate limiting is enabled (60 req/min).
- Single-charge ceiling is $25.00.
