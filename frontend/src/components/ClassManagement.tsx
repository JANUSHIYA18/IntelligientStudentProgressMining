import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Save, Calendar, FileText, MessageSquare, Search, Upload, CheckCircle, XCircle } from 'lucide-react';
import { Navigation } from './Navigation';
import { apiRequest, getSessionAuth } from '../api/client';
import { toast } from 'sonner@2.0.3';

type TabType = 'marks' | 'attendance' | 'assignments' | 'announcements' | 'completion';
type AttendanceStatus = 'present' | 'absent' | 'late';

type Student = {
  _id: string;
  studentId: string;
  name: string;
  rollNo?: string;
  class: number;
  section: 'A' | 'B';
  subjects?: { name: string; marks: number; totalMarks: number }[];
};

type Teacher = {
  teacherId?: string;
  name: string;
  subject: string;
  email?: string;
  phone?: string;
  experience?: number;
};

type TeacherOverview = { teacher: Teacher | null };
type AssignedClass = { class: number; section: 'A' | 'B' };
type MyClassesPayload = { teacher: Teacher | null; assignedClasses: AssignedClass[] };

type AssignmentItem = {
  _id: string;
  class?: number;
  section?: 'A' | 'B';
  title: string;
  description: string;
  subject: string;
  dueDate: string;
  status: 'active' | 'closed';
  createdByName: string;
};

type AnnouncementItem = {
  _id: string;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high';
  createdByName: string;
  createdAt: string;
  expiresAt?: string | null;
};

type SubjectMarksByStudent = Record<string, Record<string, string>>;
type TargetOption = { key: string; label: string; class: number; section: 'A' | 'B' };
type AssignmentProgressRow = { studentId: string; name: string; rollNo: string; status: 'complete' | 'incomplete' };
type AssignmentProgressPayload = { assignment: AssignmentItem; entries: AssignmentProgressRow[] };
type ExamWindow = {
  activeExam: string;
  markEntryStartsAt?: string;
  markEntryDeadlineAt?: string;
  serverNow?: string;
  isMarkEntryOpen: boolean;
  pendingRequest?: { _id: string; status: 'pending'; requestedUntil: string; reason?: string } | null;
};
type MarkStatusRow = { studentId: string; status: 'present' | 'absent' };

