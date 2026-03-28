# ProgressIQ Backend API Contract

Base URL: `http://localhost:3000/api`
All protected routes need: `Authorization: Bearer <token>`

## Common response
Success:
```json
{ "success": true, "message": "Success", "data": {} }
```
Error:
```json
{ "success": false, "message": "Error message" }
```

## Auth
### POST `/auth/register`
```json
{
  "name": "John Doe",
  "username": "john",
  "email": "john@school.com",
  "password": "secret123",
  "role": "Student",
  "studentId": "STU10A001",
  "teacherId": null
}
```

### POST `/auth/login`
```json
{
  "username": "admin",
  "password": "admin123",
  "role": "Admin"
}
```
Response `data`:
```json
{
  "token": "jwt_token",
  "user": {
    "id": "...",
    "name": "System Admin",
    "username": "admin",
    "role": "Admin",
    "studentId": null,
    "teacherId": null
  }
}
```

### GET `/auth/me`
Response: authenticated user profile.

## Admin
### GET `/admin/dashboard`
```json
{
  "totalStudents": 480,
  "totalTeachers": 24,
  "totalClasses": 24,
  "averagePerformance": 78.24
}
```

### GET `/admin/performance-distribution`
```json
[
  { "name": "Good", "value": 200 },
  { "name": "Average", "value": 180 },
  { "name": "Weak", "value": 100 }
]
```

### GET `/admin/class-performance`
```json
[
  { "class": "Class 10", "good": 18, "average": 14, "weak": 8 }
]
```

### GET `/admin/activities?limit=50`
Response: activity log array.

### POST `/admin/students`
```json
{
  "studentId": "STU10A021",
  "name": "New Student",
  "class": 10,
  "section": "A",
  "rollNo": "10A21"
}
```

### POST `/admin/teachers`
```json
{
  "teacherId": "T007",
  "name": "Ms. New Teacher",
  "subject": "Mathematics",
  "email": "new.teacher@school.com",
  "phone": "+911234567890",
  "experience": 5,
  "assignedClasses": [{ "class": 10, "section": "A" }]
}
```

### GET `/admin/teachers`
Response: teacher list.

### DELETE `/admin/teachers/:id`
Response: success message.

### GET `/admin/classes`
Response: class-section list.

## Faculty
### GET `/faculty/overview?class=10&section=A`
```json
{
  "teacher": {
    "teacherId": "T001",
    "name": "Mr. John Smith"
  },
  "totalStudents": 20,
  "class": 10,
  "section": "A"
}
```

### GET `/faculty/students?class=10&section=A`
Response: student list for Faculty table.

### GET `/faculty/students/:studentId`
Response: full student detail payload for modal.

### PUT `/faculty/students/:studentId/marks`
```json
{
  "subject": "Mathematics",
  "marks": 88,
  "totalMarks": 100,
  "actorName": "Mr. John Smith"
}
```

### PUT `/faculty/students/:studentId/attendance`
```json
{
  "presentDays": 172,
  "totalDays": 200,
  "actorName": "Mr. John Smith"
}
```

### POST `/faculty/marks/bulk`
```json
{
  "actorName": "Mr. John Smith",
  "entries": [
    { "studentId": "STU10A001", "subject": "Mathematics", "marks": 88, "totalMarks": 100 },
    { "studentId": "STU10A002", "subject": "Mathematics", "marks": 76, "totalMarks": 100 }
  ]
}
```
Response `data`:
```json
{
  "updatedCount": 2,
  "missingStudentIds": [],
  "invalidEntries": []
}
```

### POST `/faculty/attendance/bulk`
Supports either absolute attendance values or daily status.
```json
{
  "actorName": "Mr. John Smith",
  "entries": [
    { "studentId": "STU10A001", "presentDays": 173, "totalDays": 201 },
    { "studentId": "STU10A002", "status": "present" }
  ]
}
```
Response `data`:
```json
{
  "updatedCount": 2,
  "missingStudentIds": [],
  "invalidEntries": []
}
```

### POST `/faculty/marks/upload-csv`
Send either parsed `rows` array or raw `csvData` string. If CSV rows do not have a `subject` column, top-level `subject` is required.
```json
{
  "subject": "Mathematics",
  "totalMarks": 100,
  "csvData": "studentId,marks\nSTU10A001,89\nSTU10A002,76"
}
```

### POST `/faculty/assignments`
```json
{
  "class": 10,
  "section": "A",
  "title": "Algebra Worksheet 3",
  "description": "Submit in notebook",
  "subject": "Mathematics",
  "dueDate": "2026-02-28T00:00:00.000Z",
  "status": "active"
}
```

### GET `/faculty/assignments?class=10&section=A&status=active`
Response: assignment list sorted by `dueDate`.

### POST `/faculty/announcements`
```json
{
  "class": 10,
  "section": "A",
  "title": "Unit Test Schedule",
  "message": "Unit test starts Monday",
  "priority": "high",
  "expiresAt": "2026-03-05T00:00:00.000Z"
}
```

### GET `/faculty/announcements?class=10&section=A&includeExpired=false`
Response: announcement list sorted by latest first.

## Student
### GET `/student/:studentId/dashboard`
```json
{
  "student": {},
  "weakSubjects": [],
  "attendance": 82,
  "academicPercentage": 81.3,
  "drawbacksCount": 1,
  "feesPending": 1500
}
```

### GET `/student/:studentId/recommendations`
Response: recommendation array.

### GET `/student/:studentId/graphs`
```json
{
  "examWise": [
    { "exam": "Exam 1", "average": 74 },
    { "exam": "Mid Term", "average": 79 }
  ],
  "subjectWise": [
    { "subject": "Math", "marks": 78, "totalMarks": 100 }
  ],
  "attendance": {
    "presentDays": 170,
    "totalDays": 200,
    "percentage": 85
  }
}
```

## Reports
### GET `/reports/exams`
Response: exam cards for Reports page.

### GET `/reports/exams/:id`
Response: detailed exam report modal payload.

### GET `/reports/download?format=pdf&scope=all`
```json
{
  "downloadUrl": null,
  "message": "Report generation for all in PDF is not implemented yet"
}
```
