// Generate comprehensive student data for classes 1-12, sections A & B, 20 students each

export interface Student {
  id: string;
  name: string;
  rollNo: string;
  class: number;
  section: 'A' | 'B';
  dob: string;
  bloodGroup: string;
  parentName: string;
  parentContact: string;
  feesPending: number;
  drawbacks: number;
  presentDays: number;
  absentDays: number;
  totalDays: number;
  assignmentsCompleted: number;
  assignmentsTotal: number;
  subjects: {
    name: string;
    marks: number;
    totalMarks: number;
  }[];
  actionRequired: string;
}

const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Arnav', 'Ayaan', 'Krishna', 'Ishaan',
  'Ananya', 'Diya', 'Aanya', 'Sara', 'Pari', 'Aadhya', 'Anvi', 'Isha', 'Myra', 'Kiara',
  'Advik', 'Reyansh', 'Mohammad', 'Shaurya', 'Atharv', 'Advait', 'Pranav', 'Dhruv', 'Kabir', 'Aarush',
  'Saanvi', 'Aaradhya', 'Navya', 'Angel', 'Avni', 'Aayat', 'Pihu', 'Ahana', 'Zoya', 'Suhani'];

const lastNames = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Gupta', 'Jain', 'Agarwal', 'Mehta', 'Verma',
  'Shah', 'Khan', 'Das', 'Rao', 'Nair', 'Iyer', 'Joshi', 'Pandey', 'Bhat', 'Desai'];

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const getSubjectsForClass = (classNum: number) => {
  if (classNum <= 5) {
    return ['English', 'Mathematics', 'Science', 'Social Studies', 'Hindi'];
  } else if (classNum <= 8) {
    return ['English', 'Mathematics', 'Science', 'Social Studies', 'Hindi', 'Computer'];
  } else {
    return ['English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science'];
  }
};

const generateStudentName = (index: number) => {
  const firstNameIndex = index % firstNames.length;
  const lastNameIndex = Math.floor(index / firstNames.length) % lastNames.length;
  return `${firstNames[firstNameIndex]} ${lastNames[lastNameIndex]}`;
};

const generateRandomMarks = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const generateStudent = (classNum: number, section: 'A' | 'B', studentIndex: number): Student => {
  const overallIndex = (classNum - 1) * 40 + (section === 'A' ? 0 : 20) + studentIndex;
  const name = generateStudentName(overallIndex);
  const year = 2024 - (16 - classNum);
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  
  const subjects = getSubjectsForClass(classNum);
  const subjectsData = subjects.map(subjectName => ({
    name: subjectName,
    marks: generateRandomMarks(50, 100),
    totalMarks: 100,
  }));

  const totalDays = 200;
  const presentDays = generateRandomMarks(150, 195);
  const absentDays = totalDays - presentDays;
  const attendancePercentage = (presentDays / totalDays) * 100;

  const avgMarks = subjectsData.reduce((sum, s) => sum + s.marks, 0) / subjectsData.length;
  
  let actionRequired = 'Keep up the good work!';
  if (avgMarks < 60) {
    actionRequired = 'Needs immediate attention. Schedule remedial classes and parent meeting.';
  } else if (avgMarks < 75) {
    actionRequired = 'Requires additional support in weak subjects. Recommend extra practice.';
  } else if (attendancePercentage < 75) {
    actionRequired = 'Attendance is low. Meet with parents to discuss attendance concerns.';
  }

  return {
    id: `STU${classNum}${section}${String(studentIndex + 1).padStart(3, '0')}`,
    name,
    rollNo: `${classNum}${section}${String(studentIndex + 1).padStart(2, '0')}`,
    class: classNum,
    section,
    dob: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
    bloodGroup: bloodGroups[Math.floor(Math.random() * bloodGroups.length)],
    parentName: `Mr./Mrs. ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
    parentContact: `+91 ${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    feesPending: [0, 500, 1000, 1500, 2000, 0, 0, 0][Math.floor(Math.random() * 8)],
    drawbacks: avgMarks < 60 ? Math.floor(Math.random() * 3) + 1 : 0,
    presentDays,
    absentDays,
    totalDays,
    assignmentsCompleted: generateRandomMarks(8, 12),
    assignmentsTotal: 12,
    subjects: subjectsData,
    actionRequired,
  };
};

// Generate all students
const generateAllStudents = (): Student[] => {
  const allStudents: Student[] = [];
  
  for (let classNum = 1; classNum <= 12; classNum++) {
    for (const section of ['A', 'B'] as const) {
      for (let studentIndex = 0; studentIndex < 20; studentIndex++) {
        allStudents.push(generateStudent(classNum, section, studentIndex));
      }
    }
  }
  
  return allStudents;
};

export const allStudents = generateAllStudents();

// Helper function to get students by class and section
export const getStudentsByClassAndSection = (classNum: number, section: 'A' | 'B'): Student[] => {
  return allStudents.filter(s => s.class === classNum && s.section === section);
};

// Helper function to get all students in a class
export const getStudentsByClass = (classNum: number): Student[] => {
  return allStudents.filter(s => s.class === classNum);
};

// Teacher assignments (each section has one class teacher)
export interface Teacher {
  id: string;
  name: string;
  class: number;
  section: 'A' | 'B';
  subject: string;
  experience: number;
  email: string;
  phone: string;
}

const teacherFirstNames = ['Rajesh', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Suresh', 'Meera', 'Rahul', 'Kavita',
  'Deepak', 'Pooja', 'Arun', 'Divya', 'Sanjay', 'Lakshmi', 'Mohan', 'Radha', 'Kiran', 'Swati',
  'Ramesh', 'Geeta', 'Prakash', 'Seema'];

const teacherLastNames = ['Kumar', 'Sharma', 'Patel', 'Singh', 'Reddy', 'Gupta', 'Iyer', 'Nair', 'Rao', 'Desai',
  'Verma', 'Shah', 'Joshi', 'Menon'];

const generateTeacher = (classNum: number, section: 'A' | 'B'): Teacher => {
  const index = (classNum - 1) * 2 + (section === 'A' ? 0 : 1);
  const firstName = teacherFirstNames[index % teacherFirstNames.length];
  const lastName = teacherLastNames[Math.floor(index / teacherFirstNames.length) % teacherLastNames.length];
  
  return {
    id: `TCH${classNum}${section}`,
    name: `${firstName} ${lastName}`,
    class: classNum,
    section,
    subject: classNum <= 5 ? 'All Subjects' : classNum <= 8 ? 'Mathematics' : 'Science',
    experience: Math.floor(Math.random() * 15) + 5,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@school.edu`,
    phone: `+91 ${Math.floor(Math.random() * 9000000000) + 1000000000}`,
  };
};

// Generate all teachers
const generateAllTeachers = (): Teacher[] => {
  const teachers: Teacher[] = [];
  
  for (let classNum = 1; classNum <= 12; classNum++) {
    for (const section of ['A', 'B'] as const) {
      teachers.push(generateTeacher(classNum, section));
    }
  }
  
  return teachers;
};

export const allTeachers = generateAllTeachers();

// Helper function to get teacher for a specific class and section
export const getTeacherForClassSection = (classNum: number, section: 'A' | 'B'): Teacher | undefined => {
  return allTeachers.find(t => t.class === classNum && t.section === section);
};
