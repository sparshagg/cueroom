# Production Secrets

- [ ] Keep this directory out of commits except this README and non-secret examples.
- [ ] Create `postgres_password` with a random database password.
- [ ] Create `postgres_url` as `postgres://cueroom:<url-encoded-password>@postgres:5432/cueroom`.
- [ ] Create `redis_password` with a random Redis password.
- [ ] Create `redis_url` as `redis://:<url-encoded-password>@redis:6379`.
- [ ] Create `redis.conf` with `save ""`, `appendonly no`, and `requirepass <same redis_password value>`.
- [ ] Create `livekit_api_secret` with the LiveKit API secret used by the API.
- [ ] Copy `../livekit/livekit.prod.example.yaml` to `livekit.yaml` and replace the LiveKit and Redis placeholder secrets with the same values as `livekit_api_secret` and `redis_password`.
- [ ] Create `smtp_password` with the SMTP password or provider app password.
- [ ] Set permissions so only the deployment user can read these files.
- [ ] Rotate these files immediately after any suspected host, deploy, or repository secret leak.