const isValidMark = (value: string) => {
  const n = Number(value);
  return !Number.isNaN(n) && n >= 0 && n <= 100;
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

export function ClassManagement() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('marks');
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<'A' | 'B' | null>(null);
  const [selectedExam, setSelectedExam] = useState('Exam 1');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [completionSearchTerm, setCompletionSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [examWindow, setExamWindow] = useState<ExamWindow | null>(null);

  const [assignedClasses, setAssignedClasses] = useState<AssignedClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teacher, setTeacher] = useState<TeacherOverview['teacher']>(null);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);

  const [marksByStudent, setMarksByStudent] = useState<SubjectMarksByStudent>({});
  const [initialMarksByStudent, setInitialMarksByStudent] = useState<SubjectMarksByStudent>({});
  const [absentByStudent, setAbsentByStudent] = useState<Record<string, boolean>>({});
  const [initialAbsentByStudent, setInitialAbsentByStudent] = useState<Record<string, boolean>>({});
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});

  const [assignmentForm, setAssignmentForm] = useState({ title: '', description: '', subject: '', dueDate: '' });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', priority: 'normal' as 'low' | 'normal' | 'high' });
  const [assignmentTargets, setAssignmentTargets] = useState<string[]>([]);
  const [announcementTargets, setAnnouncementTargets] = useState<string[]>([]);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [selectedProgressAssignmentId, setSelectedProgressAssignmentId] = useState<string>('');
  const [assignmentProgress, setAssignmentProgress] = useState<Record<string, 'complete' | 'incomplete'>>({});
  const [extensionRequestedUntil, setExtensionRequestedUntil] = useState('');
  const [extensionReason, setExtensionReason] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const deferredCompletionSearchTerm = useDeferredValue(completionSearchTerm);

  const availableClasses = useMemo(() => [...new Set(assignedClasses.map((item) => item.class))].sort((a, b) => a - b), [assignedClasses]);

  const availableSections = useMemo(() => {
    if (!selectedClass) return [];
    return assignedClasses.filter((item) => item.class === selectedClass).map((item) => item.section).sort();
  }, [assignedClasses, selectedClass]);
  const targetOptions = useMemo<TargetOption[]>(
    () => assignedClasses.map((item) => ({ key: `${item.class}-${item.section}`, label: `Class ${item.class} - Section ${item.section}`, class: item.class, section: item.section })),
    [assignedClasses]
  );

  const facultySubject = String(teacher?.subject || 'General').trim() || 'General';
  const subjects = useMemo(() => [facultySubject], [facultySubject]);

  useEffect(() => {
    if (selectedSubject !== facultySubject) setSelectedSubject(facultySubject);
    if (assignmentForm.subject !== facultySubject) {
      setAssignmentForm((prev) => ({ ...prev, subject: facultySubject }));
    }
  }, [facultySubject]);

  useEffect(() => {
    const validKeys = new Set(targetOptions.map((item) => item.key));
    setAssignmentTargets((prev) => {
      const filtered = prev.filter((key) => validKeys.has(key));
      if (filtered.length) return filtered;
      return targetOptions[0] ? [targetOptions[0].key] : [];
    });
    setAnnouncementTargets((prev) => {
      const filtered = prev.filter((key) => validKeys.has(key));
      if (filtered.length) return filtered;
      return targetOptions[0] ? [targetOptions[0].key] : [];
    });
  }, [targetOptions]);

  useEffect(() => {
    if (!assignments.length) {
      setSelectedProgressAssignmentId('');
      setAssignmentProgress({});
      return;
    }
    if (!assignments.some((item) => item._id === selectedProgressAssignmentId)) {
      setSelectedProgressAssignmentId(assignments[0]._id);
    }
  }, [assignments, selectedProgressAssignmentId]);

  const buildMarksState = (rows: Student[], subjectList: string[]) => {
    const next: SubjectMarksByStudent = {};
    rows.forEach((student) => {
      const map: Record<string, string> = {};
      subjectList.forEach((subjectName) => {
        const found = (student.subjects || []).find((subject) => subject.name === subjectName);
        map[subjectName] = found ? String(found.marks) : '';
      });
      next[student.studentId] = map;
    });
    return next;
  };

  const initAttendance = (rows: Student[]) => {
    setAttendance(rows.reduce((acc, student) => ({ ...acc, [student.studentId]: 'present' }), {}));
  };

  const loadExamWindow = async () => {
    const { token } = getSessionAuth();
    if (!token) return;
    try {
      const payload = await apiRequest<ExamWindow>('/faculty/exam-window', { token });
      setExamWindow(payload);
      if (payload.activeExam && payload.activeExam !== selectedExam) {
        setSelectedExam(payload.activeExam);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load active exam window');
    }
  };

  const loadMyClasses = async () => {
    const { token } = getSessionAuth();
    if (!token) {
      navigate('/');
      return;
    }

    try {
      const payload = await apiRequest<MyClassesPayload>('/faculty/my-classes', { token });
      const sorted = [...payload.assignedClasses].sort((a, b) => (a.class === b.class ? a.section.localeCompare(b.section) : a.class - b.class));
      setAssignedClasses(sorted);
      if (payload.teacher) setTeacher(payload.teacher);
      if (!sorted.length) {
        toast.error('No class mapping found for this faculty account');
        return;
      }
      setSelectedClass(sorted[0].class);
      setSelectedSection(sorted[0].section);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load faculty class mappings');
    }
  };

  const loadClassData = async () => {
    const { token } = getSessionAuth();
    if (!token) {
      navigate('/');
      return;
    }
    if (!selectedClass || !selectedSection) return;
    if (!assignedClasses.some((item) => item.class === selectedClass && item.section === selectedSection)) return;

    try {
      setLoading(true);
      const teacherSubject = String(teacher?.subject || facultySubject).trim() || facultySubject;
      const [studentRows, assignmentRows, announcementRows, statusRows] = await Promise.all([
        apiRequest<Student[]>(`/faculty/students?class=${selectedClass}&section=${selectedSection}`, { token }),
        apiRequest<AssignmentItem[]>(`/faculty/assignments?class=${selectedClass}&section=${selectedSection}`, { token }),
        apiRequest<AnnouncementItem[]>(`/faculty/announcements?class=${selectedClass}&section=${selectedSection}`, { token }),
        apiRequest<MarkStatusRow[]>(`/faculty/mark-statuses?class=${selectedClass}&section=${selectedSection}&exam=${encodeURIComponent(selectedExam)}&subject=${encodeURIComponent(teacherSubject)}`, { token })
      ]);

      setStudents(studentRows);
      setAssignments(assignmentRows);
      setAnnouncements(announcementRows);

      const generated = buildMarksState(studentRows, [teacherSubject]);
      setMarksByStudent(generated);
      setInitialMarksByStudent(generated);
      const nextAbsentByStudent = studentRows.reduce((acc, student) => {
        const found = statusRows.find((row) => row.studentId === student.studentId);
        acc[student.studentId] = found?.status === 'absent';
        return acc;
      }, {} as Record<string, boolean>);
      setAbsentByStudent(nextAbsentByStudent);
      setInitialAbsentByStudent(nextAbsentByStudent);
      initAttendance(studentRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load class data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExamWindow();
    loadMyClasses();
  }, []);

  useEffect(() => {
    if (!selectedClass || !selectedSection || !selectedExam) return;
    loadClassData();
  }, [selectedClass, selectedSection, selectedExam]);

  useEffect(() => {
    if (!selectedClass || !selectedSection) return;
    if (!availableSections.includes(selectedSection)) setSelectedSection(availableSections[0] || null);
  }, [selectedClass, selectedSection, availableSections]);

  useEffect(() => {
    if (!selectedProgressAssignmentId) return;
    loadAssignmentProgress(selectedProgressAssignmentId);
  }, [selectedProgressAssignmentId]);

  useEffect(() => {
    if (activeTab !== 'completion') return;
    if (!selectedProgressAssignmentId && assignments.length) {
      setSelectedProgressAssignmentId(assignments[0]._id);
    }
  }, [activeTab, assignments, selectedProgressAssignmentId]);

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    navigate('/');
  };

  const handleClassChange = (value: string) => {
    const nextClass = value ? Number(value) : null;
    if (!nextClass) {
      setSelectedClass(null);
      setSelectedSection(null);
      return;
    }
    const sectionsForClass = assignedClasses.filter((item) => item.class === nextClass).map((item) => item.section).sort();
    const nextSection = sectionsForClass.includes(selectedSection as 'A' | 'B') ? selectedSection : (sectionsForClass[0] || null);
    setSelectedClass(nextClass);
    setSelectedSection(nextSection);
  };

  const handleSubjectMarkChange = (studentId: string, subject: string, value: string) => {
    setMarksByStudent((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), [subject]: value } }));
  };

  const getStudentAverage = (studentId: string) => {
    const values = subjects
      .map((subject) => marksByStudent[studentId]?.[subject])
      .filter((value) => value !== '' && value !== undefined && isValidMark(value))
      .map((value) => Number(value));

    if (!values.length) return 0;
    return values.reduce((sum, mark) => sum + mark, 0) / values.length;
  };

  const handleSaveMarks = async () => {
    const { token, user } = getSessionAuth();
    if (!token) return;
    const entries: { studentId: string; subject: string; marks?: number; totalMarks: number; status: 'present' | 'absent' }[] = [];
    students.forEach((student) => {
      subjects.forEach((subject) => {
        const value = marksByStudent[student.studentId]?.[subject] ?? '';
        const initialValue = initialMarksByStudent[student.studentId]?.[subject] ?? '';
        const isAbsent = Boolean(absentByStudent[student.studentId]);
        const wasAbsent = Boolean(initialAbsentByStudent[student.studentId]);
        const statusChanged = isAbsent !== wasAbsent;
        const markChanged = !isAbsent && value !== '' && isValidMark(value) && value !== initialValue;
        if (!statusChanged && !markChanged) return;
        entries.push({
          studentId: student.studentId,
          subject,
          marks: isAbsent ? undefined : Number(value),
          totalMarks: 100,
          status: isAbsent ? 'absent' : 'present'
        });
      });
    });

    if (!entries.length) {
      toast.error('No subject-wise mark changes found to save');
      return;
    }

    try {
      await apiRequest('/faculty/marks/bulk', {
        method: 'POST',
        token,
        body: { actorName: user?.name || user?.username || 'Faculty', exam: selectedExam, entries }
      });
      toast.success(`Saved ${entries.length} subject-wise mark updates (${selectedExam})`);
      setInitialMarksByStudent(marksByStudent);
      setInitialAbsentByStudent(absentByStudent);
      await loadExamWindow();
      await loadClassData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save marks');
    }
  };

  const handleRequestExtension = async () => {
    const { token } = getSessionAuth();
    if (!token) return;
    if (!extensionRequestedUntil) {
      toast.error('Select requested new deadline');
      return;
    }
    try {
      await apiRequest('/faculty/exam-window/extension-request', {
        method: 'POST',
        token,
        body: {
          requestedUntil: new Date(extensionRequestedUntil).toISOString(),
          reason: extensionReason.trim()
        }
      });
      toast.success('Extension request sent to admin');
      await loadExamWindow();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to request extension');
    }
  };

  const handleSaveAttendance = async () => {
    const { token, user } = getSessionAuth();
    if (!token) return;

    try {
      await apiRequest('/faculty/attendance/bulk', {
        method: 'POST',
        token,
        body: { actorName: user?.name || user?.username || 'Faculty', entries: Object.entries(attendance).map(([studentId, status]) => ({ studentId, status })) }
      });
      const presentCount = Object.values(attendance).filter((a) => a === 'present').length;
      const absentCount = Object.values(attendance).filter((a) => a === 'absent').length;
      const lateCount = Object.values(attendance).filter((a) => a === 'late').length;
      toast.success(`Attendance saved: ${presentCount} Present, ${absentCount} Absent, ${lateCount} Late`);
      await loadClassData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save attendance');
    }
  };

  const handleMarkAll = (status: 'present' | 'absent') => {
    setAttendance(students.reduce((acc, student) => ({ ...acc, [student.studentId]: status }), {} as Record<string, AttendanceStatus>));
  };

  const currentTargetKey = selectedClass && selectedSection ? `${selectedClass}-${selectedSection}` : '';
  const toTargetPayload = (keys: string[]) =>
    keys
      .map((key) => {
        const [classPart, sectionPart] = key.split('-');
        return { class: Number(classPart), section: sectionPart as 'A' | 'B' };
      })
      .filter((item) => Number.isInteger(item.class) && item.class >= 1 && item.class <= 12 && ['A', 'B'].includes(item.section));

  const toggleTarget = (key: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => {
      if (prev.includes(key)) return prev.length === 1 ? prev : prev.filter((item) => item !== key);
      return [...prev, key];
    });
  };

  const handleBulkMarkEntry = async () => {
    const { token } = getSessionAuth();
    if (!token) return;
    const csvData = window.prompt('Paste CSV rows:\nstudentId,marks\nSTU10A001,89\nSTU10A002,76');
    if (!csvData) return;

    try {
      await apiRequest('/faculty/marks/upload-csv', { method: 'POST', token, body: { exam: selectedExam, subject: facultySubject, totalMarks: 100, csvData } });
      toast.success(`CSV marks uploaded for ${facultySubject}`);
      await loadExamWindow();
      await loadClassData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'CSV upload failed');
    }
  };

  const handleCreateAssignment = async () => {
    const { token } = getSessionAuth();
    if (!token || !selectedClass || !selectedSection) return;
    if (!assignmentForm.title.trim() || !assignmentForm.dueDate) {
      toast.error('Title and due date are required');
      return;
    }
    if (!assignmentTargets.length) {
      toast.error('Select at least one target class-section');
      return;
    }

    try {
      const targets = toTargetPayload(assignmentTargets);
      const primary = targets[0];
      await apiRequest('/faculty/assignments', {
        method: 'POST',
        token,
        body: {
          class: primary.class,
          section: primary.section,
          targets,
          title: assignmentForm.title.trim(),
          description: assignmentForm.description.trim(),
          subject: facultySubject,
          dueDate: new Date(assignmentForm.dueDate).toISOString()
        }
      });
      toast.success(`Assignment created for ${targets.length} mapped class-section(s)`);
      setAssignmentForm({ title: '', description: '', subject: facultySubject, dueDate: '' });
      const rows = await apiRequest<AssignmentItem[]>(`/faculty/assignments?class=${selectedClass}&section=${selectedSection}`, { token });
      setAssignments(rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create assignment');
    }
  };

  const loadAssignmentProgress = async (assignmentId: string) => {
    const { token } = getSessionAuth();
    if (!token || !assignmentId) return;
    try {
      const payload = await apiRequest<AssignmentProgressPayload>(`/faculty/assignments/${assignmentId}/progress`, { token });
      const mapped = payload.entries.reduce((acc, entry) => ({ ...acc, [entry.studentId]: entry.status }), {} as Record<string, 'complete' | 'incomplete'>);
      setAssignmentProgress(mapped);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load assignment progress');
    }
  };

  const handleSaveAssignmentProgress = async () => {
    const { token, user } = getSessionAuth();
    if (!token || !selectedProgressAssignmentId) return;
    const entries = students.map((student) => ({
      studentId: student.studentId,
      status: assignmentProgress[student.studentId] || 'incomplete'
    }));
    try {
      await apiRequest(`/faculty/assignments/${selectedProgressAssignmentId}/progress`, {
        method: 'POST',
        token,
        body: { actorName: user?.name || user?.username || 'Faculty', entries }
      });
      toast.success('Assignment completion status saved');
      await loadClassData();
      await loadAssignmentProgress(selectedProgressAssignmentId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save assignment completion status');
    }
  };

  const handleEditAssignment = async (item: AssignmentItem) => {
    const { token } = getSessionAuth();
    if (!token) return;
    const title = window.prompt('Edit assignment title', item.title);
    if (title === null) return;
    const description = window.prompt('Edit assignment description', item.description || '');
    if (description === null) return;
    const dueDateDefault = item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : '';
    const dueDate = window.prompt('Edit due date (YYYY-MM-DD)', dueDateDefault);
    if (dueDate === null) return;

    try {
      setEditingAssignmentId(item._id);
      await apiRequest(`/faculty/assignments/${item._id}`, {
        method: 'PUT',
        token,
        body: { title: title.trim(), description: description.trim(), dueDate: new Date(dueDate).toISOString() }
      });
      toast.success('Assignment updated');
      await loadClassData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update assignment');
    } finally {
      setEditingAssignmentId(null);
    }
  };

  const handleDeleteAssignment = async (item: AssignmentItem) => {
    const { token } = getSessionAuth();
    if (!token) return;
    if (!window.confirm(`Delete assignment "${item.title}"?`)) return;
    try {
      setEditingAssignmentId(item._id);
      await apiRequest(`/faculty/assignments/${item._id}`, { method: 'DELETE', token });
      toast.success('Assignment deleted');
      await loadClassData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete assignment');
    } finally {
      setEditingAssignmentId(null);
    }
  };

  const handleCreateAnnouncement = async () => {
    const { token } = getSessionAuth();
    if (!token || !selectedClass || !selectedSection) return;
    if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    if (!announcementTargets.length) {
      toast.error('Select at least one target class-section');
      return;
    }

    try {
      const targets = toTargetPayload(announcementTargets);
      const primary = targets[0];
      await apiRequest('/faculty/announcements', {
        method: 'POST',
        token,
        body: {
          class: primary.class,
          section: primary.section,
          targets,
          title: announcementForm.title.trim(),
          message: announcementForm.message.trim(),
          priority: announcementForm.priority
        }
      });
      toast.success(`Announcement created for ${targets.length} mapped class-section(s)`);
      setAnnouncementForm({ title: '', message: '', priority: 'normal' });
      const rows = await apiRequest<AnnouncementItem[]>(`/faculty/announcements?class=${selectedClass}&section=${selectedSection}`, { token });
      setAnnouncements(rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create announcement');
    }
  };

  const handleEditAnnouncement = async (item: AnnouncementItem) => {
    const { token } = getSessionAuth();
    if (!token) return;
    const title = window.prompt('Edit announcement title', item.title);
    if (title === null) return;
    const message = window.prompt('Edit announcement message', item.message);
    if (message === null) return;
    try {
      setEditingAnnouncementId(item._id);
      await apiRequest(`/faculty/announcements/${item._id}`, {
        method: 'PUT',
        token,
        body: { title: title.trim(), message: message.trim(), priority: item.priority }
      });
      toast.success('Announcement updated');
      await loadClassData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update announcement');
    } finally {
      setEditingAnnouncementId(null);
    }
  };

  const handleDeleteAnnouncement = async (item: AnnouncementItem) => {
    const { token } = getSessionAuth();
    if (!token) return;
    if (!window.confirm(`Delete announcement "${item.title}"?`)) return;
    try {
      setEditingAnnouncementId(item._id);
      await apiRequest(`/faculty/announcements/${item._id}`, { method: 'DELETE', token });
      toast.success('Announcement deleted');
      await loadClassData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete announcement');
    } finally {
      setEditingAnnouncementId(null);
    }
  };

  const normalizedSearchTerm = deferredSearchTerm.trim().toLowerCase();
  const normalizedCompletionSearchTerm = deferredCompletionSearchTerm.trim().toLowerCase();

  const filteredStudents = useMemo(() => {
    if (!normalizedSearchTerm) return students;
    return students.filter((student) =>
      student.name.toLowerCase().includes(normalizedSearchTerm) ||
      (student.rollNo || '').toLowerCase().includes(normalizedSearchTerm) ||
      student.studentId.toLowerCase().includes(normalizedSearchTerm)
    );
  }, [students, normalizedSearchTerm]);

  const filteredCompletionStudents = useMemo(() => {
    if (!normalizedCompletionSearchTerm) return students;
    return students.filter((student) =>
      student.name.toLowerCase().includes(normalizedCompletionSearchTerm) ||
      (student.rollNo || '').toLowerCase().includes(normalizedCompletionSearchTerm) ||
      student.studentId.toLowerCase().includes(normalizedCompletionSearchTerm)
    );
  }, [students, normalizedCompletionSearchTerm]);

  const mappedClassLabel = assignedClasses.map((item) => `${item.class}-${item.section}`).join(', ');

  return (
    <div className="min-h-screen bg-gray-50 animate-fadeIn">
      <Navigation role="Faculty" onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto p-6 animate-slideUp">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Class Management</h1>
          <p className="text-gray-600">Manage marks, attendance, assignments, and announcements for mapped classes only.</p>
          {loading && <p className="text-sm text-indigo-600 mt-2">Loading class data...</p>}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 card-hover">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Select Class</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="class" className="block text-sm font-medium text-gray-700 mb-2">Class</label>
              <select id="class" value={selectedClass ?? ''} onChange={(e) => handleClassChange(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white">
                {availableClasses.map((classNum) => <option key={classNum} value={classNum}>Class {classNum}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="section" className="block text-sm font-medium text-gray-700 mb-2">Section</label>
              <select id="section" value={selectedSection ?? ''} onChange={(e) => setSelectedSection(e.target.value as 'A' | 'B')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white">
                {availableSections.map((section) => <option key={section} value={section}>Section {section}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <p className="text-sm text-indigo-900"><span className="font-semibold">Mapped Class-Sections:</span> {mappedClassLabel || '-'}</p>
          </div>

          {teacher && selectedClass && selectedSection && (
            <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-sm text-emerald-900"><span className="font-semibold">Faculty:</span> {teacher.name} | {teacher.subject} |<span className="ml-2">Class {selectedClass}-{selectedSection}: {students.length} Students</span></p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden card-hover">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              <button type="button" onClick={() => setActiveTab('marks')} className={`flex items-center gap-2 px-6 py-4 font-medium transition-all ${activeTab === 'marks' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'}`}><FileText className="w-5 h-5" />Mark Entry</button>
              <button type="button" onClick={() => setActiveTab('attendance')} className={`flex items-center gap-2 px-6 py-4 font-medium transition-all ${activeTab === 'attendance' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'}`}><Calendar className="w-5 h-5" />Attendance</button>
              <button type="button" onClick={() => setActiveTab('assignments')} className={`flex items-center gap-2 px-6 py-4 font-medium transition-all ${activeTab === 'assignments' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'}`}><FileText className="w-5 h-5" />Assignments</button>
              <button type="button" onClick={() => setActiveTab('announcements')} className={`flex items-center gap-2 px-6 py-4 font-medium transition-all ${activeTab === 'announcements' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'}`}><MessageSquare className="w-5 h-5" />Announcements</button>
              <button type="button" onClick={() => setActiveTab('completion')} className={`flex items-center gap-2 px-6 py-4 font-medium transition-all ${activeTab === 'completion' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'}`}><CheckCircle className="w-5 h-5" />Assignment Tracker</button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'marks' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label htmlFor="exam" className="block text-sm font-medium text-gray-700 mb-2">Exam</label>
                    <select id="exam" value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)} disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none bg-gray-50 text-gray-700">
                      <option value={selectedExam}>{selectedExam}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">Faculty Subject</label>
                    <input id="subject" value={facultySubject} readOnly className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700" />
                  </div>
                  <div className="flex items-end">
                    <button type="button" onClick={handleBulkMarkEntry} className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-300 font-medium glow-button-subtle"><Upload className="w-4 h-4" />Bulk Upload CSV</button>
                  </div>
                </div>
                <div className={`mb-4 rounded-lg border p-4 ${examWindow?.isMarkEntryOpen ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <p className={`text-sm font-semibold ${examWindow?.isMarkEntryOpen ? 'text-emerald-800' : 'text-red-800'}`}>
                    {selectedExam} Mark Entry: {examWindow?.isMarkEntryOpen ? 'Open' : 'Closed'}
                  </p>
                  <p className="text-xs mt-1 text-gray-700">
                    Deadline: {formatDateTimeFixed(examWindow?.markEntryDeadlineAt)}
                  </p>
                  {!examWindow?.isMarkEntryOpen && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input type="datetime-local" value={extensionRequestedUntil} onChange={(e) => setExtensionRequestedUntil(e.target.value)} className="px-3 py-2 border border-red-200 rounded-lg bg-white" />
                      <input type="text" value={extensionReason} onChange={(e) => setExtensionReason(e.target.value)} placeholder="Reason for extension" className="px-3 py-2 border border-red-200 rounded-lg bg-white" />
                      <button type="button" onClick={handleRequestExtension} disabled={examWindow?.pendingRequest?.status === 'pending'} className="crud-btn crud-edit disabled:opacity-60">
                        {examWindow?.pendingRequest?.status === 'pending' ? 'Extension Requested' : 'Request Extension'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" placeholder="Search by name, roll number or student id..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                  </div>
                </div>

                <div className="dashboard-table-wrap mb-6">
                  <table className="dashboard-table min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">Roll No</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase min-w-[140px]">Exam Status</th>
                        {subjects.map((subject) => <th key={subject} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase min-w-[140px]">{subject}</th>)}
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase min-w-[110px]">Average</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredStudents.map((student) => {
                        const avg = getStudentAverage(student.studentId);
                        return (
                          <tr key={student._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">{student.rollNo || student.studentId}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{student.name}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => setAbsentByStudent((prev) => ({ ...prev, [student.studentId]: !prev[student.studentId] }))}
                                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${absentByStudent[student.studentId] ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}
                              >
                                {absentByStudent[student.studentId] ? 'Absent' : 'Present'}
                              </button>
                            </td>
                            {subjects.map((subject) => {
                              const value = marksByStudent[student.studentId]?.[subject] ?? '';
                              const isAbsent = Boolean(absentByStudent[student.studentId]);
                              return (
                                <td key={`${student.studentId}-${subject}`} className="px-4 py-3 text-center">
                                  <input type="number" min="0" max="100" value={isAbsent ? '' : value} disabled={isAbsent || !examWindow?.isMarkEntryOpen} onChange={(e) => handleSubjectMarkChange(student.studentId, subject, e.target.value)} className="w-24 mx-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-center disabled:bg-gray-100" placeholder={isAbsent ? 'AB' : '0-100'} />
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-center"><span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${avg >= 75 ? 'bg-green-100 text-green-700' : avg >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{avg.toFixed(1)}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => { setMarksByStudent(initialMarksByStudent); setAbsentByStudent(initialAbsentByStudent); }} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-300 font-medium glow-button-subtle">Reset Changes</button>
                  <button type="button" onClick={handleSaveMarks} disabled={!examWindow?.isMarkEntryOpen} className="crud-btn crud-save flex items-center gap-2 disabled:opacity-60"><Save className="w-4 h-4" />Save Subject-wise Marks</button>
                </div>
              </div>
            )}

            {activeTab === 'attendance' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <input type="date" id="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                  </div>
                  <div className="flex items-end gap-2">
                    <button type="button" onClick={() => handleMarkAll('present')} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-300 font-medium glow-button"><CheckCircle className="w-4 h-4" />Mark All Present</button>
                    <button type="button" onClick={() => handleMarkAll('absent')} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-300 font-medium glow-button"><XCircle className="w-4 h-4" />Mark All Absent</button>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" placeholder="Search by name, roll number or student id..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                  </div>
                </div>

                <div className="dashboard-table-wrap mb-6">
                  <table className="dashboard-table w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll No</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredStudents.map((student) => (
                        <tr key={student._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.rollNo || student.studentId}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{student.name}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-2">
                              <button type="button" onClick={() => setAttendance({ ...attendance, [student.studentId]: 'present' })} className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${attendance[student.studentId] === 'present' ? 'bg-green-600 text-white glow-button' : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700'}`}>Present</button>
                              <button type="button" onClick={() => setAttendance({ ...attendance, [student.studentId]: 'absent' })} className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${attendance[student.studentId] === 'absent' ? 'bg-red-600 text-white glow-button' : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700'}`}>Absent</button>
                              <button type="button" onClick={() => setAttendance({ ...attendance, [student.studentId]: 'late' })} className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${attendance[student.studentId] === 'late' ? 'bg-amber-600 text-white glow-button' : 'bg-gray-100 text-gray-700 hover:bg-amber-100 hover:text-amber-700'}`}>Late</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div><p className="text-sm text-blue-600 mb-1">Present</p><p className="text-2xl font-bold text-green-700">{Object.values(attendance).filter((a) => a === 'present').length}</p></div>
                    <div><p className="text-sm text-blue-600 mb-1">Absent</p><p className="text-2xl font-bold text-red-700">{Object.values(attendance).filter((a) => a === 'absent').length}</p></div>
                    <div><p className="text-sm text-blue-600 mb-1">Late</p><p className="text-2xl font-bold text-amber-700">{Object.values(attendance).filter((a) => a === 'late').length}</p></div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setAttendance(students.reduce((acc, student) => ({ ...acc, [student.studentId]: 'present' }), {} as Record<string, AttendanceStatus>))} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-300 font-medium glow-button-subtle">Reset</button>
                  <button type="button" onClick={handleSaveAttendance} className="crud-btn crud-save flex items-center gap-2"><Save className="w-4 h-4" />Save Attendance</button>
                </div>
              </div>
            )}

            {activeTab === 'assignments' && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Assignment Management</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <input value={assignmentForm.title} onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })} placeholder="Title" className="px-4 py-2 border border-gray-300 rounded-lg" />
                  <input value={facultySubject} readOnly className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700" />
                  <input type="date" value={assignmentForm.dueDate} onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })} className="px-4 py-2 border border-gray-300 rounded-lg" />
                  <input value={assignmentForm.description} onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })} placeholder="Description (optional)" className="px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="mb-5 border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-800">Target Class-Sections ({assignmentTargets.length}/{targetOptions.length})</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setAssignmentTargets(currentTargetKey && targetOptions.some((item) => item.key === currentTargetKey) ? [currentTargetKey] : assignmentTargets)} className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-white">Current</button>
                      <button type="button" onClick={() => setAssignmentTargets(targetOptions.map((item) => item.key))} className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-white">All</button>
                    </div>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-sm text-indigo-700 font-medium">Select target classes</summary>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {targetOptions.map((option) => {
                        const checked = assignmentTargets.includes(option.key);
                        const disableUncheck = checked && assignmentTargets.length === 1;
                        return (
                          <label key={`assignment-target-${option.key}`} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                            <input type="checkbox" checked={checked} disabled={disableUncheck} onChange={() => toggleTarget(option.key, setAssignmentTargets)} />
                            <span className="text-sm text-gray-700">{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </details>
                </div>
                <button type="button" onClick={handleCreateAssignment} className="crud-btn crud-create mb-6">Create New Assignment</button>
                <div className="space-y-3">
                  {assignments.map((item) => (
                    <div key={item._id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-gray-900">{item.title} ({item.subject})</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleEditAssignment(item)} disabled={editingAssignmentId === item._id} className="crud-btn crud-edit text-xs px-3 py-1 disabled:opacity-60">Edit</button>
                          <button type="button" onClick={() => handleDeleteAssignment(item)} disabled={editingAssignmentId === item._id} className="crud-btn crud-delete text-xs px-3 py-1 disabled:opacity-60">Delete</button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{item.description || 'No description'}</p>
                      <p className="text-xs text-gray-500 mt-1">Due: {new Date(item.dueDate).toLocaleDateString()} | Status: {item.status}</p>
                    </div>
                  ))}
                  {!assignments.length && <p className="text-gray-600 text-sm">No assignments for this mapped class-section yet.</p>}
                </div>
              </div>
            )}

            {activeTab === 'announcements' && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Class Announcements</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <input value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} placeholder="Title" className="px-4 py-2 border border-gray-300 rounded-lg" />
                  <select value={announcementForm.priority} onChange={(e) => setAnnouncementForm({ ...announcementForm, priority: e.target.value as 'low' | 'normal' | 'high' })} className="px-4 py-2 border border-gray-300 rounded-lg bg-white">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                  <textarea value={announcementForm.message} onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })} placeholder="Message" className="md:col-span-2 px-4 py-2 border border-gray-300 rounded-lg" rows={4} />
                </div>
                <div className="mb-5 border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-800">Target Class-Sections ({announcementTargets.length}/{targetOptions.length})</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setAnnouncementTargets(currentTargetKey && targetOptions.some((item) => item.key === currentTargetKey) ? [currentTargetKey] : announcementTargets)} className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-white">Current</button>
                      <button type="button" onClick={() => setAnnouncementTargets(targetOptions.map((item) => item.key))} className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-white">All</button>
                    </div>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-sm text-indigo-700 font-medium">Select target classes</summary>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {targetOptions.map((option) => {
                        const checked = announcementTargets.includes(option.key);
                        const disableUncheck = checked && announcementTargets.length === 1;
                        return (
                          <label key={`announcement-target-${option.key}`} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                            <input type="checkbox" checked={checked} disabled={disableUncheck} onChange={() => toggleTarget(option.key, setAnnouncementTargets)} />
                            <span className="text-sm text-gray-700">{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </details>
                </div>
                <button type="button" onClick={handleCreateAnnouncement} className="crud-btn crud-create mb-6">Create New Announcement</button>
                <div className="space-y-3">
                  {announcements.map((item) => (
                    <div key={item._id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-900">{item.title}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${item.priority === 'high' ? 'bg-red-100 text-red-700' : item.priority === 'low' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{item.priority}</span>
                          <button type="button" onClick={() => handleEditAnnouncement(item)} disabled={editingAnnouncementId === item._id} className="crud-btn crud-edit text-xs px-3 py-1 disabled:opacity-60">Edit</button>
                          <button type="button" onClick={() => handleDeleteAnnouncement(item)} disabled={editingAnnouncementId === item._id} className="crud-btn crud-delete text-xs px-3 py-1 disabled:opacity-60">Delete</button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{item.message}</p>
                      <p className="text-xs text-gray-500 mt-1">Posted: {new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                  {!announcements.length && <p className="text-gray-600 text-sm">No announcements for this mapped class-section yet.</p>}
                </div>
              </div>
            )}

            {activeTab === 'completion' && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Assignment Completion Tracker</h3>
                <div className="border border-gray-200 rounded-xl p-4 mb-6 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="md:col-span-2">
                      <label htmlFor="assignment-progress" className="block text-sm font-medium text-gray-700 mb-2">Select Assignment</label>
                      <select id="assignment-progress" value={selectedProgressAssignmentId} onChange={(e) => setSelectedProgressAssignmentId(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white">
                        {assignments.map((item) => (
                          <option key={item._id} value={item._id}>{item.title} - Due {new Date(item.dueDate).toLocaleDateString()}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button type="button" onClick={handleSaveAssignmentProgress} disabled={!selectedProgressAssignmentId || !students.length} className="crud-btn crud-save w-full disabled:opacity-60">Save Completion Status</button>
                    </div>
                  </div>
                  {assignments.length > 0 && (
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search in tracker by name, roll number or student id..."
                          value={completionSearchTerm}
                          onChange={(e) => setCompletionSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                  )}
                  {assignments.length > 0 && (
                    <div className="dashboard-table-wrap">
                      <table className="dashboard-table w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Roll No</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Assignment Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {filteredCompletionStudents.map((student) => {
                            const status = assignmentProgress[student.studentId] || 'incomplete';
                            return (
                              <tr key={`assignment-progress-${student.studentId}`}>
                                <td className="px-4 py-2 text-sm text-gray-800">{student.rollNo || student.studentId}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">{student.name}</td>
                                <td className="px-4 py-2">
                                  <div className="flex justify-center gap-2">
                                    <button type="button" onClick={() => setAssignmentProgress((prev) => ({ ...prev, [student.studentId]: 'complete' }))} className={`px-3 py-1 rounded-lg text-sm ${status === 'complete' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700'}`}>Complete</button>
                                    <button type="button" onClick={() => setAssignmentProgress((prev) => ({ ...prev, [student.studentId]: 'incomplete' }))} className={`px-3 py-1 rounded-lg text-sm ${status === 'incomplete' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700'}`}>Incomplete</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {!assignments.length && <p className="text-sm text-gray-600">Create an assignment to start tracking completion status.</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

