import bcrypt from "bcryptjs";
import { connectDB } from "../config/db.js";
import { User } from "../models/User.js";
import { Teacher } from "../models/Teacher.js";
import { Student } from "../models/Student.js";
import { ClassRoom } from "../models/ClassRoom.js";
import { Recommendation } from "../models/Recommendation.js";
import { ExamReport } from "../models/ExamReport.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { AssignmentProgress } from "../models/AssignmentProgress.js";

const DEFAULT_PASSWORD = "123456";
const ADMIN_USERNAME = "janushiya@admin.in";
const ADMIN_NAME = "Janushiya";

const sections = ["A", "B"];
const classRange = Array.from({ length: 12 }, (_, index) => index + 1);
const allClassSections = classRange.flatMap((classNum) => sections.map((section) => ({ class: classNum, section })));

const studentFirstNames = [
  "Aarav", "Bhavin", "Charan", "Dhruv", "Eshan", "Farhan", "Gautam", "Harish", "Ishan", "Jatin", "Karthik", "Laksh", "Manav", "Nitin", "Omkar", "Pranav", "Qadir", "Raghav", "Samar", "Tanish", "Uday", "Vedant", "Waseem", "Xavier", "Yash", "Zubin",
  "Aditi", "Bhavya", "Charvi", "Deepa", "Esha", "Fatima", "Gauri", "Hema", "Ira", "Juhi", "Kavya", "Lavanya", "Meera", "Naina", "Oviya", "Pallavi", "Qiana", "Ritika", "Shruti", "Tanvi", "Urvi", "Vaishnavi", "Wahida", "Xena", "Yamini", "Zara",
  "Armaan", "Brijesh", "Chinmay", "Devansh", "Ekansh", "Firoz", "Govind", "Hemant", "Indrajit", "Jayesh", "Kunal", "Lokesh", "Madhav", "Nakul", "Onkar", "Parth", "Qasim", "Ritesh", "Siddharth", "Tarun", "Utkarsh", "Varun", "Wasif", "Xubin", "Yuvraj", "Zeeshan"
];

const studentLastNames = [
  "Agarwal", "Bansal", "Chopra", "Desai", "Easwaran", "Fernandes", "Ghosh", "Hegde", "Iyer", "Jain",
  "Khan", "Lal", "Mehta", "Nair", "Oberoi", "Patel", "Qureshi", "Rao", "Sharma", "Trivedi",
  "Upadhyay", "Varma", "Wadia", "Xalxo", "Yadav", "Zaidi", "Bhat", "Das", "Gupta", "Joshi",
  "Kulkarni", "Menon", "Naidu", "Pandey", "Reddy", "Saxena", "Thakur", "Usmani", "Venkatesh", "Wagle"
];

const teacherFirstNames = [
  "Rajesh", "Priya", "Amit", "Sneha", "Vikram", "Anjali", "Suresh", "Meera", "Rahul", "Kavita",
  "Deepak", "Pooja", "Arun", "Divya", "Sanjay", "Lakshmi", "Mohan", "Radha", "Kiran", "Swati",
  "Ramesh", "Geeta", "Prakash", "Seema"
];

const teacherLastNames = [
  "Kumar", "Sharma", "Patel", "Singh", "Reddy", "Gupta", "Iyer", "Nair", "Rao", "Desai",
  "Verma", "Shah", "Joshi", "Menon"
];

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const toEmailLocalPart = (name) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");

