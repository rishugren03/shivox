# Shivox 🚀

**Shivox** is an AI-powered job application automation platform designed to simplify and streamline job hunting for Voice AI, AI/ML, and Tech roles. It features an intuitive swipe-based frontend and an agentic backend capable of fetching job postings across major ATS platforms (Greenhouse, Lever, Ashby) and automatically handling application submissions.

Inspired by Tsenta YC S26.

---

## 🏗️ Project Architecture

```
tsenta-for-voice-ai/
├── backend/          # Express API server, Prisma ORM, ATS Scrapers & Playwright Fillers
└── frontend/         # React + Vite + TypeScript application with Framer Motion & Tailwind CSS
```

---

## ⚡ Quick Start

### Prerequisites

- Node.js (v18+ recommended)
- npm / yarn / pnpm

### 1. Backend Setup

```bash
cd backend
npm install
npx prisma db push
npm run dev
```

*The backend server runs by default on `http://localhost:5000`.*

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

*The frontend application runs by default on `http://localhost:5173`.*

---

## 🔑 Environment Variables

Create a `.env` file in the `backend/` directory:

```env
PORT=5000
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

---

## 📜 Available Scripts

### Backend (`backend/`)
- `npm run dev`: Starts the backend development server with `tsx`.
- `npm run seed`: Seeds target company list into the database.
- `npm run poll`: Polls configured ATS job boards for open positions.

### Frontend (`frontend/`)
- `npm run dev`: Starts the Vite development server.
- `npm run build`: Compiles TypeScript and builds production assets.
- `npm run preview`: Previews the production build locally.
- `npm run lint`: Runs Oxlint code checks.
