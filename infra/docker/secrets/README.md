# Production Secrets

- [ ] Keep this directory out of commits except this README and non-secret examples.
- [ ] Create `postgres_password` with a random database password.
- [ ] Create `postgres_url` as `postgres://cueroom:<url-encoded-password>@postgres:5432/cueroom`.
- [ ] Create `livekit_api_secret` with the LiveKit API secret used by the API.
- [ ] Copy `../livekit/livekit.prod.example.yaml` to `livekit.yaml` and replace the placeholder secret with the same value as `livekit_api_secret`.
- [ ] Create `smtp_password` with the SMTP password or provider app password.
- [ ] Set permissions so only the deployment user can read these files.
- [ ] Rotate these files immediately after any suspected host, deploy, or repository secret leak.