const getStudentCountForClassSection = (classNum, sectionIndex) => 50 + ((classNum + sectionIndex) % 11); // 50-60
const buildUniqueStudentName = (seedIndex, usedNames) => {
  let cursor = seedIndex;
  for (let attempts = 0; attempts < 5000; attempts += 1) {
    const firstName = studentFirstNames[cursor % studentFirstNames.length];
    const lastName = studentLastNames[(cursor * 7 + Math.floor(cursor / studentFirstNames.length)) % studentLastNames.length];
    const name = `${firstName} ${lastName}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
    cursor += 1;
  }
  return `Student ${seedIndex}`;
};

const getSubjectsForClass = (classNum) => {
  if (classNum <= 5) return ["English", "Mathematics", "Science", "Social Studies", "Hindi"];
  if (classNum <= 8) return ["English", "Mathematics", "Science", "Social Studies", "Hindi", "Computer"];
  return ["English", "Mathematics", "Physics", "Chemistry", "Biology", "Computer Science"];
};

const facultySubjectPool = ["English", "Mathematics", "Science", "Social Studies", "Hindi"];
const getFacultySubject = (teacherIndex) => facultySubjectPool[teacherIndex % facultySubjectPool.length];

const buildStudents = () => {
  const students = [];
  const users = [];
  const usedNames = new Set();

  classRange.forEach((classNum) => {
    sections.forEach((section, sectionIndex) => {
      const studentCount = getStudentCountForClassSection(classNum, sectionIndex);
      const sectionRows = [];
      for (let studentIndex = 0; studentIndex < studentCount; studentIndex += 1) {
        const globalIndex = (classNum - 1) * sections.length * 60 + (sectionIndex * 60) + studentIndex;
        const name = buildUniqueStudentName(globalIndex, usedNames);
        sectionRows.push({ globalIndex, name });
      }

      sectionRows.sort((a, b) => a.name.localeCompare(b.name));

      sectionRows.forEach((row, sortedIndex) => {
        const { globalIndex, name } = row;
        const studentId = `STU${classNum}${section}${String(sortedIndex + 1).padStart(3, "0")}`;
        const rollNo = `${classNum}${section}${String(sortedIndex + 1).padStart(2, "0")}`;
        const email = `${toEmailLocalPart(name)}.${classNum}${section}${String(sortedIndex + 1).padStart(2, "0")}@student.in`;

        const subjects = getSubjectsForClass(classNum).map((subjectName, subjectIdx) => ({
          name: subjectName,
          marks: 55 + ((globalIndex + subjectIdx * 7) % 41),
          totalMarks: 100
        }));

        const presentDays = 150 + (globalIndex % 46);
        const totalDays = 200;
        const averageMarks = subjects.reduce((sum, subject) => sum + subject.marks, 0) / subjects.length;

        let actionRequired = "Keep up the good work!";
        if (averageMarks < 60) actionRequired = "Needs immediate attention in academics.";
        else if (averageMarks < 75) actionRequired = "Requires additional support in weak subjects.";

        students.push({
          studentId,
          name,
          class: classNum,
          section,
          rollNo,
          dob: `${String((globalIndex % 28) + 1).padStart(2, "0")}/${String((globalIndex % 12) + 1).padStart(2, "0")}/${2024 - (16 - classNum)}`,
          bloodGroup: bloodGroups[globalIndex % bloodGroups.length],
          parentName: `Parent of ${name}`,
          parentContact: `+91${String(7000000000 + globalIndex).padStart(10, "0")}`,
          feesPending: [0, 500, 1000, 1500][globalIndex % 4],
          drawbacks: averageMarks < 60 ? 2 : averageMarks < 75 ? 1 : 0,
          presentDays,
          totalDays,
          assignmentsCompleted: 8 + (globalIndex % 5),
          assignmentsTotal: 12,
          actionRequired,
          subjects
        });

        users.push({
          name,
          username: email,
          email,
          password: DEFAULT_PASSWORD,
          role: "Student",
          studentId,
          teacherId: null,
          isActive: true
        });
      });
    });
  });

  return { students, users };
};

const buildTeachers = () => {
  const teachers = [];
  const users = [];
  const classrooms = [];

  classRange.forEach((classNum) => {
    sections.forEach((section, sectionIndex) => {
      const teacherIndex = (classNum - 1) * sections.length + sectionIndex;
      const firstName = teacherFirstNames[teacherIndex % teacherFirstNames.length];
      const lastName = teacherLastNames[Math.floor(teacherIndex / teacherFirstNames.length) % teacherLastNames.length];
      const name = `${firstName} ${lastName}`;

      const teacherId = `TCH${classNum}${section}`;
      const email = `${toEmailLocalPart(name)}@teacher.in`;
      const subject = getFacultySubject(teacherIndex);

      const assignedCount = 3;
      const isPrimaryTeacher = classNum >= 1 && classNum <= 5;
      const isSeniorTeacher = classNum >= 10 && classNum <= 12;
      const eligibleIndices = allClassSections
        .map((item, idx) => ({ ...item, idx }))
        .filter((item) => {
          if (isPrimaryTeacher) return item.class >= 1 && item.class <= 5;
          if (isSeniorTeacher) return item.class >= 10 && item.class <= 12;
          return item.class >= 6; // class 6-9 teachers can map only to non-primary classes
        })
        .map((item) => item.idx);

      const assignedIndexSet = new Set([teacherIndex]);
      const start = (teacherIndex * 5) % eligibleIndices.length;
      for (let offset = 0; assignedIndexSet.size < assignedCount && offset < eligibleIndices.length * 2; offset += 1) {
        assignedIndexSet.add(eligibleIndices[(start + offset) % eligibleIndices.length]);
      }

      const assignedClasses = [...assignedIndexSet].slice(0, assignedCount).map((idx) => allClassSections[idx]);

      teachers.push({
        teacherId,
        name,
        subject,
        email,
        phone: `+91${String(9000000000 + teacherIndex).padStart(10, "0")}`,
        experience: 5 + (teacherIndex % 15),
        homeClass: classNum,
        homeSection: section,
        assignedClasses
      });

      users.push({
        name,
        username: email,
        email,
        password: DEFAULT_PASSWORD,
        role: "Faculty",
        teacherId,
        studentId: null,
        isActive: true
      });

      classrooms.push({
        class: classNum,
        section,
        classTeacherId: teacherId,
        subjects: getSubjectsForClass(classNum)
      });
    });
  });

  return { teachers, users, classrooms };
};

const seed = async () => {
  await connectDB();

  const { students, users: studentUsers } = buildStudents();
  const { teachers, users: teacherUsers, classrooms } = buildTeachers();

  const adminUser = {
    name: ADMIN_NAME,
    username: ADMIN_USERNAME,
    email: ADMIN_USERNAME,
    password: DEFAULT_PASSWORD,
    role: "Admin",
    studentId: null,
    teacherId: null,
    isActive: true
  };

  await Promise.all([
    Student.deleteMany({}),
    Teacher.deleteMany({}),
    ClassRoom.deleteMany({}),
    Recommendation.deleteMany({}),
    ExamReport.deleteMany({}),
    ActivityLog.deleteMany({}),
    AssignmentProgress.deleteMany({}),
    User.deleteMany({})
  ]);

  await Teacher.insertMany(teachers, { ordered: true });
  await Student.insertMany(students, { ordered: true });
  await ClassRoom.insertMany(classrooms, { ordered: true });

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const allUsers = [adminUser, ...teacherUsers, ...studentUsers].map((user) => ({
    ...user,
    password: hashedPassword
  }));

  await User.insertMany(allUsers, { ordered: true });

  console.log("School authentication seed complete.");
  console.log(`Teachers created: ${teachers.length}`);
  console.log(`Students created: ${students.length}`);
  console.log(`Classes created: ${classrooms.length}`);
  console.log(`Users created: ${teacherUsers.length + studentUsers.length + 1}`);
  console.log(`Password for all users: ${DEFAULT_PASSWORD}`);
  console.log(`Admin login: ${ADMIN_USERNAME}`);

  process.exit(0);
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
