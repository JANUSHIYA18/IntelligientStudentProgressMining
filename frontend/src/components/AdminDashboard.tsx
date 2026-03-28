import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, TrendingUp, BarChart3, Activity, GraduationCap, BookOpen, UserPlus, Settings, X, Trash2, Plus, Clock3 } from 'lucide-react';
import { Navigation } from './Navigation';
import { toast } from 'sonner@2.0.3';
import { apiRequest } from '../api/client';

type Dashboard = { totalStudents: number; totalTeachers: number; totalClasses: number; averagePerformance: number };
type Performance = { name: string; value: number };
type ClassPerformance = { class: string; good: number; average: number; weak: number };
type ActivityItem = { _id: string; actorName: string; action: string; type: string; details?: string; createdAt: string };
type StudentItem = { _id: string; studentId: string; name: string; class: number; section: string; rollNo?: string };
type Teacher = { _id: string; teacherId: string; name: string; subject: string; email?: string; phone?: string; assignedClasses: { class: number; section: string }[] };
type ClassRoom = { _id: string; class: number; section: string; classTeacherId?: string; subjects: string[] };
type SystemSettings = {
  schoolName: string;
  academicYear: string;
  attendanceThreshold: number;
  passThreshold: number;
  reportTheme: 'classic' | 'modern' | 'minimal';
  supportEmail: string;
  googleSignInEnabled: boolean;
  activeExam: string;
  markEntryStartsAt?: string;
  markEntryDeadlineAt?: string;
};
type ExtensionRequest = {
  _id: string;
  exam: string;
  teacherId: string;
  teacherName: string;
  requestedUntil: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

const COLORS = { Good: '#10b981', Average: '#f59e0b', Weak: '#ef4444' };
const MODAL_PAGE_SIZE = 40;
const parseClassInput = (value: string): number | null => {
  const match = String(value || '').match(/\d+/);
  if (!match) return null;
  const classNum = Number(match[0]);
  if (!Number.isInteger(classNum) || classNum < 1 || classNum > 12) return null;
  return classNum;
};

const toDateTimeLocalValue = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toIsoFromDateTimeLocal = (value: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
};

export function AdminDashboard() {
  const navigate = useNavigate();
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [showManageStudentsModal, setShowManageStudentsModal] = useState(false);
  const [showManageTeachersModal, setShowManageTeachersModal] = useState(false);
  const [showManageClassesModal, setShowManageClassesModal] = useState(false);
  const [showSystemSettingsModal, setShowSystemSettingsModal] = useState(false);
  const [showActivityLogModal, setShowActivityLogModal] = useState(false);
  const [showExtensionRequestsModal, setShowExtensionRequestsModal] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [studentPage, setStudentPage] = useState(1);
  const [teacherPage, setTeacherPage] = useState(1);
  const deferredStudentSearch = useDeferredValue(studentSearch);
  const deferredTeacherSearch = useDeferredValue(teacherSearch);

  const [dashboard, setDashboard] = useState<Dashboard>({ totalStudents: 0, totalTeachers: 0, totalClasses: 0, averagePerformance: 0 });
  const [performanceData, setPerformanceData] = useState<Performance[]>([]);
  const [classPerformanceData, setClassPerformanceData] = useState<ClassPerformance[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    schoolName: '',
    academicYear: '',
    attendanceThreshold: 75,
    passThreshold: 40,
    reportTheme: 'classic',
    supportEmail: '',
    googleSignInEnabled: true,
    activeExam: 'Exam 1',
    markEntryStartsAt: '',
    markEntryDeadlineAt: ''
  });
  const [extensionRequests, setExtensionRequests] = useState<ExtensionRequest[]>([]);

  const [newStudent, setNewStudent] = useState({ name: '', class: '', section: 'A', rollNumber: '' });
  const [newTeacher, setNewTeacher] = useState({ teacherId: '', name: '', subject: '', email: '', phone: '', class: '', section: 'A' });

  const token = sessionStorage.getItem('token');

  const loadData = async () => {
    if (!token) {
      navigate('/');
      return;
    }

    try {
      const [d, perf, clsPerf, acts, settings, requests] = await Promise.all([
        apiRequest<Dashboard>('/admin/dashboard', { token }),
        apiRequest<Performance[]>('/admin/performance-distribution', { token }),
        apiRequest<ClassPerformance[]>('/admin/class-performance', { token }),
        apiRequest<ActivityItem[]>('/admin/activities?limit=20', { token }),
        apiRequest<SystemSettings>('/admin/settings', { token }),
        apiRequest<ExtensionRequest[]>('/admin/exam-extension-requests?status=pending', { token })
      ]);
      setDashboard(d);
      setPerformanceData(perf);
      setClassPerformanceData(clsPerf);
      setRecentActivities(acts);
      setSystemSettings(settings);
      setExtensionRequests(requests);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load admin data');
    }
  };

  const loadStudents = async () => {
    if (!token) return;
    try {
      const rows = await apiRequest<StudentItem[]>('/admin/students', { token });
      setStudents(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load students');
    }
  };

  const loadTeachers = async () => {
    if (!token) return;
    try {
      const rows = await apiRequest<Teacher[]>('/admin/teachers', { token });
      setTeachers(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load teachers');
    }
  };

  const loadClasses = async () => {
    if (!token) return;
    try {
      const rows = await apiRequest<ClassRoom[]>('/admin/classes', { token });
      setClasses(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load classes');
    }
  };

  const loadExtensionRequests = async () => {
    if (!token) return;
    try {
      const rows = await apiRequest<ExtensionRequest[]>('/admin/exam-extension-requests?status=pending', { token });
      setExtensionRequests(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load extension requests');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showManageStudentsModal && !students.length) loadStudents();
  }, [showManageStudentsModal]);

  useEffect(() => {
    if (showManageTeachersModal && !teachers.length) loadTeachers();
  }, [showManageTeachersModal]);

  useEffect(() => {
    if (showManageClassesModal && !classes.length) loadClasses();
  }, [showManageClassesModal]);

  useEffect(() => {
    if (showExtensionRequestsModal) loadExtensionRequests();
  }, [showExtensionRequestsModal]);

  useEffect(() => {
    setStudentPage(1);
  }, [deferredStudentSearch, showManageStudentsModal]);

  useEffect(() => {
    setTeacherPage(1);
  }, [deferredTeacherSearch, showManageTeachersModal]);

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    navigate('/');
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'update': return <BarChart3 className="w-4 h-4 text-blue-600" />;
      case 'attendance': return <Users className="w-4 h-4 text-green-600" />;
      case 'create': return <UserPlus className="w-4 h-4 text-purple-600" />;
      case 'report': return <BarChart3 className="w-4 h-4 text-amber-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.class || !newStudent.section) {
      toast.error('Please fill in all required fields');
      return;
    }

    const parsedClass = parseClassInput(newStudent.class);
    if (!parsedClass) {
      toast.error('Class must be between 1 and 12');
      return;
    }

    try {
      await apiRequest('/admin/students', {
        method: 'POST',
        token,
        body: {
          studentId: `STU${parsedClass}${newStudent.section}${String(Date.now()).slice(-3)}`,
          name: newStudent.name.trim(),
          class: parsedClass,
          section: newStudent.section,
          rollNo: newStudent.rollNumber.trim() || `${parsedClass}${newStudent.section}`
        }
      });

      toast.success(`Student ${newStudent.name} added successfully`);
      setShowAddStudentModal(false);
      setNewStudent({ name: '', class: '', section: 'A', rollNumber: '' });
      await loadStudents();
      loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add student');
    }
  };

  const handleAddTeacher = async () => {
    if (!newTeacher.teacherId || !newTeacher.name || !newTeacher.subject) {
      toast.error('teacherId, name, subject are required');
      return;
    }

    const parsedAssignedClass = newTeacher.class ? parseClassInput(newTeacher.class) : null;
    if (newTeacher.class && !parsedAssignedClass) {
      toast.error('Assigned class must be between 1 and 12');
      return;
    }

    try {
      await apiRequest('/admin/teachers', {
        method: 'POST',
        token,
        body: {
          teacherId: newTeacher.teacherId.trim(),
          name: newTeacher.name.trim(),
          subject: newTeacher.subject.trim(),
          email: newTeacher.email.trim(),
          phone: newTeacher.phone.trim(),
          assignedClasses: parsedAssignedClass ? [{ class: parsedAssignedClass, section: newTeacher.section }] : []
        }
      });

      toast.success(`Teacher ${newTeacher.name} added successfully`);
      setShowAddTeacherModal(false);
      setNewTeacher({ teacherId: '', name: '', subject: '', email: '', phone: '', class: '', section: 'A' });
      await loadTeachers();
      loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add teacher');
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    try {
      await apiRequest(`/admin/teachers/${id}`, { method: 'DELETE', token });
      toast.success('Teacher deleted');
      await loadTeachers();
      loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete teacher');
    }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      await apiRequest(`/admin/students/${id}`, { method: 'DELETE', token });
      toast.success('Student deleted');
      await loadStudents();
      loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete student');
    }
  };

  const handleSaveSystemSettings = async () => {
    try {
      const settingsPayload = {
        ...systemSettings,
        markEntryStartsAt: systemSettings.markEntryStartsAt || undefined,
        markEntryDeadlineAt: systemSettings.markEntryDeadlineAt || undefined
      };
      const updated = await apiRequest<SystemSettings>('/admin/settings', {
        method: 'PUT',
        token,
        body: settingsPayload
      });
      setSystemSettings(updated);
      toast.success('System settings updated');
      setShowSystemSettingsModal(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update settings');
    }
  };

  const handleReviewExtensionRequest = async (request: ExtensionRequest, action: 'approve' | 'reject') => {
    try {
      const body: { action: 'approve' | 'reject'; extendHours?: number } = { action };
      if (action === 'approve') {
        const hoursInput = window.prompt(`Approve extension for ${request.teacherName} (${request.exam}). Enter extend hours:`, '24');
        if (hoursInput === null) return;
        const extendHours = Number(hoursInput);
        if (Number.isNaN(extendHours) || extendHours <= 0) {
          toast.error('Enter valid extend hours');
          return;
        }
        body.extendHours = extendHours;
      }
      await apiRequest(`/admin/exam-extension-requests/${request._id}`, {
        method: 'PUT',
        token,
        body
      });
      toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'}`);
      loadExtensionRequests();
      loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to review extension request');
    }
  };

  const normalizedPerf = useMemo(
    () => performanceData.map((p) => ({ ...p, color: COLORS[p.name as keyof typeof COLORS] || '#94a3b8' })),
    [performanceData]
  );

  const filteredStudents = useMemo(() => {
    const q = deferredStudentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((student) =>
      student.name.toLowerCase().includes(q)
      || student.studentId.toLowerCase().includes(q)
      || `${student.class}`.includes(q)
      || student.section.toLowerCase().includes(q)
      || (student.rollNo || '').toLowerCase().includes(q)
    );
  }, [students, deferredStudentSearch]);

  const filteredTeachers = useMemo(() => {
    const q = deferredTeacherSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((teacher) =>
      teacher.name.toLowerCase().includes(q)
      || teacher.teacherId.toLowerCase().includes(q)
      || teacher.subject.toLowerCase().includes(q)
      || (teacher.email || '').toLowerCase().includes(q)
      || (teacher.phone || '').toLowerCase().includes(q)
    );
  }, [teachers, deferredTeacherSearch]);

  const totalStudentPages = Math.max(1, Math.ceil(filteredStudents.length / MODAL_PAGE_SIZE));
  const totalTeacherPages = Math.max(1, Math.ceil(filteredTeachers.length / MODAL_PAGE_SIZE));

  const visibleStudents = useMemo(() => {
    const start = (studentPage - 1) * MODAL_PAGE_SIZE;
    return filteredStudents.slice(start, start + MODAL_PAGE_SIZE);
  }, [filteredStudents, studentPage]);

  const visibleTeachers = useMemo(() => {
    const start = (teacherPage - 1) * MODAL_PAGE_SIZE;
    return filteredTeachers.slice(start, start + MODAL_PAGE_SIZE);
  }, [filteredTeachers, teacherPage]);

  return (
    <div className="min-h-screen bg-gray-50 animate-fadeIn">
      <Navigation role="Admin" onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto p-6 animate-slideUp">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Admin can monitor overall academic performance using dashboards and charts.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <button onClick={() => setShowAddStudentModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex items-center gap-3 card-hover glow-button-subtle"><div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center"><UserPlus className="w-5 h-5 text-indigo-600" /></div><div className="text-left"><p className="text-sm text-gray-600">Add New</p><p className="font-medium text-gray-900">Student</p></div></button>
          <button onClick={() => setShowAddTeacherModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex items-center gap-3 card-hover glow-button-subtle"><div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center"><Plus className="w-5 h-5 text-teal-600" /></div><div className="text-left"><p className="text-sm text-gray-600">Add New</p><p className="font-medium text-gray-900">Teacher</p></div></button>
          <button onClick={() => setShowManageStudentsModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex items-center gap-3 card-hover glow-button-subtle"><div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><GraduationCap className="w-5 h-5 text-blue-600" /></div><div className="text-left"><p className="text-sm text-gray-600">Manage</p><p className="font-medium text-gray-900">Students</p></div></button>
          <button onClick={() => setShowManageTeachersModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex items-center gap-3 card-hover glow-button-subtle"><div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-green-600" /></div><div className="text-left"><p className="text-sm text-gray-600">Manage</p><p className="font-medium text-gray-900">Teachers</p></div></button>
          <button onClick={() => setShowManageClassesModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex items-center gap-3 card-hover glow-button-subtle"><div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><BookOpen className="w-5 h-5 text-purple-600" /></div><div className="text-left"><p className="text-sm text-gray-600">Manage</p><p className="font-medium text-gray-900">Classes</p></div></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button onClick={() => setShowSystemSettingsModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex items-center gap-3 card-hover glow-button-subtle"><div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><Settings className="w-5 h-5 text-amber-600" /></div><div className="text-left"><p className="text-sm text-gray-600">System</p><p className="font-medium text-gray-900">Settings</p></div></button>
          <button onClick={() => setShowExtensionRequestsModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex items-center gap-3 card-hover glow-button-subtle"><div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><Clock3 className="w-5 h-5 text-red-600" /></div><div className="text-left"><p className="text-sm text-gray-600">Exam</p><p className="font-medium text-gray-900">Extension Requests</p></div></button>
          <button onClick={() => setShowActivityLogModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex items-center gap-3 card-hover glow-button-subtle"><div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Activity className="w-5 h-5 text-blue-600" /></div><div className="text-left"><p className="text-sm text-gray-600">View All</p><p className="font-medium text-gray-900">Activities</p></div></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 card-hover"><div className="flex items-center justify-between"><div><p className="text-gray-600 text-sm mb-1">Total Students</p><p className="text-3xl font-bold text-gray-900">{dashboard.totalStudents}</p><p className="text-xs text-green-600 mt-1">Classes 1-12</p></div><div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center"><GraduationCap className="w-6 h-6 text-blue-600" /></div></div></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 card-hover"><div className="flex items-center justify-between"><div><p className="text-gray-600 text-sm mb-1">Total Teachers</p><p className="text-3xl font-bold text-gray-900">{dashboard.totalTeachers}</p><p className="text-xs text-green-600 mt-1">Active faculty</p></div><div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center"><Users className="w-6 h-6 text-green-600" /></div></div></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 card-hover"><div className="flex items-center justify-between"><div><p className="text-gray-600 text-sm mb-1">Total Classes</p><p className="text-3xl font-bold text-gray-900">{dashboard.totalClasses}</p><p className="text-xs text-gray-500 mt-1">Class + Section pairs</p></div><div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center"><BookOpen className="w-6 h-6 text-purple-600" /></div></div></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 card-hover"><div className="flex items-center justify-between"><div><p className="text-gray-600 text-sm mb-1">Average Performance</p><p className="text-3xl font-bold text-green-600">{dashboard.averagePerformance.toFixed(1)}%</p><p className="text-xs text-green-600 mt-1">From marks data</p></div><div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-6 h-6 text-amber-600" /></div></div></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 card-hover"><h2 className="text-xl font-bold text-gray-900 mb-4">Overall Performance Distribution</h2><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={normalizedPerf} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value">{normalizedPerf.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 card-hover"><h2 className="text-xl font-bold text-gray-900 mb-4">Class-wise Performance</h2><ResponsiveContainer width="100%" height={300}><BarChart data={classPerformanceData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="class" /><YAxis /><Tooltip /><Legend /><Bar dataKey="good" fill="#10b981" name="Good" /><Bar dataKey="average" fill="#f59e0b" name="Average" /><Bar dataKey="weak" fill="#ef4444" name="Weak" /></BarChart></ResponsiveContainer></div>
        </div>
      </div>

      {showAddStudentModal && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn"><div className="bg-white rounded-2xl max-w-xl w-full p-6"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Add Student</h2><button onClick={() => setShowAddStudentModal(false)}><X className="w-5 h-5" /></button></div><div className="space-y-3"><input value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} placeholder="Name" className="w-full px-4 py-2 border rounded-lg" /><input value={newStudent.class} onChange={(e) => setNewStudent({ ...newStudent, class: e.target.value })} placeholder="Class (1-12)" className="w-full px-4 py-2 border rounded-lg" /><input value={newStudent.rollNumber} onChange={(e) => setNewStudent({ ...newStudent, rollNumber: e.target.value })} placeholder="Roll Number" className="w-full px-4 py-2 border rounded-lg" /><select value={newStudent.section} onChange={(e) => setNewStudent({ ...newStudent, section: e.target.value })} className="w-full px-4 py-2 border rounded-lg"><option value="A">Section A</option><option value="B">Section B</option></select><button onClick={handleAddStudent} className="crud-btn crud-create w-full py-3">Create Student</button></div></div></div>
      )}

      {showAddTeacherModal && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn"><div className="bg-white rounded-2xl max-w-xl w-full p-6"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Add Teacher</h2><button onClick={() => setShowAddTeacherModal(false)}><X className="w-5 h-5" /></button></div><div className="space-y-3"><input value={newTeacher.teacherId} onChange={(e) => setNewTeacher({ ...newTeacher, teacherId: e.target.value })} placeholder="Teacher ID" className="w-full px-4 py-2 border rounded-lg" /><input value={newTeacher.name} onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })} placeholder="Name" className="w-full px-4 py-2 border rounded-lg" /><input value={newTeacher.subject} onChange={(e) => setNewTeacher({ ...newTeacher, subject: e.target.value })} placeholder="Subject" className="w-full px-4 py-2 border rounded-lg" /><input value={newTeacher.email} onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })} placeholder="Email" className="w-full px-4 py-2 border rounded-lg" /><input value={newTeacher.phone} onChange={(e) => setNewTeacher({ ...newTeacher, phone: e.target.value })} placeholder="Phone" className="w-full px-4 py-2 border rounded-lg" /><div className="grid grid-cols-2 gap-2"><input value={newTeacher.class} onChange={(e) => setNewTeacher({ ...newTeacher, class: e.target.value })} placeholder="Assigned class" className="w-full px-4 py-2 border rounded-lg" /><select value={newTeacher.section} onChange={(e) => setNewTeacher({ ...newTeacher, section: e.target.value })} className="w-full px-4 py-2 border rounded-lg"><option value="A">Section A</option><option value="B">Section B</option></select></div><button onClick={handleAddTeacher} className="crud-btn crud-create w-full py-3">Create Teacher</button></div></div></div>
      )}

      {showManageStudentsModal && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto animate-slideUp shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Manage Students</h2>
                <p className="text-sm text-gray-600 mt-1">View or delete student records</p>
              </div>
              <button onClick={() => setShowManageStudentsModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by name, student ID, class, section, roll no"
                className="w-full px-4 py-2 border rounded-lg"
              />
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Showing {visibleStudents.length} of {filteredStudents.length} students</span>
                <span>Page {studentPage} of {totalStudentPages}</span>
              </div>
              <div className="space-y-4">
                {visibleStudents.map((student) => (
                  <div key={student._id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow card-hover">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{student.name}</h3>
                        <p className="text-sm text-gray-600">Class {student.class} - Section {student.section}</p>
                        <p className="text-xs text-gray-500 mt-1">{student.studentId}</p>
                        <p className="text-xs text-gray-500">Roll No: {student.rollNo || '-'}</p>
                      </div>
                      <button onClick={() => handleDeleteStudent(student._id)} className="crud-btn crud-delete p-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {!visibleStudents.length && <p className="text-sm text-gray-500">No students found.</p>}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStudentPage((prev) => Math.max(1, prev - 1))}
                  disabled={studentPage === 1}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setStudentPage((prev) => Math.min(totalStudentPages, prev + 1))}
                  disabled={studentPage === totalStudentPages}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showManageTeachersModal && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto animate-slideUp shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Manage Teachers</h2>
                <p className="text-sm text-gray-600 mt-1">View or delete teacher records</p>
              </div>
              <button onClick={() => setShowManageTeachersModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <input
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                placeholder="Search by name, teacher ID, subject, email, phone"
                className="w-full px-4 py-2 border rounded-lg"
              />
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Showing {visibleTeachers.length} of {filteredTeachers.length} teachers</span>
                <span>Page {teacherPage} of {totalTeacherPages}</span>
              </div>
              <div className="space-y-4">
                {visibleTeachers.map((teacher) => (
                  <div key={teacher._id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow card-hover">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{teacher.name}</h3>
                        <p className="text-sm text-gray-600">{teacher.subject}</p>
                        <p className="text-xs text-gray-500 mt-1">{teacher.teacherId}</p>
                        <p className="text-xs text-gray-500">{teacher.email || '-'}</p>
                        <p className="text-xs text-gray-500">{teacher.phone || '-'}</p>
                      </div>
                      <button onClick={() => handleDeleteTeacher(teacher._id)} className="crud-btn crud-delete p-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {!visibleTeachers.length && <p className="text-sm text-gray-500">No teachers found.</p>}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTeacherPage((prev) => Math.max(1, prev - 1))}
                  disabled={teacherPage === 1}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherPage((prev) => Math.min(totalTeacherPages, prev + 1))}
                  disabled={teacherPage === totalTeacherPages}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showManageClassesModal && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn"><div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto animate-slideUp shadow-2xl"><div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white"><div><h2 className="text-2xl font-bold text-gray-900">Manage Classes</h2><p className="text-sm text-gray-600 mt-1">Class + section records from backend</p></div><button onClick={() => setShowManageClassesModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div><div className="p-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{classes.map((classItem) => (<div key={classItem._id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow card-hover"><h3 className="font-bold text-lg text-gray-900">Class {classItem.class}-{classItem.section}</h3><p className="text-sm text-gray-600 mt-2">Class Teacher ID: {classItem.classTeacherId || '-'}</p><div className="flex flex-wrap gap-1 mt-2">{classItem.subjects.map((subject, idx) => (<span key={idx} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">{subject}</span>))}</div></div>))}</div></div></div></div>
      )}

      {showSystemSettingsModal && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">System Settings</h2>
              <button onClick={() => setShowSystemSettingsModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={systemSettings.schoolName} onChange={(e) => setSystemSettings({ ...systemSettings, schoolName: e.target.value })} placeholder="School Name" className="w-full px-4 py-2 border rounded-lg" />
              <input value={systemSettings.academicYear} onChange={(e) => setSystemSettings({ ...systemSettings, academicYear: e.target.value })} placeholder="Academic Year (e.g. 2025-2026)" className="w-full px-4 py-2 border rounded-lg" />
              <input value={systemSettings.supportEmail} onChange={(e) => setSystemSettings({ ...systemSettings, supportEmail: e.target.value })} placeholder="Support Email" className="w-full px-4 py-2 border rounded-lg" />
              <input value={systemSettings.activeExam} onChange={(e) => setSystemSettings({ ...systemSettings, activeExam: e.target.value })} placeholder="Active Exam (e.g. Mid Term)" className="w-full px-4 py-2 border rounded-lg" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" min={0} max={100} value={systemSettings.attendanceThreshold} onChange={(e) => setSystemSettings({ ...systemSettings, attendanceThreshold: Number(e.target.value) })} placeholder="Attendance Threshold %" className="w-full px-4 py-2 border rounded-lg" />
                <input type="number" min={0} max={100} value={systemSettings.passThreshold} onChange={(e) => setSystemSettings({ ...systemSettings, passThreshold: Number(e.target.value) })} placeholder="Pass Threshold %" className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="datetime-local" value={toDateTimeLocalValue(systemSettings.markEntryStartsAt)} onChange={(e) => setSystemSettings({ ...systemSettings, markEntryStartsAt: toIsoFromDateTimeLocal(e.target.value) })} className="w-full px-4 py-2 border rounded-lg" />
                <input type="datetime-local" value={toDateTimeLocalValue(systemSettings.markEntryDeadlineAt)} onChange={(e) => setSystemSettings({ ...systemSettings, markEntryDeadlineAt: toIsoFromDateTimeLocal(e.target.value) })} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={systemSettings.reportTheme} onChange={(e) => setSystemSettings({ ...systemSettings, reportTheme: e.target.value as SystemSettings['reportTheme'] })} className="w-full px-4 py-2 border rounded-lg bg-white">
                  <option value="classic">Classic</option>
                  <option value="modern">Modern</option>
                  <option value="minimal">Minimal</option>
                </select>
                <select value={systemSettings.googleSignInEnabled ? 'enabled' : 'disabled'} onChange={(e) => setSystemSettings({ ...systemSettings, googleSignInEnabled: e.target.value === 'enabled' })} className="w-full px-4 py-2 border rounded-lg bg-white">
                  <option value="enabled">Google Sign-In Enabled</option>
                  <option value="disabled">Google Sign-In Disabled</option>
                </select>
              </div>
              <button onClick={handleSaveSystemSettings} className="crud-btn crud-save w-full py-3">Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {showExtensionRequestsModal && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-slideUp shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Mark Entry Extension Requests</h2>
                <p className="text-sm text-gray-600 mt-1">Review and approve/reject pending faculty requests</p>
              </div>
              <button onClick={() => setShowExtensionRequestsModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {extensionRequests.map((request) => (
                  <div key={request._id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-800">{request.teacherName} ({request.teacherId}) | {request.exam}</p>
                    <p className="text-sm text-gray-600 mt-1">Requested till: {new Date(request.requestedUntil).toLocaleString()}</p>
                    <p className="text-sm text-gray-500 mt-1">{request.reason || 'No reason provided'}</p>
                    <div className="flex gap-2 mt-3">
                      <button type="button" onClick={() => handleReviewExtensionRequest(request, 'approve')} className="crud-btn crud-save text-xs px-3 py-1">Approve</button>
                      <button type="button" onClick={() => handleReviewExtensionRequest(request, 'reject')} className="crud-btn crud-delete text-xs px-3 py-1">Reject</button>
                    </div>
                  </div>
                ))}
                {!extensionRequests.length && <p className="text-sm text-gray-500">No pending requests</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {showActivityLogModal && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn"><div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-slideUp shadow-2xl"><div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white"><div><h2 className="text-2xl font-bold text-gray-900">Complete Activity Log</h2><p className="text-sm text-gray-600 mt-1">All system activities and changes</p></div><button onClick={() => setShowActivityLogModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div><div className="p-6"><div className="space-y-4">{recentActivities.map((activity) => (<div key={activity._id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow card-hover"><div className="flex items-start gap-4"><div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">{getActivityIcon(activity.type)}</div><div className="flex-1"><h3 className="font-bold text-gray-900">{activity.action}</h3><p className="text-sm text-gray-600 mb-1">{activity.actorName}</p>{activity.details && <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg mb-2">{activity.details}</p>}<p className="text-xs text-gray-500">{new Date(activity.createdAt).toLocaleString()}</p></div></div></div>))}</div></div></div></div>
      )}
    </div>
  );
}

