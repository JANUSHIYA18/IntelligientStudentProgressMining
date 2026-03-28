# ProgressIQ

ProgressIQ is a full-stack school management and student progress system with:

- `backend/` for API, auth, database, reports, assignments, announcements, and admin features
- `frontend/` for admin, faculty, and student dashboards

## Project Structure

```text
ProgressIQ/
|-- backend/
|-- frontend/
|-- package.json
|-- README.md
```

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB running locally or a MongoDB connection string

## Environment Setup

Create these local env files:

### Backend

File: `backend/.env`

Example:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/progressiq
JWT_SECRET=your_jwt_secret
ADMIN_EMAIL=admin@school.in
ADMIN_PASSWORD=admin123
```

### Frontend

File: `frontend/.env`

Example:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Install

From the repo root:

```bash
npm install
npm run install:all
```

What this does:

- installs the root helper dependency `concurrently`
- installs backend dependencies
- installs frontend dependencies

## Run The App

### Start both backend and frontend together

From the repo root:

```bash
npm run dev
```

This starts:

- backend on `http://localhost:5000`
- frontend on `http://localhost:5173`

### Start them separately

Backend:

```bash
npm run dev:backend
```

Frontend:

```bash
npm run dev:frontend
```

## Production-Oriented Commands

Run backend with Node and frontend with Vite dev server:

```bash
npm run start
```

Build frontend:

```bash
npm run build
```

## Seed Commands

Seed admin:

```bash
npm run seed:admin
```

Seed demo data:

```bash
npm run seed:demo
```

## Main URLs

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`

## Notes

- `node_modules`, build output, and `.env` files are ignored at the repo root.
- If the frontend cannot connect, verify `frontend/.env` points to the correct backend API base URL.
- If login or dashboard data fails, confirm MongoDB is running and backend env values are correct.
