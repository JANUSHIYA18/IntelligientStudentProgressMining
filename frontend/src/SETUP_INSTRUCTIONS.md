# ProgressIQ - Setup & Installation Guide

## 🚀 Quick Start Guide

### System Requirements
- **Node.js:** v16.0.0 or higher
- **npm:** v8.0.0 or higher (comes with Node.js)
- **Browser:** Chrome, Firefox, Safari, or Edge (latest versions)
- **RAM:** Minimum 4GB
- **Storage:** 500MB free space

---

## 📥 Installation Steps

### Step 1: Verify Prerequisites
```bash
# Check Node.js version
node --version
# Should show v16.0.0 or higher

# Check npm version
npm --version
# Should show v8.0.0 or higher
```

### Step 2: Clone or Download the Project
```bash
# If using Git
git clone <repository-url>
cd progressiq-frontend

# Or download ZIP and extract
```

### Step 3: Install Dependencies
```bash
# Navigate to project directory
cd progressiq-frontend

# Install all required packages
npm install

# This will install:
# - React & React DOM
# - React Router
# - Recharts (for graphs)
# - Lucide React (for icons)
# - Tailwind CSS
# - TypeScript
# - And other dependencies
```

### Step 4: Start Development Server
```bash
npm run dev
```

You should see output similar to:
```
  VITE v5.0.0  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h to show help
```

### Step 5: Open in Browser
Navigate to: `http://localhost:5173`

---

## 🧪 Testing the Application

### Test Credentials

#### Admin Login
```
Username: admin
Password: admin123
Role: Admin
```

#### Teacher Login
```
Username: teacher
Password: teacher123
Role: Teacher
```

#### Student Login
```
Username: student
Password: student123
Role: Student
```

### Google Sign-In Test
- Click "Sign in with Google"
- Will auto-login as Student (demo mode)

---

## 📊 Sample Data

The application comes pre-loaded with dummy data for testing:

### Students (5 Sample Students)
```javascript
1. Alice Johnson (CS001)
   - Marks: 85/100
   - Attendance: 90%
   - Parent: Mr. Robert Johnson (+1 234-567-8901)
   - Status: Good

2. Bob Smith (CS002)
   - Marks: 72/100
   - Attendance: 85%
   - Parent: Mrs. Sarah Smith (+1 234-567-8902)
   - Status: Average

3. Charlie Brown (CS003)
   - Marks: 68/100
   - Attendance: 75%
   - Parent: Mr. David Brown (+1 234-567-8903)
   - Status: Weak

4. Diana Prince (CS004)
   - Marks: 92/100
   - Attendance: 95%
   - Parent: Mrs. Maria Prince (+1 234-567-8904)
   - Status: Good

5. Edward Norton (CS005)
   - Marks: 78/100
   - Attendance: 88%
   - Parent: Mr. James Norton (+1 234-567-8905)
   - Status: Average
```

### Classes Available
- Class 6 (Sections A, B, C)
- Class 7 (Sections A, B, C)
- Class 8 (Sections A, B, C)
- Class 9 (Sections A, B, C)
- Class 10 (Sections A, B, C)

### Subjects
- Mathematics
- Physics
- Chemistry
- English
- Computer Science
- Biology
- History

### Exam Types
- Unit Test
- Mid Term
- Final Exam
- Assignment

---

## 🎯 Testing Workflow

### 1. Test Admin Dashboard
```
1. Login as Admin
2. View statistics:
   - Total Students: 1,248
   - Total Teachers: 64
   - Total Classes: 15
3. Check performance charts:
   - Pie chart (Good/Average/Weak)
   - Bar chart (Class-wise)
4. Review activity log
5. Test quick action buttons
```

### 2. Test Teacher Dashboard
```
1. Login as Teacher
2. Select:
   - Class: Class 10
   - Section: Section A
   - Subject: Mathematics
   - Exam Type: Unit Test
3. Enter Marks:
   - Modify marks for students
   - Click "Save Marks"
   - Verify success notification
4. Mark Attendance:
   - Toggle Present/Absent
   - Click "Save Attendance"
   - Check attendance count
5. Click on a student to view detailed profile
```

### 3. Test Student Dashboard
```
1. Login as Student
2. View summary cards:
   - CGPA: 8.2
   - Attendance: 82%
   - Arrears: 1
   - Fees Pending: $1,500
3. Check subject-wise marks
4. Review upcoming events
5. Read faculty planned actions
6. Note weak subjects alert
```

### 4. Test Graphs Page
```
1. Navigate to Graphs from any dashboard
2. View semester-wise line chart
3. Check subject-wise bar chart
4. Review performance pie chart
```

### 5. Test Recommendations Page
```
1. Navigate to Recommendations (Student only)
2. View weak subject alerts
3. Read improvement suggestions
4. Check additional resources
```

### 6. Test Reports Page
```
1. Navigate to Reports
2. Click "Download PDF" (alerts in demo)
3. Click "Download CSV" (alerts in demo)
4. Review semester summaries
```

