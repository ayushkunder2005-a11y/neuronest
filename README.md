# NeuroNest

Full-stack multi-service scaffold: React frontend, Node/Express backend with Socket.IO and MongoDB, plus a Flask-based AI engine using DeepFace/OpenCV.

Run everything with:

```bash
docker-compose up --build
```

Endpoints:
- Frontend: http://localhost:3000
- Backend (API + WS): http://localhost:5000
- AI Engine (Flask): http://localhost:8000
- MongoDB: mongodb://localhost:27017

## Real social login

NeuroNest ships with production-ready OAuth flows for Google, Facebook, and Twitter. Passport.js negotiates each provider, persists MongoDB documents on first login, and issues signed JWTs that the React client stores using the Remember Me preference. CORS is restricted to `CLIENT_APP_URL`, and if a provider is misconfigured or denied it redirects back to `/auth/callback?error=...` so the UI can display a helpful message.

### Environment variables

Use `server/.env.example` and `client/.env.example` as starting points:

| Variable | Description |
| --- | --- |
| `CLIENT_APP_URL` | Origin allowed by CORS (e.g. `http://localhost:3000` or your production SPA). |
| `SERVER_PUBLIC_URL` | Public API origin used to build callback URLs. |
| `SOCIAL_SUCCESS_REDIRECT` | Frontend route that consumes OAuth payloads (defaults to `${CLIENT_APP_URL}/auth/callback`). |
| `VITE_API_BASE_URL` | Axios base URL, typically `${SERVER_PUBLIC_URL}/api`. |
| `VITE_APP_URL` | Optional helper for client components to build absolute links. |

Provider-specific credentials (callbacks optional unless you need non-default URLs):

- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- Facebook: `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, `FACEBOOK_CALLBACK_URL`
- Twitter (OAuth 1.1): `TWITTER_CONSUMER_KEY`, `TWITTER_CONSUMER_SECRET`, `TWITTER_CALLBACK_URL`

> Production callbacks should match your HTTPS API origin, e.g. `https://api.yourdomain.com/api/users/auth/google/callback`.

### OAuth app setup

**Google**
1. Open the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create Credentials → OAuth client ID (Web application).
2. Add `http://localhost:5000/api/users/auth/google/callback` to Authorized redirect URIs (plus your production HTTPS URL).
3. Copy the Client ID/Secret into the server `.env`.

**Facebook**
1. In [Meta for Developers](https://developers.facebook.com/), create an app → Add Product → Facebook Login → Web.
2. Set Site URL to your frontend origin (e.g. `http://localhost:3000`).
3. Under Valid OAuth Redirect URIs add `http://localhost:5000/api/users/auth/facebook/callback` and your production URL.
4. Store the App ID/Secret inside `.env`.

**Twitter**
1. Visit the [Twitter/X developer portal](https://developer.twitter.com/) and create an app with OAuth 1.0a enabled.
2. Enable “Request email from users” so Twitter returns an email address.
3. Add `http://localhost:5000/api/users/auth/twitter/callback` and your production callback to the Callback URLs.
4. Put the API Key/Secret (consumer key/secret) into `.env`.

Restart the API and Vite servers after editing environment variables. The login buttons in `Login.jsx`/`Signup.jsx` redirect to `/api/users/auth/:provider`, Passport completes the OAuth flow, and on success the API redirects to `/auth/callback` with `token` and `user` query params. `SocialCallback.jsx` decodes and stores these values (localStorage or sessionStorage based on Remember Me) before routing to the protected dashboard.

## Webcam emotion pipeline

- The dashboard webcam pushes frames to the Node/Express server over Socket.IO.
- The server now maintains a persistent Socket.IO client connection to the Python AI engine exposed at `AI_SERVER_URL` (default `http://localhost:8000`).
- Each frame is forwarded to `/ai_engine` (`frame-forward` event) and the resulting `emotion-update` payload is rebroadcast to dashboard clients as `emotion-live`.
- Optional env: `AI_SOCKET_RETRY_MS` controls the max reconnection delay between the Node bridge and the AI engine.
- The Node server auto-starts the Python AI process (`ai_engine/api/ai_server.py`) via `python` by default. Override with `AUTO_START_AI_ENGINE=false`, `AI_PYTHON_BIN`, or `AI_ENGINE_ENTRY` if you need custom behavior.
- On the Dashboard, press **Start Emotion Monitor** inside the AI Tutor card to begin streaming your webcam feed to the AI engine; the status pill turns green once the camera and socket are ready.
- The AI engine now follows a modular layout:
  - `ai_engine/api/emotion_detection.py` (DeepFace + mood ring helpers)
  - `ai_engine/api/ai_tutor.py` (OpenAI GPT “Jarvis” responses)
  - `ai_engine/config/config.py` (API keys / knobs)
  - `ai_engine/utils/utils.py` (frame decoding, mood colors)
  - `ai_engine/api/ai_server.py` ties everything together over Socket.IO

Notes:
- DeepFace and OpenCV inside Docker may increase build time and image size.
- On Windows, Docker Desktop with WSL2 is recommended.
"# neuronest" 
