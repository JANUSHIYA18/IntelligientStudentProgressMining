import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { BookOpen, Calendar, TrendingDown, User, DollarSign, FileX, Phone, Mail, GraduationCap, Download, Bell } from 'lucide-react';
import { Navigation } from './Navigation';
import { apiRequest, getSessionAuth } from '../api/client';
import { triggerBase64Download, type DownloadPayload } from '../api/download';

type Subject = { name: string; marks: number; totalMarks: number; status?: string };
type Teacher = {
  teacherId: string;
  name: string;
  subject: string;
  email?: string;
  phone?: string;
  experience?: number;
  homeClass?: number;
  homeSection?: string;
  assignedClasses?: { class: number; section: string }[];
};

type AssignmentNotice = {
  _id: string;
  title: string;
  subject: string;
  dueDate: string;
  status: 'active' | 'closed';
  completionStatus?: 'complete' | 'incomplete';
};

type AnnouncementNotice = {
  _id: string;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high';
  createdByName: string;
  createdAt: string;
};

type StudentPayload = {
  student?: any;
  classTeacher?: Teacher | null;
  weakSubjects: Subject[];
  attendance: number;
  academicPercentage: number;
  drawbacksCount: number;
  feesPending: number;
  assignments?: AssignmentNotice[];
  announcements?: AnnouncementNotice[];
  notifications?: { id: string; type: string; title: string; message: string; dateLabel: string }[];
};

