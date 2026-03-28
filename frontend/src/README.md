# ProgressIQ - Intelligent Student Progress Mining (School Edition)

A comprehensive MERN stack frontend application for tracking and analyzing student academic performance in schools.

## 🎯 Project Overview

**ProgressIQ** is an intelligent student progress monitoring system designed for schools to track academic performance, manage student data, and provide personalized recommendations for improvement.

### Key Features
- ✅ Role-based authentication (Admin, Teacher, Student)
- ✅ Comprehensive dashboards for each role
- ✅ Real-time performance tracking and visualization
- ✅ Automated weak area detection
- ✅ Personalized recommendation system
- ✅ Report generation (PDF/CSV)
- ✅ Activity logging and monitoring
- ✅ Responsive design for all devices

## 🛠️ Tech Stack

### Frontend
- **React.js** (with TypeScript)
- **React Router** for navigation
- **Recharts** for data visualization
- **Tailwind CSS** for styling
- **Lucide React** for icons

### Backend (to be integrated)
- Node.js
- Express.js
- MongoDB
- JWT authentication

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Login.tsx                 # Authentication page
│   │   ├── AdminDashboard.tsx        # Admin dashboard
│   │   ├── TeacherDashboard.tsx      # Teacher dashboard
│   │   ├── FacultyDashboard.tsx      # Faculty student details view
│   │   ├── StudentDashboard.tsx      # Student dashboard
│   │   ├── Graphs.tsx                # Performance visualization
│   │   ├── Recommendations.tsx       # AI recommendations
│   │   ├── Reports.tsx               # Report generation
│   │   ├── ActivityLog.tsx           # System activity logs
│   │   └── Navigation.tsx            # Navigation component
│   ├── routes.ts                     # Route configuration
│   ├── App.tsx                       # Main app component
│   └── styles/
│       └── globals.css               # Global styles
├── public/
└── package.json
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd progressiq-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to:
```
http://localhost:5173
```

## 👥 User Roles & Features

### 🧑‍💼 Admin Dashboard

**Access:** Headmaster / School Administrator

**Features:**
- View total students, teachers, and classes
- Overall performance distribution (Pie chart)
- Class-wise performance comparison (Bar chart)
- Activity log tracking
- Quick actions:
  - Add new students
  - Manage teachers
  - Manage classes
  - System settings

**Viva Line:**
> "Admin can monitor overall academic performance using dashboards and charts."

### 👨‍🏫 Teacher Dashboard

**Access:** Faculty Members

**Features:**
- Select class, section, subject, and exam type
- Enter student marks (Unit Test / Mid Term / Final Exam)
- Mark student attendance (Present/Absent)
- View student details with parent/guardian information
- Upload marks via CSV
- Success/Error notifications

**Detailed Student View:**
- Complete academic performance
- Subject-wise marks with charts
- Attendance summary (Pie chart)
- Parent/Guardian contact information
- Assignment tracking
- Performance trends

**Viva Line:**
> "Faculty enter marks and attendance through this interface."

### 🎓 Student Dashboard

**Access:** Students

**Features:**
- View CGPA and overall performance
- Subject-wise marks with progress bars
- Attendance percentage
- Arrear count
- Fees pending status
- Upcoming events and deadlines
- Faculty planned actions
- Weak subjects alert

**Viva Line:**
> "Students can track their academic progress and weak areas."

## 📊 Additional Pages

### 📈 Graphs & Visualization

**Features:**
- Semester-wise performance trend (Line chart)
- Subject-wise marks comparison (Bar chart)
- Overall performance distribution (Pie chart)

**Viva Line:**
> "Graphs help visualize performance trends over semesters."

### 💡 Recommendations Page

**Features:**
- AI-powered improvement suggestions
- Subject-specific study tips
- Remedial class recommendations
- Practice resources
- Faculty office hours

**Viva Line:**
> "The system generates intelligent recommendations for improvement."

### 📄 Reports Page

**Features:**
- Download PDF reports
- Download CSV reports
- Semester-wise summaries
- Academic year reports
- Print-ready formats

**Viva Line:**
> "Reports provide downloadable academic summaries."

### 📜 Activity Log (Admin Only)

**Features:**
- Track all system activities
- User action history
- Login tracking
- Data modification logs
- Export activity logs

**Viva Line:**
> "This module tracks system usage for transparency."

## 🔐 Authentication Flow

```
Login Page
  ↓
Role Verification (Admin / Teacher / Student)
  ↓
JWT Token Generation & Storage
  ↓
Role-based Dashboard Redirect
```

### Default Test Credentials
```
Admin:
  Username: admin
  Password: admin123
  Role: Admin

Teacher:
  Username: teacher
  Password: teacher123
  Role: Teacher

Student:
  Username: student
  Password: student123
  Role: Student
```

## 📊 Data Flow

### Teacher Workflow
```
Login → Select Class/Section/Subject
  ↓
Enter Marks/Attendance
  ↓
Save to Database
  ↓
Performance Analysis
  ↓
Weak Area Detection
  ↓
Visualization
```

### Admin Workflow
```
Login → View Dashboard
  ↓
Monitor Performance
  ↓
Manage Users/Classes
  ↓
Generate Reports
  ↓
View Activity Logs
```

### Student Workflow
```
Login → View Dashboard
  ↓
Check Marks/Attendance
  ↓
View Performance Trends
  ↓
Get Recommendations
  ↓
Download Reports
```

## 🎨 Design Features

- **Clean & Professional UI** - School-friendly academic design
- **Responsive Layout** - Works on desktop, tablet, and mobile
- **Gradient Accents** - Modern color schemes
- **Interactive Charts** - Recharts integration
- **Toast Notifications** - User feedback for actions
- **Loading States** - Better UX with loading indicators
- **Error Handling** - Graceful error messages

## 🔧 Key Components

### 1. Login Component
- Form validation
- Role-based routing
- JWT token management
- Google Sign-in option

### 2. Dashboard Components
- Real-time data visualization
- Interactive charts
- Quick action buttons
- Statistics cards

### 3. Forms
- Marks entry with validation
- Attendance tracking
- Dropdown selections (Class, Section, Subject, Exam Type)

### 4. Data Tables
- Sortable columns
- Hover effects
- Parent/Guardian details
- Action buttons

## 📱 Responsive Design

The application is fully responsive and works seamlessly on:
- Desktop (1920x1080 and above)
- Laptop (1366x768)
- Tablet (768x1024)
- Mobile (375x667 and above)

## 🔮 Future Enhancements

- [ ] Backend API integration
- [ ] Real-time notifications
- [ ] Parent portal
- [ ] Mobile app (React Native)
- [ ] WhatsApp integration for alerts
- [ ] AI-powered predictions
- [ ] Timetable management
- [ ] Fee management system
- [ ] Library management
- [ ] Transport tracking

## 🤝 Contributing

This is an academic project. For any improvements or suggestions, please create an issue or submit a pull request.

## 📄 License

This project is created for educational purposes.

## 👨‍💻 Developers

Created as part of the "Intelligent Student Progress Mining - School Edition" project.

---

**ProgressIQ** - Making Education Smarter, One Student at a Time! 🎓
