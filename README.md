# 🤖 AI Debates

> **Watch Artificial Intelligence clash in real-time debates on any topic.**

![Project Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)
![VS Code](https://img.shields.io/badge/Made%20in-VS%20Code-0078d7.svg?style=flat&logo=visual-studio-code&logoColor=white)

**AI Debates** is a full-stack platform that orchestrates structured debates between multiple AI personas. Powered by **OpenRouter**, it allows you to pit over **600+ LLMs** (including **GPT-5**, **Gemini 3**, **Claude 3.7**, **DeepSeek R1**) against each other, assigning them custom roles, personalities, and stances.

Watch the conversation unfold in real-time as a Moderator AI guides the discussion through opening statements, rebuttals, and closing arguments.

> **🚀 Live Demo Version is Coming Soon!**

![App Demo](https://github.com/user-attachments/assets/54c6768d-8b00-43a9-baa7-1312c8dc01a4)

---

## ✨ Key Features

- **🎭 Custom Personas**: Create detailed debaters with specific voices, biases, and knowledge bases.
- **⚔️ LLM vs LLM**: Mix and match models. Have **Claude 3 Opus** debate **GPT-4o** on philosophy.
- **⚡ Real-time Streaming**: Watch the debate generate token-by-token with live updates.
- **⚖️ AI Moderator**: An automated judge manages the flow, ensures rules are followed, and delivers a final verdict.
- **📊 Analytics**: Track token usage, cost per debate, and logical fallacy analysis.
- **🐳 Dockerized**: Fully containerized setup for easy deployment.

## 🛠️ Tech Stack

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12+, managed with [uv](https://docs.astral.sh/uv/))
- **Database**: PostgreSQL (async SQLAlchemy 2 + Alembic migrations)
- **Queue**: Redis & RQ (Redis Queue) for reliable task orchestration
- **AI Integration**: [OpenRouter](https://openrouter.ai/) API (streaming, token & cost accounting)
- **Quality**: ruff, pyright, pytest

### Frontend
- **Framework**: [React 19](https://react.dev/) + [Vite 8](https://vite.dev/) + TypeScript
- **Styling**: Tailwind CSS 4
- **State/Routing**: React Router, Axios
- **Streaming**: Server-Sent Events (SSE)

### DevOps
- **Containers**: Docker Compose (Postgres, Redis, API, worker, Caddy)
- **CI**: GitHub Actions (lint, type-check, tests, build)

---

## 🚀 Getting Started

Follow these steps to get a copy up and running locally or on your server.

### 🐳 Quick start with Docker

1. **Clone the repository**
   ```bash
   git clone https://github.com/khoren93/ai-debates.git
   cd ai-debates
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   For local testing you only need to set `OPENROUTER_API_KEY`. Keep `DOMAIN_NAME=localhost`.

3. **Run**
   ```bash
   docker compose up -d --build
   ```
   Database migrations run automatically when the API container starts.

4. **Open**
   - **Frontend**: [http://localhost](http://localhost)
   - **API docs**: [http://localhost/api/docs](http://localhost/api/docs)
   - **Admin panel**: [http://localhost/api/admin](http://localhost/api/admin) (`ADMIN_USER` / `ADMIN_PASSWORD`)

### 💻 Local development (hot reload)

Prerequisites: [uv](https://docs.astral.sh/uv/), Node.js 20.19+ and Docker.

```bash
# 1. Infrastructure only (Postgres on :5432, Redis on :6379)
docker compose -f docker-compose.dev.yml up -d

# 2. Backend API (http://localhost:8000/api/docs)
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload

# 3. Worker (second terminal). SimpleWorker avoids fork issues on macOS.
cd backend
RQ_SIMPLE_WORKER=true uv run python -m app.worker

# 4. Frontend (third terminal, http://localhost:5173 — proxies /api to the backend)
cd frontend
npm install
npm run dev
```

Leave `DATABASE_URL` and `REDIS_URL` unset in `.env`: the defaults point at localhost, and
`docker compose` injects the container addresses itself.

**Checks**

```bash
cd backend && uv run ruff check . && uv run pyright && uv run pytest
cd frontend && npm run check && npm run build
```

---

### 🌐 Server Deployment (Hetzner/VPS)

1. **Point your domain** (e.g., `ai-debates.net`) to your server IP in Cloudflare/DNS.
2. **SSH into your server** and install Docker:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. **Clone and Setup**:
   ```bash
   git clone https://github.com/khoren93/ai-debates.git
   cd ai-debates
   cp .env.example .env
   ```
4. **Edit `.env`**:
   - Set `DOMAIN_NAME=your-domain.com`
   - Set `ACME_EMAIL=your@email.com` (for SSL)
   - Set `OPENROUTER_API_KEY=...`
   - Generate a strong `POSTGRES_PASSWORD`.
5. **Start everything**:
   ```bash
   ./deploy.sh
   ```
   `deploy.sh` pulls the latest code, rebuilds the containers (migrations run on start) and
   prunes old images. In production set `ENVIRONMENT=production` and replace every placeholder
   secret in `.env` (`SECRET_KEY`, `ADMIN_PASSWORD`, `POSTGRES_PASSWORD`).

---

## 📖 Usage

1. Open the web interface at `https://your-domain.com` (or `http://localhost`).
2. Click **"Create Debate"**.
3. Enter a **Topic** (e.g., "Is AI sentient?").
4. Configure your **Participants**:
   - **Debater 1**: "Optimist Prime" (Model: GPT-4o)
   - **Debater 2**: "Skeptical Sam" (Model: Claude 3.5 Sonnet)
   - **Moderator**: (Model: Gemini Pro)
5. Set the **Intensity** and **Rounds**.
6. Hit **Start Debate** and watch the magic happen!

---

## 🏗️ Architecture Overview

The system uses an event-driven architecture to handle long-running LLM generation tasks without blocking the UI.

1. **API Layer**: `POST /api/debates` validates the configuration and saves the debate with status `queued`.
   A user-supplied OpenRouter key is kept only in Redis for the lifetime of the debate, never in the database.
2. **Queue (RQ)**: A chain of jobs runs in the worker: `start` → one job per turn → `verdict` → `finish`.
3. **Scheduler**: Every round starts with the moderator (introduction, then short transitions) followed by
   each debater. Debater turns are typed `opening` / `rebuttal` / `closing`; the moderator's model then
   delivers a structured verdict.
4. **Worker**: Builds role-specific prompts, streams the OpenRouter response, records token usage and cost
   per turn, and publishes events to Redis Pub/Sub. A debate can be stopped at any time from the UI.
5. **Frontend**: Subscribes to `GET /api/debates/{id}/stream` (SSE) and renders turns token-by-token.
   Finished debates are served straight from the database.

**Configuration** (see `.env.example`): `OPENROUTER_API_KEY`, `ALLOWED_ORIGINS`, `DEBATE_CREATE_RATE_LIMIT`
(debates per IP per hour), `TURN_JOB_TIMEOUT`, `ADMIN_USER` / `ADMIN_PASSWORD`, `SECRET_KEY`.

---

## 🗺️ Roadmap

- [x] **Voice Synthesis (TTS)**: Browser text-to-speech playback.
- [x] **Neural TTS**: ElevenLabs / Edge voices with word timestamps, karaoke transcript and MP3 export.
- [x] **Video**: 16:9 debate video and 9:16 shorts rendered in the browser (Remotion).
- [ ] **User Voting**: Let the audience decide the winner.
- [x] **Export Transcripts**: Save debates as Markdown.
- [ ] **PDF Export**: Nicely formatted transcript downloads.
- [ ] **Multiplayer Mode**: Human vs AI debates.
- [ ] **Local LLM Support**: Integration with Ollama for offline debates.

---

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 📬 Contact

Project Link: [https://github.com/khoren93/ai-debates](https://github.com/khoren93/ai-debates)
