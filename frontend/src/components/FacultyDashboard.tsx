import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Save, Eye, X, Calendar, DollarSign, Phone, User, BarChart3, CheckCircle, XCircle, Download } from 'lucide-react';
import { Navigation } from './Navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiRequest, getSessionAuth } from '../api/client';
import { toast } from 'sonner@2.0.3';
import { triggerBase64Download, type DownloadPayload } from '../api/download';

type Subject = { name: string; marks: number; totalMarks: number };
type StudentData = {
  _id: string;
  studentId: string;
  name: string;
  rollNo: string;
  class: number;
  section: 'A' | 'B';
  dob?: string;
  bloodGroup?: string;
  parentName?: string;
  parentContact?: string;
  feesPending: number;
  drawbacks: number;
  presentDays: number;
  totalDays: number;
  assignmentsCompleted: number;
  assignmentsTotal: number;
  actionRequired: string;
  subjects: Subject[];
};

type TeacherOverview = {
  teacher: {
    teacherId?: string;
    name: string;
    subject: string;
    email?: string;
    phone?: string;
    experience?: number;
    homeClass?: number;
    homeSection?: 'A' | 'B';
  } | null;
};

type AssignedClass = { class: number; section: 'A' | 'B' };
type MyClassesPayload = { teacher: TeacherOverview['teacher']; assignedClasses: AssignedClass[] };
type ExamWindow = {
  activeExam: string;
  markEntryDeadlineAt?: string;
  isMarkEntryOpen: boolean;
};