### 7. Test Activity Log
```
1. Navigate to Activity Log (Admin only)
2. Review recent activities
3. Check activity types and timestamps
4. Click "View All Activities"
```

---

## 🐛 Troubleshooting

### Issue: Port 5173 already in use
**Solution:**
```bash
# Kill the process using port 5173
# On Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# On Mac/Linux:
lsof -ti:5173 | xargs kill
```

### Issue: npm install fails
**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Issue: Module not found errors
**Solution:**
```bash
# Ensure all dependencies are installed
npm install

# Restart development server
npm run dev
```

### Issue: Charts not rendering
**Solution:**
- Ensure Recharts is installed: `npm install recharts`
- Check browser console for errors
- Clear browser cache

### Issue: Tailwind styles not working
**Solution:**
- Verify Tailwind CSS is in dependencies
- Check if styles/globals.css is imported
- Restart development server

---

## 📱 Building for Production

### Create Production Build
```bash
npm run build
```

This creates an optimized production build in the `dist` folder.

### Preview Production Build
```bash
npm run preview
```

### Deploy to Hosting
```bash
# For Vercel
vercel deploy

# For Netlify
netlify deploy

# For GitHub Pages
npm run build
# Upload dist folder to gh-pages branch
```

---

## 🔧 Configuration

### Environment Variables (Optional)
Create a `.env` file in the root directory:
```env
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=ProgressIQ
```

### Tailwind Configuration
Edit `tailwind.config.js` to customize:
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#4f46e5',
        secondary: '#7c3aed',
      },
    },
  },
}
```

---

## 📚 Project Structure Explained

```
progressiq-frontend/
│
├── public/                    # Static files
│   └── favicon.ico
│
├── src/                       # Source code
│   ├── components/            # React components
│   │   ├── Login.tsx         # Authentication
│   │   ├── AdminDashboard.tsx
│   │   ├── TeacherDashboard.tsx
│   │   ├── StudentDashboard.tsx
│   │   ├── Navigation.tsx    # Shared navigation
│   │   └── ...
│   │
│   ├── styles/               # CSS files
│   │   └── globals.css
│   │
│   ├── routes.ts             # Route configuration
│   ├── App.tsx               # Main app component
│   └── main.tsx              # Entry point
│
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── vite.config.ts            # Vite config
├── tailwind.config.js        # Tailwind config
├── README.md                 # Project documentation
├── VIVA_GUIDE.md            # Viva preparation
└── SETUP_INSTRUCTIONS.md    # This file
```

---

## 🎓 For Academic Presentation

### Demo Preparation Checklist
- [ ] Install all dependencies
- [ ] Test all user roles (Admin, Teacher, Student)
- [ ] Verify all charts are rendering
- [ ] Test form submissions
- [ ] Check responsive design on mobile
- [ ] Prepare backup slides/screenshots
- [ ] Test internet connection (if using online APIs)
- [ ] Have backup demo data ready

### Presentation Flow
1. **Introduction** (2 mins)
   - Project overview
   - Problem statement
   - Solution approach

2. **Technology Stack** (2 mins)
   - Frontend technologies
   - Backend plan
   - Database choice

3. **Live Demo** (10 mins)
   - Login and authentication
   - Admin dashboard tour
   - Teacher marking system
   - Student progress view
   - Data visualization
   - Report generation

4. **Code Walkthrough** (5 mins)
   - Project structure
   - Key components
   - Routing mechanism
   - State management

5. **Q&A** (5 mins)
   - Be ready for technical questions
   - Explain design decisions
   - Discuss future enhancements

---

## 📞 Support & Resources

### Documentation Links
- React: https://react.dev
- Recharts: https://recharts.org
- Tailwind CSS: https://tailwindcss.com
- React Router: https://reactrouter.com

### Common Commands
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Format code
npm run format
```

---

## ✅ Pre-Demo Checklist

**Day Before Presentation:**
- [ ] Test application on presentation laptop
- [ ] Ensure stable internet connection
- [ ] Install all dependencies
- [ ] Verify all features are working
- [ ] Prepare backup screenshots
- [ ] Practice demo flow (2-3 times)
- [ ] Review viva questions
- [ ] Charge laptop fully

**On Presentation Day:**
- [ ] Open application before presentation
- [ ] Login to all three roles
- [ ] Keep browsers ready with different tabs
- [ ] Have backup data ready
- [ ] Be confident and clear in explanation

---

## 🎯 Success Tips

1. **Know Your Code:** Understand every component
2. **Practice Demo:** Run through multiple times
3. **Have Backups:** Screenshots if live demo fails
4. **Be Confident:** Speak clearly and maintain eye contact
5. **Answer Honestly:** If you don't know, say you'll research it
6. **Show Passion:** Demonstrate enthusiasm for the project

---

**Good Luck with Your Presentation! 🎓✨**

For any issues, check the console for error messages or review the README.md file.
