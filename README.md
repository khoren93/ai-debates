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
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Database**: PostgreSQL (Async SQLAlchemy)
- **Queue**: Redis & RQ (Redis Queue) for reliable task orchestration
- **AI Integration**: [OpenRouter](https://openrouter.ai/) API

### Frontend
- **Framework**: [React](https://react.dev/) (Vite)
- **Styling**: TailwindCSS
- **State/Routing**: React Router, Axios
- **Streaming**: Server-Sent Events (SSE)

### DevOps
- **IDE**: Visual Studio Code

---

## 🚀 Getting Started

Follow these steps to get a copy up and running locally or on your server.

### 🛠️ Local Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/khoren93/ai-debates.git
   cd ai-debates
   ```

2. **Configure Environment**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   For local testing, you only need to add your `OPENROUTER_API_KEY`. You can keep `DOMAIN_NAME=localhost`.

3. **Run with Docker**
   ```bash
   docker compose up -d --build
   ```

4. **Access the App**
   - **Frontend**: [http://localhost](http://localhost)
   - **Backend API**: [http://localhost/api/docs](http://localhost/api/docs)

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
   chmod +x deploy.sh
   ./deploy.sh
   ```
   Caddy will automatically issue and manage SSL certificates for your domain.

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

1. **API Layer**: Receives a request to create a debate.
2. **Database**: Saves the initial debate configuration with status `queued`.
3. **Queue (RQ)**: A job is pushed to the Redis Queue.
4. **Worker**: Picks up the job and acts as the "Orchestrator".
   - It builds the prompt for the current speaker.
   - Calls OpenRouter API.
   - Streams the response back to Redis Pub/Sub.
5. **Frontend**: Subscribes to the debate channel via SSE (Server-Sent Events) and updates the UI in real-time.

---

## 🗺️ Roadmap

- [ ] **Voice Synthesis (TTS)**: Hear the debaters speak!
- [ ] **User Voting**: Let the audience decide the winner.
- [ ] **Export Transcripts**: Save debates as PDF/Text.
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
