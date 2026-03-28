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

Create these local env files.

You can use the committed examples:

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

The root `.env.example` also includes both app examples in one place for quick reference.

Or create them manually as shown below.

### Backend

File: `backend/.env`

Example:

```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/progressiq
JWT_SECRET=change_this_to_a_long_random_secret
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=
```

### Frontend

File: `frontend/.env`

Example:

```env
VITE_API_URL=http://localhost:3000/api
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

- backend on `http://localhost:3000`
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
- Backend API: `http://localhost:3000/api`

## Notes

- `node_modules`, build output, and `.env` files are ignored at the repo root.
- If the frontend cannot connect, verify `frontend/.env` points to the correct backend API base URL.
- If login or dashboard data fails, confirm MongoDB is running and backend env values are correct.
- `npm run seed:admin` creates the default admin user shown by the backend seed script.