const formatDateTimeFixed = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export function FacultyDashboard() {
  const navigate = useNavigate();
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<'A' | 'B' | null>(null);
  const [selectedExam, setSelectedExam] = useState('Exam 1');
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [students, setStudents] = useState<StudentData[]>([]);
  const [teacher, setTeacher] = useState<TeacherOverview['teacher']>(null);
  const [assignedClasses, setAssignedClasses] = useState<AssignedClass[]>([]);
  const [examWindow, setExamWindow] = useState<ExamWindow | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const deferredStudentSearchTerm = useDeferredValue(studentSearchTerm);

  const availableClasses = useMemo(() => [...new Set(assignedClasses.map((item) => item.class))].sort((a, b) => a - b), [assignedClasses]);
  const availableSections = useMemo(() => {
    if (!selectedClass) return [];
    return assignedClasses.filter((item) => item.class === selectedClass).map((item) => item.section).sort();
  }, [assignedClasses, selectedClass]);

  const loadMyClasses = async () => {
    const { token } = getSessionAuth();
    if (!token) {
      navigate('/');
      return;
    }

    try {
      const data = await apiRequest<MyClassesPayload>('/faculty/my-classes', { token });
      const sorted = [...data.assignedClasses].sort((a, b) => (a.class === b.class ? a.section.localeCompare(b.section) : a.class - b.class));
      setAssignedClasses(sorted);
      setTeacher(data.teacher);

      if (!sorted.length) {
        toast.error('No mapped class found for this faculty account');
        return;
      }

      setSelectedClass(sorted[0].class);
      setSelectedSection(sorted[0].section);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load faculty mappings');
    }
  };

  const loadData = async () => {
    const { token } = getSessionAuth();
    if (!token) {
      navigate('/');
      return;
    }
    if (!selectedClass || !selectedSection) return;

    try {
      const studentsData = await apiRequest<StudentData[]>(`/faculty/students?class=${selectedClass}&section=${selectedSection}`, { token });
      setStudents(studentsData);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load faculty data');
    }
  };

  const loadExamWindow = async () => {
    const { token } = getSessionAuth();
    if (!token) return;
    try {
      const payload = await apiRequest<ExamWindow>('/faculty/exam-window', { token });
      setExamWindow(payload);
      if (payload.activeExam) setSelectedExam(payload.activeExam);
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    loadMyClasses();
    loadExamWindow();
  }, []);

  useEffect(() => {
    if (!selectedClass || !selectedSection) return;
    loadData();
  }, [selectedClass, selectedSection]);

  useEffect(() => {
    if (!selectedClass || !selectedSection) return;
    if (!availableSections.includes(selectedSection)) setSelectedSection(availableSections[0] || null);
  }, [selectedClass, selectedSection, availableSections]);

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    navigate('/');
  };

  const handleSaveMarks = async () => {
    const { token, user } = getSessionAuth();
    if (!token || !teacher?.subject) return;
    if (examWindow && !examWindow.isMarkEntryOpen) {
      toast.error('Mark entry window is closed. Request extension in Class Management.');
      return;
    }

    try {
      await Promise.all(
        students.map((s) => {
          const existing = s.subjects.find((subject) => subject.name === teacher.subject);
          return apiRequest(`/faculty/students/${s.studentId}/marks`, {
            method: 'PUT',
            token,
            body: {
              exam: selectedExam,
              subject: teacher.subject,
              marks: existing?.marks ?? 0,
              totalMarks: existing?.totalMarks ?? 100,
              actorName: user?.name || user?.username || 'Faculty'
            }
          });
        })
      );

      toast.success(`Marks for ${teacher.subject} in Class ${selectedClass}-${selectedSection} (${selectedExam}) saved`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save marks');
    }
  };

  const handleViewDetails = async (studentId: string) => {
    const { token } = getSessionAuth();
    if (!token) return;

    try {
      setIsDetailsLoading(true);
      const student = await apiRequest<StudentData>(`/faculty/students/${studentId}`, { token });
      setSelectedStudent(student);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load student details');
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const handleDownloadReportPDF = async (student: StudentData) => {
    const { token } = getSessionAuth();
    if (!token) return;

    try {
      const data = await apiRequest<DownloadPayload>(`/reports/download?format=pdf&scope=student:${student.studentId}`, { token });
      triggerBase64Download(data);
      toast.success('Report downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to request report');
    }
  };

  const studentCount = students.length;
  const filteredStudents = useMemo(() => {
    const q = deferredStudentSearchTerm.trim().toLowerCase();
    if (!q) return students;
    return students.filter((student) =>
      student.name.toLowerCase().includes(q)
      || (student.rollNo || '').toLowerCase().includes(q)
      || student.studentId.toLowerCase().includes(q)
    );
  }, [students, deferredStudentSearchTerm]);
  const chartData = useMemo(() => selectedStudent?.subjects || [], [selectedStudent]);
  const mappedClassLabel = assignedClasses.map((item) => `${item.class}-${item.section}`).join(', ');

  return (
    <div className="min-h-screen bg-gray-50 animate-fadeIn">
      <Navigation role="Faculty" onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto p-6 animate-slideUp">
        {teacher && (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-6 mb-6 text-white card-hover">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center flex-shrink-0"><User className="w-10 h-10 text-indigo-600" /></div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-1">{teacher.name}</h2>
                <p className="text-indigo-100 mb-3">Primary Class Teacher: Class {teacher.homeClass ?? '-'} - Section {teacher.homeSection ?? '-'} | Mapped: {mappedClassLabel}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4" /><span>{teacher.phone || '-'}</span></div>
                  <div className="flex items-center gap-2"><span className="text-indigo-200">Email:</span><span>{teacher.email || '-'}</span></div>
                  <div className="flex items-center gap-2"><span className="text-indigo-200">Experience:</span><span>{teacher.experience || 0} Years</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Faculty Dashboard</h1>
          <p className="text-gray-600">Faculty enter marks and attendance through this interface.</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 card-hover">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Select Class Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="class" className="block text-sm font-medium text-gray-700 mb-2">Class</label>
              <select id="class" value={selectedClass ?? ''} onChange={(e) => setSelectedClass(e.target.value ? Number(e.target.value) : null)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white">
                {availableClasses.map((classNum) => (<option key={classNum} value={classNum}>Class {classNum}</option>))}
              </select>
            </div>
            <div>
              <label htmlFor="section" className="block text-sm font-medium text-gray-700 mb-2">Section</label>
              <select id="section" value={selectedSection ?? ''} onChange={(e) => setSelectedSection(e.target.value as 'A' | 'B')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white">
                {availableSections.map((section) => (<option key={section} value={section}>Section {section}</option>))}
              </select>
            </div>
            <div>
              <label htmlFor="exam" className="block text-sm font-medium text-gray-700 mb-2">Exam</label>
              <select id="exam" value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)} disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none bg-gray-50 text-gray-700"><option value={selectedExam}>{selectedExam}</option></select>
            </div>
          </div>
          <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200"><p className="text-sm text-indigo-900"><strong>Selected:</strong> Class {selectedClass}-{selectedSection} - {selectedExam}<span className="ml-2 text-indigo-600">({studentCount} students)</span></p><p className={`text-xs mt-1 ${examWindow?.isMarkEntryOpen ? 'text-emerald-700' : 'text-red-700'}`}>Mark Entry: {examWindow?.isMarkEntryOpen ? 'Open' : 'Closed'} | Deadline: {formatDateTimeFixed(examWindow?.markEntryDeadlineAt)}</p></div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 card-hover overflow-hidden">
          <div className="p-6 border-b border-gray-200"><h2 className="text-xl font-bold text-gray-900">Student List</h2><p className="text-sm text-gray-600 mt-1">Click "View Details" to see comprehensive student information</p></div>
          <div className="px-6 pt-4">
            <input
              type="text"
              value={studentSearchTerm}
              onChange={(e) => setStudentSearchTerm(e.target.value)}
              placeholder="Search by student name, roll no, or student id..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="dashboard-table-wrap">
            <table className="dashboard-table w-full">
              <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll No</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th><th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Attendance</th><th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Avg Marks</th><th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-200">
                {filteredStudents.map((student) => {
                  const avgMarks = student.subjects.length ? student.subjects.reduce((sum, s) => sum + s.marks, 0) / student.subjects.length : 0;
                  const attendancePercentage = student.totalDays ? (student.presentDays / student.totalDays) * 100 : 0;
                  const status = avgMarks >= 75 ? 'Good' : avgMarks >= 60 ? 'Average' : 'Weak';
                  return (
                    <tr key={student._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{student.rollNo || student.studentId}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{student.name}</td>
                      <td className="px-6 py-4 text-center text-sm"><span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${attendancePercentage >= 75 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{attendancePercentage.toFixed(0)}%</span></td>
                      <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">{avgMarks.toFixed(1)}</td>
                      <td className="px-6 py-4 text-center"><span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${status === 'Good' ? 'bg-green-100 text-green-700' : status === 'Average' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{status}</span></td>
                      <td className="px-6 py-4 text-center"><button onClick={() => handleViewDetails(student.studentId)} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-300 text-sm font-medium glow-button"><Eye className="w-4 h-4" />View Details</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-6 bg-gray-50 border-t border-gray-200"><button onClick={handleSaveMarks} className="crud-btn crud-save flex items-center gap-2 py-3"><Save className="w-4 h-4" />Save {teacher?.subject || 'Subject'} Data</button></div>
        </div>
      </div>

      {isDetailsLoading && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-white px-5 py-3 rounded-lg shadow">Loading student details...</div>
        </div>
      )}

      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn" onClick={() => setSelectedStudent(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto animate-slideUp" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-2xl sticky top-0 z-10"><div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold mb-1">{selectedStudent.name}</h2><p className="text-indigo-100">Class {selectedStudent.class} - Section {selectedStudent.section} | Roll No: {selectedStudent.rollNo || selectedStudent.studentId}</p></div><button onClick={() => setSelectedStudent(null)} className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"><X className="w-6 h-6" /></button></div></div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-xl"><p className="text-sm text-gray-600 mb-1">Date of Birth</p><p className="font-medium text-gray-900">{selectedStudent.dob || '-'}</p></div>
                <div className="bg-gray-50 p-4 rounded-xl"><p className="text-sm text-gray-600 mb-1">Blood Group</p><p className="font-medium text-gray-900">{selectedStudent.bloodGroup || '-'}</p></div>
                <div className="bg-gray-50 p-4 rounded-xl"><p className="text-sm text-gray-600 mb-1">Student ID</p><p className="font-medium text-gray-900">{selectedStudent.studentId}</p></div>
                <div className="bg-gray-50 p-4 rounded-xl"><p className="text-sm text-gray-600 mb-1">Drawbacks</p><p className="font-medium text-red-600">{selectedStudent.drawbacks}</p></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200"><div className="flex items-center gap-2 mb-2"><BarChart3 className="w-5 h-5 text-blue-600" /><p className="text-sm text-blue-600">Avg Marks</p></div><p className="text-2xl font-bold text-blue-700">{(selectedStudent.subjects.reduce((sum, s) => sum + s.marks, 0) / (selectedStudent.subjects.length || 1)).toFixed(1)}%</p></div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-200"><div className="flex items-center gap-2 mb-2"><Calendar className="w-5 h-5 text-green-600" /><p className="text-sm text-green-600">Attendance</p></div><p className="text-2xl font-bold text-green-700">{((selectedStudent.presentDays / (selectedStudent.totalDays || 1)) * 100).toFixed(0)}%</p><p className="text-xs text-green-600 mt-1">{selectedStudent.presentDays}/{selectedStudent.totalDays} days</p></div>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200"><div className="flex items-center gap-2 mb-2"><DollarSign className="w-5 h-5 text-amber-600" /><p className="text-sm text-amber-600">Fees Pending</p></div><p className="text-2xl font-bold text-amber-700">Rs {selectedStudent.feesPending}</p></div>
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-200"><div className="flex items-center gap-2 mb-2"><CheckCircle className="w-5 h-5 text-purple-600" /><p className="text-sm text-purple-600">Assignments</p></div><p className="text-2xl font-bold text-purple-700">{selectedStudent.assignmentsCompleted}/{selectedStudent.assignmentsTotal}</p></div>
              </div>

              <div className="mb-6"><h3 className="text-lg font-bold text-gray-900 mb-3">Subject-wise Performance</h3><div className="bg-gray-50 p-4 rounded-xl border border-gray-200"><ResponsiveContainer width="100%" height={250}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} /><Tooltip /><Legend /><Bar dataKey="marks" fill="#4f46e5" name="Marks" /></BarChart></ResponsiveContainer></div></div>
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Subject-wise Marks Table</h3>
                <div className="dashboard-table-wrap">
                  <table className="dashboard-table w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Marks</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Percentage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(selectedStudent.subjects || []).map((subject) => {
                        const percent = subject.totalMarks ? (subject.marks / subject.totalMarks) * 100 : 0;
                        return (
                          <tr key={`${selectedStudent.studentId}-${subject.name}`}>
                            <td className="px-4 py-3 text-sm text-gray-800">{subject.name}</td>
                            <td className="px-4 py-3 text-sm text-center font-medium text-gray-900">{subject.marks}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-700">{subject.totalMarks}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-700">{percent.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white border border-gray-200 rounded-xl p-4"><h3 className="text-lg font-bold text-gray-900 mb-3">Attendance Details</h3><div className="space-y-3"><div className="flex items-center justify-between p-3 bg-green-50 rounded-lg"><span className="text-sm font-medium text-green-900">Present Days</span><span className="text-lg font-bold text-green-700">{selectedStudent.presentDays}</span></div><div className="flex items-center justify-between p-3 bg-red-50 rounded-lg"><span className="text-sm font-medium text-red-900">Absent Days</span><span className="text-lg font-bold text-red-700">{Math.max(0, selectedStudent.totalDays - selectedStudent.presentDays)}</span></div><div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"><span className="text-sm font-medium text-blue-900">Total Days</span><span className="text-lg font-bold text-blue-700">{selectedStudent.totalDays}</span></div></div></div>
                <div className="bg-white border border-gray-200 rounded-xl p-4"><h3 className="text-lg font-bold text-gray-900 mb-3">Assignment Status</h3><div className="space-y-3"><div className="flex items-center justify-between p-3 bg-green-50 rounded-lg"><div className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600" /><span className="text-sm font-medium text-green-900">Completed</span></div><span className="text-lg font-bold text-green-700">{selectedStudent.assignmentsCompleted}</span></div><div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg"><div className="flex items-center gap-2"><XCircle className="w-5 h-5 text-amber-600" /><span className="text-sm font-medium text-amber-900">Not Completed</span></div><span className="text-lg font-bold text-amber-700">{selectedStudent.assignmentsTotal - selectedStudent.assignmentsCompleted}</span></div></div></div>
              </div>

              <div className="mb-6"><h3 className="text-lg font-bold text-gray-900 mb-3">Parent/Guardian Information</h3><div className="bg-gray-50 p-4 rounded-xl border border-gray-200"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="flex items-start gap-3"><User className="w-5 h-5 text-gray-600 mt-1" /><div><p className="text-sm text-gray-600">Parent/Guardian Name</p><p className="font-medium text-gray-900">{selectedStudent.parentName || '-'}</p></div></div><div className="flex items-start gap-3"><Phone className="w-5 h-5 text-gray-600 mt-1" /><div><p className="text-sm text-gray-600">Contact Number</p><p className="font-medium text-gray-900">{selectedStudent.parentContact || '-'}</p></div></div></div></div></div>

              <div className="p-4 rounded-xl border bg-amber-50 border-amber-200 mb-6"><h3 className="font-bold mb-2 text-amber-900">Action Required</h3><p className="text-sm text-amber-700">{selectedStudent.actionRequired || 'Keep up the good work!'}</p></div>

              <div className="flex gap-3 justify-end border-t border-gray-200 pt-4"><button onClick={() => setSelectedStudent(null)} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-300 font-medium text-gray-700 glow-button-subtle">Close</button><button onClick={() => handleDownloadReportPDF(selectedStudent)} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-300 font-medium glow-button"><Download className="w-4 h-4" />Download Report Card</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
