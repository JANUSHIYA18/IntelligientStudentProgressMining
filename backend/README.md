# ProgressIQ Backend

## Install
```bash
cd backend
npm install
```

## Run
```bash
npm run dev
```

Server: `http://localhost:3000`
Health: `GET /health`

## Seed full school auth data
```bash
npm run seed:demo
```
Creates:
- 12 classes (`1-12`) with sections `A` and `B`
- 1 teacher per class-section (`24` teachers total)
- 20 students per class-section (`480` students total)
- matching `User` records for admin, all teachers, and all students

Login format:
- Admin: `janushiya@admin.in`
- Teacher: `<teacher-name>@teacher.in`
- Student: `<student-name>@student.in`
- Password (all users): `123456`

## Seed only admin
```bash
npm run seed:admin
```
Default: `janushiya@admin.in / 123456`

See `API_CONTRACT.md` for full API definitions.