export function StudentDashboard() {
  const navigate = useNavigate();
  const [{ loading, error }, setUi] = useState({ loading: true, error: '' });
  const [payload, setPayload] = useState<StudentPayload>({
    weakSubjects: [],
    attendance: 0,
    academicPercentage: 0,
    drawbacksCount: 0,
    feesPending: 0,
    assignments: [],
    announcements: []
  });

  useEffect(() => {
    const run = async () => {
      const { token, user } = getSessionAuth();
      if (!token || !user) {
        navigate('/');
        return;
      }

      const studentId = user.studentId;
      if (!studentId) {
        setUi({ loading: false, error: 'No studentId found in session. Login with a student account linked to studentId.' });
        return;
      }

      try {
        const data = await apiRequest<StudentPayload>(`/student/${studentId}/dashboard`, { token });
        setPayload(data);
        setUi({ loading: false, error: '' });
      } catch (e) {
        setUi({ loading: false, error: e instanceof Error ? e.message : 'Failed to load dashboard' });
      }
    };

    run();
  }, [navigate]);

  const subjects = useMemo(() => {
    const raw = payload.student?.subjects || [];
    return raw.map((s: Subject) => {
      const pct = s.totalMarks ? (s.marks / s.totalMarks) * 100 : 0;
      const status = pct >= 75 ? 'good' : pct >= 60 ? 'average' : 'weak';
      return { ...s, status };
    });
  }, [payload.student]);

  const weakSubjects = useMemo(() => subjects.filter((s: any) => s.status === 'weak'), [subjects]);
  const handleLogout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    navigate('/');
  };

  const handleDownloadReportCard = async () => {
    const { token, user } = getSessionAuth();
    if (!token || !user?.studentId) return;

    try {
      const response = await apiRequest<DownloadPayload>(`/reports/download?format=pdf&scope=${encodeURIComponent(`student:${user.studentId}`)}`, { token });
      triggerBase64Download(response);
    } catch {
      // keep existing no-toast behavior
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'good') return 'text-green-600 bg-green-100';
    if (status === 'average') return 'text-amber-600 bg-amber-100';
    return 'text-red-600 bg-red-100';
  };

  const assignments = payload.assignments || [];
  const announcements = payload.announcements || [];
  const notifications = payload.notifications || [];
  const student = payload.student;

  return (
    <div className="min-h-screen bg-gray-50 animate-fadeIn">
      <Navigation role="Student" onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto p-6 animate-slideUp">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Student Progress Dashboard</h1>
          <p className="text-gray-600">Students can track their academic progress and weak areas.</p>
          {loading && <p className="text-sm text-indigo-600 mt-2">Loading dashboard...</p>}
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={handleDownloadReportCard} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-300 text-sm font-medium glow-button"><Download className="w-4 h-4" />Download Report Card PDF</button>
          </div>
        </div>

        {student && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 card-hover">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">Student Profile</p>
                <h2 className="text-2xl font-bold text-gray-900">{student.name}</h2>
                <p className="text-sm text-indigo-700 mt-1">Class {student.class} - Section {student.section}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-gray-500">Student ID</p>
                <p className="font-semibold text-gray-900">{student.studentId || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-gray-500">Roll No</p>
                <p className="font-semibold text-gray-900">{student.rollNo || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-gray-500">Date of Birth</p>
                <p className="font-semibold text-gray-900">{student.dob || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-gray-500">Blood Group</p>
                <p className="font-semibold text-gray-900">{student.bloodGroup || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-gray-500">Parent Name</p>
                <p className="font-semibold text-gray-900">{student.parentName || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-gray-500">Parent Contact</p>
                <p className="font-semibold text-gray-900">{student.parentContact || '-'}</p>
              </div>
            </div>
          </div>
        )}

        {payload.classTeacher && (
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl shadow-lg p-6 mb-8 text-white card-hover">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0"><GraduationCap className="w-7 h-7" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-indigo-100 text-sm">Primary Class Teacher</p>
                <h2 className="text-2xl font-bold">{payload.classTeacher.name}</h2>
                <p className="text-indigo-100 mt-1">Class Teacher • Class {payload.classTeacher.homeClass ?? payload.student?.class}-{payload.classTeacher.homeSection ?? payload.student?.section}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-sm">
                  <div className="flex items-center gap-2"><User className="w-4 h-4" /><span>ID: {payload.classTeacher.teacherId}</span></div>
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4" /><span>{payload.classTeacher.phone || '-'}</span></div>
                  <div className="flex items-center gap-2"><Mail className="w-4 h-4" /><span>{payload.classTeacher.email || '-'}</span></div>
                  <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span>Experience: {payload.classTeacher.experience || 0} years</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 card-hover"><div className="flex items-center justify-between mb-4"><div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center"><BookOpen className="w-6 h-6 text-blue-600" /></div></div><p className="text-gray-600 text-sm mb-1">Academic Percentage</p><p className="text-2xl font-bold text-gray-900">{payload.academicPercentage}%</p></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 card-hover"><div className="flex items-center justify-between mb-4"><div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center"><Calendar className="w-6 h-6 text-green-600" /></div></div><p className="text-gray-600 text-sm mb-1">Attendance</p><p className="text-2xl font-bold text-gray-900">{payload.attendance}%</p></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 card-hover"><div className="flex items-center justify-between mb-4"><div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center"><FileX className="w-6 h-6 text-red-600" /></div></div><p className="text-gray-600 text-sm mb-1">Drawbacks</p><p className="text-2xl font-bold text-gray-900">{payload.drawbacksCount}</p></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 card-hover"><div className="flex items-center justify-between mb-4"><div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center"><DollarSign className="w-6 h-6 text-amber-600" /></div></div><p className="text-gray-600 text-sm mb-1">Fees Pending</p><p className="text-2xl font-bold text-gray-900">${payload.feesPending}</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 card-hover">
            <div className="p-6 border-b border-gray-200"><h2 className="text-xl font-bold text-gray-900">Subject-wise Marks</h2></div>
            <div className="p-6">
              <div className="space-y-4">
                {subjects.map((subject: any) => (
                  <div key={subject.name} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2"><h3 className="font-medium text-gray-900">{subject.name}</h3><span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(subject.status)}`}>{subject.status.charAt(0).toUpperCase() + subject.status.slice(1)}</span></div>
                    <div className="flex items-center justify-between"><div className="flex-1"><div className="w-full bg-gray-200 rounded-full h-2"><div className={`h-2 rounded-full ${subject.status === 'good' ? 'bg-green-500' : subject.status === 'average' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${(subject.marks / subject.totalMarks) * 100}%` }}></div></div></div><span className="ml-4 text-sm font-medium text-gray-700">{subject.marks}/{subject.totalMarks}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 card-hover">
            <div className="p-6 border-b border-gray-200"><h2 className="text-xl font-bold text-gray-900">Upcoming Events & Deadlines</h2></div>
            <div className="p-6">
              <div className="space-y-4">
                {assignments.map((assignment) => (
                  <div key={assignment._id} className="flex items-start gap-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0"><Calendar className="w-5 h-5 text-indigo-600" /></div>
                    <div className="flex-1"><h3 className="font-medium text-gray-900">{assignment.title}</h3><p className="text-sm text-gray-600 mt-1">Due: {new Date(assignment.dueDate).toLocaleDateString()}</p><span className="inline-block mt-2 px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">{assignment.subject}</span><span className={`inline-block mt-2 ml-2 px-2 py-1 rounded text-xs font-medium ${assignment.completionStatus === 'complete' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{assignment.completionStatus === 'complete' ? 'Complete' : 'Incomplete'}</span></div>
                  </div>
                ))}
                {announcements.map((notice) => (
                  <div key={notice._id} className="flex items-start gap-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0"><Bell className="w-5 h-5 text-purple-600" /></div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{notice.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{notice.message}</p>
                      <p className="text-xs text-gray-500 mt-1">By {notice.createdByName} | {new Date(notice.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {!assignments.length && !announcements.length && <p className="text-sm text-gray-600">No active assignments or announcements for your class-section.</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 card-hover">
          <div className="p-6 border-b border-gray-200"><h2 className="text-xl font-bold text-gray-900">Daily Notifications</h2></div>
          <div className="p-6 space-y-3">
            {notifications.map((notice) => (
              <div key={notice.id} className="p-4 rounded-lg border border-blue-200 bg-blue-50">
                <p className="text-sm font-semibold text-blue-900">{notice.title}</p>
                <p className="text-sm text-blue-700 mt-1">{notice.message}</p>
                <p className="text-xs text-blue-600 mt-1">{notice.dateLabel}</p>
              </div>
            ))}
            {!notifications.length && <p className="text-sm text-gray-600">No notifications for today.</p>}
          </div>
        </div>

        {weakSubjects.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 card-hover">
            <div className="flex items-start gap-3"><TrendingDown className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" /><div><h3 className="font-medium text-red-900 mb-2">Subjects Need Attention</h3><p className="text-red-700 text-sm">You are performing below average in: {weakSubjects.map((s: any) => s.name).join(', ')}. Check the Recommendations page for improvement suggestions.</p></div></div>
          </div>
        )}
      </div>

    </div>
  );
}
