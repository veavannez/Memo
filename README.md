# MEMO

> Developer handoff and team context app — built for the IBM watsonx Hackathon.

MEMO gives engineering teams a single place to capture, organize, and surface context: project memos, tasks, and GitHub-linked activity — so nothing gets lost in Slack or stale docs.

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Git

### 1. Clone & set up environment variables

```bash
git clone https://github.com/veavannez/Memo.git
cd Memo

# Copy the example env file and fill in your credentials
cp .env.example backend/.env
cp .env.example frontend/.env   # only VITE_* vars are used by the frontend
```

Edit `backend/.env` and `frontend/.env` with your actual values.  
**Never commit `.env` files.** See [SECURITY.MD](SECURITY.MD).

### 2. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

### 4. Run locally

Open two terminals:

**Terminal 1 — Backend (http://localhost:8000)**
```bash
cd backend
uvicorn app.main:app --reload
```

**Terminal 2 — Frontend (http://localhost:5173)**
```bash
cd frontend
npm run dev
```

API docs available at: http://localhost:8000/docs

---

## Project Structure

```
Memo/
├── backend/               # FastAPI + SQLModel + SQLite (dev) / PostgreSQL (prod)
│   ├── app/
│   │   ├── api/           # Route handlers (auth, projects, memos, tasks, ...)
│   │   ├── core/          # Config, database, security
│   │   ├── models/        # SQLModel ORM models
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   └── services/      # Business logic
│   ├── migrations/        # Alembic migrations
│   └── tests/
├── frontend/              # React 19 + Vite + TypeScript + Tailwind
│   └── src/
├── .env.example           # Environment variable template
├── .gitignore             # Hackathon security gitignore
├── .bobignore             # Prevents Bob AI from logging credentials
└── SECURITY.MD            # Security guidelines
```

---

## Security

This project follows the IBM watsonx Hackathon security guidelines:

- All credentials are stored in `.env` (never committed)
- `.gitignore` and `.bobignore` prevent accidental credential exposure
- See [SECURITY.MD](SECURITY.MD) for full guidelines

---

## Before Every Commit

- [ ] Reviewed `git diff` for sensitive data
- [ ] No hardcoded API keys or passwords
- [ ] `.env` file is NOT in staged changes
- [ ] Used environment variables for all credentials

---

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Backend  | FastAPI, SQLModel, Alembic, SQLite (dev) / PostgreSQL (prod) |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, TanStack Query |
| Auth     | GitHub OAuth via GitHub App + JWT |
| AI       | IBM watsonx (planned) |

---

## Need Help?

- Read [SECURITY.MD](SECURITY.MD) for credential guidelines
- Contact hackathon support through the mentor channel
- Ask in the hackathon Slack workspace