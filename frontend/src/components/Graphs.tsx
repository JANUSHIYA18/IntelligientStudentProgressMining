import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Navigation } from './Navigation';
import { apiRequest, getSessionAuth } from '../api/client';

type ExamPoint = { exam: string; average: number };
type SubjectPoint = { subject: string; marks: number; totalMarks: number };
type GraphsPayload = {
  examWise: ExamPoint[];
  subjectWise: SubjectPoint[];
  attendance: { presentDays: number; totalDays: number; percentage: number };
};

type FacultyStudent = {
  studentId: string;
  subjects: { name: string; marks: number; totalMarks: number }[];
};

type AssignedClass = { class: number; section: 'A' | 'B' };
type MyClassesPayload = { assignedClasses: AssignedClass[] };

type AdminClassRow = { class: string; good: number; average: number; weak: number };
type AdminDistRow = { name: string; value: number };
type GraphCachePayload = {
  studentPayload?: GraphsPayload;
  facultyStudents?: FacultyStudent[];
  adminClassRows?: AdminClassRow[];
  adminDistRows?: AdminDistRow[];
};

const GRAPH_CACHE_PREFIX = 'graphs-cache-v1';
const GRAPH_CACHE_TTL_MS = 2 * 60 * 1000;

const readGraphCache = (key: string): GraphCachePayload | null => {
  try {
    const raw = sessionStorage.getItem(`${GRAPH_CACHE_PREFIX}:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts?: number; data?: GraphCachePayload };
    if (!parsed?.ts || (Date.now() - parsed.ts) > GRAPH_CACHE_TTL_MS) return null;
    return parsed.data || null;
  } catch {
    return null;
  }
};

const writeGraphCache = (key: string, data: GraphCachePayload) => {
  try {
    sessionStorage.setItem(`${GRAPH_CACHE_PREFIX}:${key}`, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // no-op
  }
};

export function Graphs() {
  const navigate = useNavigate();
  const session = useMemo(() => getSessionAuth(), []);
  const { user, token } = session;
  const role = user?.role || 'Student';
  const studentId = user?.studentId || '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<'A' | 'B' | null>(null);
  const [assignedClasses, setAssignedClasses] = useState<AssignedClass[]>([]);

  const [studentPayload, setStudentPayload] = useState<GraphsPayload>({
    examWise: [],
    subjectWise: [],
    attendance: { presentDays: 0, totalDays: 0, percentage: 0 }
  });
  const [facultyStudents, setFacultyStudents] = useState<FacultyStudent[]>([]);
  const [adminClassRows, setAdminClassRows] = useState<AdminClassRow[]>([]);
  const [adminDistRows, setAdminDistRows] = useState<AdminDistRow[]>([]);

  const availableClasses = useMemo(() => [...new Set(assignedClasses.map((item) => item.class))].sort((a, b) => a - b), [assignedClasses]);
  const availableSections = useMemo(() => {
    if (!selectedClass) return [];
    return assignedClasses.filter((item) => item.class === selectedClass).map((item) => item.section).sort();
  }, [assignedClasses, selectedClass]);

  useEffect(() => {
    const loadMappings = async () => {
      if (!token || role !== 'Faculty') return;
      try {
        const payload = await apiRequest<MyClassesPayload>('/faculty/my-classes', { token });
        const sorted = [...payload.assignedClasses].sort((a, b) => (a.class === b.class ? a.section.localeCompare(b.section) : a.class - b.class));
        setAssignedClasses(sorted);
        if (sorted.length) {
          setSelectedClass(sorted[0].class);
          setSelectedSection(sorted[0].section);
        } else {
          setError('No class mapping found for this faculty account');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load faculty mappings');
      }
    };
    loadMappings();
  }, [token, role]);

  useEffect(() => {
    if (role !== 'Faculty' || !selectedClass || !selectedSection) return;
    if (!availableSections.includes(selectedSection)) setSelectedSection(availableSections[0] || null);
  }, [role, selectedClass, selectedSection, availableSections]);

  useEffect(() => {
    const load = async () => {
      if (!token || !user) {
        navigate('/');
        return;
      }

      try {
        const cacheKey =
          role === 'Student'
            ? `student:${studentId}`
            : role === 'Faculty'
              ? (selectedClass && selectedSection ? `faculty:${selectedClass}-${selectedSection}` : '')
              : 'admin:global';
        const cached = cacheKey ? readGraphCache(cacheKey) : null;
        if (cached) {
          if (cached.studentPayload) setStudentPayload(cached.studentPayload);
          if (cached.facultyStudents) setFacultyStudents(cached.facultyStudents);
          if (cached.adminDistRows) setAdminDistRows(cached.adminDistRows);
          if (cached.adminClassRows) setAdminClassRows(cached.adminClassRows);
          setLoading(false);
        } else {
          setLoading(true);
        }
        setError('');

        if (role === 'Student') {
          if (!studentId) throw new Error('No studentId found in session.');
          const data = await apiRequest<GraphsPayload>(`/student/${studentId}/graphs`, { token });
          setStudentPayload(data);
          writeGraphCache(cacheKey, { studentPayload: data });
        } else if (role === 'Faculty') {
          if (!selectedClass || !selectedSection) {
            setFacultyStudents([]);
            return;
          }
          if (!assignedClasses.some((item) => item.class === selectedClass && item.section === selectedSection)) {
            setFacultyStudents([]);
            return;
          }
          const rows = await apiRequest<FacultyStudent[]>(
            `/faculty/students?class=${selectedClass}&section=${selectedSection}&view=graph`,
            { token }
          );
          setFacultyStudents(rows);
          if (cacheKey) writeGraphCache(cacheKey, { facultyStudents: rows });
        } else {
          const [dist, cls] = await Promise.all([
            apiRequest<AdminDistRow[]>('/admin/performance-distribution', { token }),
            apiRequest<AdminClassRow[]>('/admin/class-performance', { token })
          ]);
          setAdminDistRows(dist);
          setAdminClassRows(cls);
          writeGraphCache(cacheKey, { adminDistRows: dist, adminClassRows: cls });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load graph data');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate, role, token, studentId, selectedClass, selectedSection]);

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    navigate('/');
  };

  const handleFacultyClassChange = (value: string) => {
    const nextClass = value ? Number(value) : null;
    if (!nextClass) {
      setSelectedClass(null);
      setSelectedSection(null);
      return;
    }
    const nextSections = assignedClasses.filter((item) => item.class === nextClass).map((item) => item.section).sort();
    const nextSection = nextSections.includes(selectedSection as 'A' | 'B') ? selectedSection : (nextSections[0] || null);
    setSelectedClass(nextClass);
    setSelectedSection(nextSection);
  };

  const facultySubjectData = useMemo(() => {
    const aggregate = new Map<string, { total: number; count: number; totalMarks: number }>();
    facultyStudents.forEach((student) => {
      student.subjects.forEach((subject) => {
        const prev = aggregate.get(subject.name) || { total: 0, count: 0, totalMarks: subject.totalMarks || 100 };
        aggregate.set(subject.name, {
          total: prev.total + Number(subject.marks || 0),
          count: prev.count + 1,
          totalMarks: subject.totalMarks || prev.totalMarks || 100
        });
      });
    });

    return Array.from(aggregate.entries()).map(([subject, value]) => ({
      subject,
      marks: Number((value.total / (value.count || 1)).toFixed(2)),
      totalMarks: value.totalMarks || 100
    }));
  }, [facultyStudents]);

  const activeSubjectData =
    role === 'Student'
      ? studentPayload.subjectWise
      : role === 'Faculty'
        ? facultySubjectData
        : adminClassRows.map((row) => {
            const total = row.good + row.average + row.weak || 1;
            const weighted = ((row.good * 85) + (row.average * 67) + (row.weak * 45)) / total;
            return { subject: row.class, marks: Number(weighted.toFixed(2)), totalMarks: 100 };
          });

  const activeExamData =
    role === 'Student'
      ? (studentPayload.examWise.length
          ? studentPayload.examWise
          : [{ exam: 'Current', average: Number((studentPayload.subjectWise.reduce((s, p) => s + (p.totalMarks ? (p.marks / p.totalMarks) * 100 : 0), 0) / (studentPayload.subjectWise.length || 1)).toFixed(2)) }])
      : role === 'Faculty'
        ? [{ exam: selectedClass && selectedSection ? `Class ${selectedClass}-${selectedSection}` : 'Mapped Class', average: Number((facultySubjectData.reduce((s, p) => s + (p.totalMarks ? (p.marks / p.totalMarks) * 100 : 0), 0) / (facultySubjectData.length || 1)).toFixed(2)) }]
        : adminClassRows.map((row) => {
            const total = row.good + row.average + row.weak || 1;
            const weighted = ((row.good * 85) + (row.average * 67) + (row.weak * 45)) / total;
            return { exam: row.class, average: Number(weighted.toFixed(2)) };
          });

  const performanceData = useMemo(() => {
    if (role === 'Admin' && adminDistRows.length) {
      const colorMap: Record<string, string> = { Good: '#10b981', Average: '#f59e0b', Weak: '#ef4444' };
      return adminDistRows.map((row) => ({ ...row, color: colorMap[row.name] || '#94a3b8' }));
    }

    const counts = activeSubjectData.reduce(
      (acc, row) => {
        const pct = row.totalMarks ? (row.marks / row.totalMarks) * 100 : 0;
        if (pct >= 75) acc.good += 1;
        else if (pct >= 60) acc.average += 1;
        else acc.weak += 1;
        return acc;
      },
      { good: 0, average: 0, weak: 0 }
    );

    return [
      { name: 'Good', value: counts.good, color: '#10b981' },
      { name: 'Average', value: counts.average, color: '#f59e0b' },
      { name: 'Weak', value: counts.weak, color: '#ef4444' }
    ];
  }, [activeSubjectData, adminDistRows, role]);

  return (
    <div className="min-h-screen bg-gray-50 animate-fadeIn">
      <Navigation role={role} onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto p-6 animate-slideUp">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Graphs & Visualization</h1>
          <p className="text-gray-600">Live performance analytics from backend API.</p>
          {loading && <p className="text-sm text-indigo-600 mt-2">Loading graphs...</p>}
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>

        {role === 'Faculty' && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="class" className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                  <select id="class" value={selectedClass ?? ''} onChange={(e) => handleFacultyClassChange(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white">
                  {availableClasses.map((classNum) => (
                    <option key={classNum} value={classNum}>Class {classNum}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="section" className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                <select id="section" value={selectedSection ?? ''} onChange={(e) => setSelectedSection(e.target.value as 'A' | 'B')} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white">
                  {availableSections.map((section) => (
                    <option key={section} value={section}>Section {section}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <p className="text-sm text-indigo-900"><span className="font-semibold">Mapped Class-Sections:</span> {assignedClasses.map((item) => `${item.class}-${item.section}`).join(', ') || '-'}</p>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 card-hover">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {role === 'Admin' ? 'Class-wise Performance Trend' : 'Exam-wise Performance Trend'}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={activeExamData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={role === 'Admin' ? 'exam' : 'exam'} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="average" stroke="#4f46e5" strokeWidth={3} name="Average %" dot={{ fill: '#4f46e5', r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 card-hover">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {role === 'Admin' ? 'Class-wise Weighted Score' : 'Subject-wise Marks'}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={activeSubjectData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="marks" fill="#4f46e5" name="Marks" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 card-hover">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Overall Performance Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={performanceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {performanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
