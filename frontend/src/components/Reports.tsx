import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { FileDown, FileText, Download, X, Eye, Users, TrendingUp, BookOpen } from 'lucide-react';
import { Navigation } from './Navigation';
import { toast } from 'sonner@2.0.3';
import { apiRequest, getSessionAuth } from '../api/client';
import { triggerBase64Download, type DownloadPayload } from '../api/download';

type ReportTeacher = { teacherId: string; name: string; subject: string; classes: string[] };
type ReportStudent = { studentId: string; name: string; classSection: string; percentage: number; attendance: number; grade: string; rank: number };
type ExamReport = {
  _id: string;
  exam: string;
  year: string;
  term: string;
  dateRange: string;
  teachersInCharge: ReportTeacher[];
  students: ReportStudent[];
  overallStats: {
    totalStudents: number;
    averagePercentage: number;
    averageAttendance: number;
    passPercentage: number;
    topPerformers: number;
    needsImprovement: number;
  };
  studentStats?: {
    percentage: number;
    attendance: number;
    grade: string;
  } | null;
};

export function Reports() {
  const navigate = useNavigate();
  const { user, token } = getSessionAuth();
  const isStudent = user?.role === 'Student';
  const [examReportsData, setExamReportsData] = useState<ExamReport[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamReport | null>(null);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!token) {
        navigate('/');
        return;
      }
      try {
        const data = await apiRequest<ExamReport[]>('/reports/exams', { token });
        setExamReportsData(data);
        if (isStudent && data.length) setSelectedExamId(data[0]._id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load reports');
      }
    };

    load();
  }, [navigate, token, isStudent]);

  const selectedExamReport = useMemo(
    () => examReportsData.find((report) => report._id === selectedExamId) || null,
    [examReportsData, selectedExamId]
  );

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    navigate('/');
  };

  const handleDownloadExamPDF = async (exam: ExamReport) => {
    try {
      if (!token) throw new Error('Missing auth token');
      const scope = isStudent ? `student-exam:${exam._id}` : `exam:${exam._id}`;
      const data = await apiRequest<DownloadPayload>(`/reports/download?format=pdf&scope=${encodeURIComponent(scope)}`, { token });
      triggerBase64Download(data);
      toast.success('Report downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download request failed');
    }
  };

  const handleDownloadAllPDF = async () => {
    try {
      if (!token) throw new Error('Missing auth token');
      const scope = isStudent
        ? (selectedExamReport ? `student-exam:${selectedExamReport._id}` : `student:${user?.studentId || ''}`)
        : 'all';
      const data = await apiRequest<DownloadPayload>(`/reports/download?format=pdf&scope=${encodeURIComponent(scope)}`, { token });
      triggerBase64Download(data);
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to download PDF');
    }
  };

  const handleDownloadAllCSV = async () => {
    try {
      if (!token) throw new Error('Missing auth token');
      if (isStudent) throw new Error('CSV is not available for student report cards');
      const data = await apiRequest<DownloadPayload>('/reports/download?format=csv&scope=all', { token });
      triggerBase64Download(data);
      toast.success('CSV downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to download CSV');
    }
  };

  const getGradeColor = (grade: string) => {
    if (grade === 'A+' || grade === 'A') return 'bg-green-100 text-green-700';
    if (grade === 'A-' || grade === 'B+') return 'bg-blue-100 text-blue-700';
    if (grade === 'B' || grade === 'B-') return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-700';
    if (percentage >= 75) return 'text-blue-700';
    if (percentage >= 60) return 'text-amber-700';
    return 'text-red-700';
  };

  const totalReports = useMemo(() => (isStudent ? (examReportsData.length ? 1 : 0) : examReportsData.length), [examReportsData, isStudent]);
  const studentSummary = useMemo(() => {
    if (!isStudent || !examReportsData.length) return null;
    const rows = examReportsData.map((report) => ({
      exam: report.exam,
      percentage: report.studentStats?.percentage ?? report.overallStats.averagePercentage,
      attendance: report.studentStats?.attendance ?? report.overallStats.averageAttendance,
      grade: report.studentStats?.grade ?? '-'
    }));
    const averageScore = rows.reduce((sum, row) => sum + row.percentage, 0) / rows.length;
    const averageAttendance = rows.reduce((sum, row) => sum + row.attendance, 0) / rows.length;
    const strongest = [...rows].sort((a, b) => b.percentage - a.percentage)[0];
    const weakest = [...rows].sort((a, b) => a.percentage - b.percentage)[0];
    const trend = rows.length >= 2 ? rows[rows.length - 1].percentage - rows[0].percentage : 0;
    return {
      averageScore: Number(averageScore.toFixed(1)),
      averageAttendance: Number(averageAttendance.toFixed(1)),
      strongest,
      weakest,
      trend
    };
  }, [examReportsData, isStudent]);

  return (
    <div className="min-h-screen bg-gray-50 animate-fadeIn">
      <Navigation role={user?.role || 'Student'} onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto p-6 animate-slideUp">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Academic Reports</h1>
          <p className="text-gray-600">{isStudent ? 'View and download your exam-wise report cards' : user?.role === 'Admin' ? 'Comprehensive exam-wise reports with teacher and student details' : 'Reports provide downloadable academic summaries'}</p>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>

        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 mb-6 text-white card-hover">
          <h2 className="text-xl font-bold mb-2">{isStudent ? 'Download My Report Card' : 'Download Complete Academic Record'}</h2>
          <p className="text-indigo-100 text-sm mb-4">Reports available: {totalReports}</p>
          {isStudent && (
            <div className="mb-4">
              <label htmlFor="student-exam-select" className="block text-sm text-indigo-100 mb-2">Select Exam</label>
              <select
                id="student-exam-select"
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full md:w-[360px] px-4 py-2 rounded-lg border border-white/30 bg-white/10 text-white outline-none"
              >
                {examReportsData.map((report) => (
                  <option key={report._id} value={report._id} className="text-gray-900">
                    {report.exam} | {report.term} | {report.year}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button onClick={handleDownloadAllPDF} className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-lg hover:bg-gray-100 transition-all duration-300 font-medium glow-button"><FileText className="w-5 h-5" />{isStudent ? 'Download Selected Exam PDF' : 'Download PDF'}</button>
            {!isStudent && (
              <button onClick={handleDownloadAllCSV} className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur text-white border border-white/30 rounded-lg hover:bg-white/20 transition-all duration-300 font-medium glow-button-subtle"><FileDown className="w-5 h-5" />Download CSV</button>
            )}
          </div>
        </div>

        {isStudent && studentSummary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200"><p className="text-xs text-gray-500 mb-1">Avg Score</p><p className="text-2xl font-bold text-indigo-700">{studentSummary.averageScore}%</p></div>
            <div className="bg-white p-4 rounded-xl border border-gray-200"><p className="text-xs text-gray-500 mb-1">Avg Attendance</p><p className="text-2xl font-bold text-blue-700">{studentSummary.averageAttendance}%</p></div>
            <div className="bg-white p-4 rounded-xl border border-gray-200"><p className="text-xs text-gray-500 mb-1">Best Exam</p><p className="text-base font-bold text-green-700">{studentSummary.strongest.exam}</p><p className="text-sm text-gray-600">{studentSummary.strongest.percentage}% ({studentSummary.strongest.grade})</p></div>
            <div className="bg-white p-4 rounded-xl border border-gray-200"><p className="text-xs text-gray-500 mb-1">Trend</p><p className={`text-2xl font-bold ${studentSummary.trend >= 0 ? 'text-green-700' : 'text-red-700'}`}>{studentSummary.trend >= 0 ? '+' : ''}{studentSummary.trend.toFixed(1)}%</p><p className="text-sm text-gray-600">First to latest exam</p></div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 card-hover">
          <div className="p-6 border-b border-gray-200"><h2 className="text-xl font-bold text-gray-900">Exam-wise Summary</h2><p className="text-sm text-gray-600 mt-1">{isStudent ? 'Only your exam reports are shown here' : 'Click on any exam to view detailed report with teachers and students'}</p></div>

          <div className="divide-y divide-gray-200">
            {examReportsData.map((report) => (
              <div key={report._id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-4"><div><h3 className="text-lg font-bold text-gray-900">{report.exam}</h3><p className="text-sm text-gray-600">{report.term} | {report.dateRange}</p></div><span className={`px-4 py-2 rounded-full text-sm font-medium ${(isStudent ? (report.studentStats?.percentage || report.overallStats.averagePercentage) : report.overallStats.averagePercentage) >= 85 ? 'bg-green-100 text-green-700' : (isStudent ? (report.studentStats?.percentage || report.overallStats.averagePercentage) : report.overallStats.averagePercentage) >= 75 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{isStudent ? (report.studentStats?.percentage ?? report.overallStats.averagePercentage) : report.overallStats.averagePercentage}% {isStudent ? 'Score' : 'Average'}</span></div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-blue-50 p-3 rounded-lg"><p className="text-xs text-blue-600 mb-1">{isStudent ? 'Your Grade' : 'Total Students'}</p><p className="text-xl font-bold text-blue-700">{isStudent ? (report.studentStats?.grade || '-') : report.overallStats.totalStudents}</p></div>
                  <div className="bg-green-50 p-3 rounded-lg"><p className="text-xs text-green-600 mb-1">{isStudent ? 'Your Score' : 'Pass Rate'}</p><p className="text-xl font-bold text-green-700">{isStudent ? `${report.studentStats?.percentage ?? report.overallStats.averagePercentage}%` : `${report.overallStats.passPercentage}%`}</p></div>
                  <div className="bg-purple-50 p-3 rounded-lg"><p className="text-xs text-purple-600 mb-1">{isStudent ? 'Attendance' : 'Top Performers'}</p><p className="text-xl font-bold text-purple-700">{isStudent ? `${report.studentStats?.attendance ?? report.overallStats.averageAttendance}%` : report.overallStats.topPerformers}</p></div>
                  <div className="bg-amber-50 p-3 rounded-lg"><p className="text-xs text-amber-600 mb-1">{isStudent ? 'Academic Year' : 'Attendance'}</p><p className="text-xl font-bold text-amber-700">{isStudent ? report.year : `${report.overallStats.averageAttendance}%`}</p></div>
                </div>

                {!isStudent && (
                  <div className="mb-4 p-4 rounded-lg border border-indigo-100 bg-indigo-50">
                    <p className="text-sm text-indigo-900 font-semibold mb-2">Detailed Exam Intelligence</p>
                    <p className="text-sm text-indigo-800">
                      This exam recorded <strong>{report.overallStats.totalStudents}</strong> student entries with
                      an average score of <strong>{report.overallStats.averagePercentage}%</strong> and attendance of
                      <strong> {report.overallStats.averageAttendance}%</strong>. The pass rate is
                      <strong> {report.overallStats.passPercentage}%</strong>, while
                      <strong> {report.overallStats.topPerformers}</strong> students are in top-performing band and
                      <strong> {report.overallStats.needsImprovement}</strong> students need targeted support.
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setSelectedExam(report)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-300 text-sm font-medium glow-button"><Eye className="w-4 h-4" />View Full Details</button>
                  <button onClick={() => handleDownloadExamPDF(report)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-all duration-300 text-sm font-medium text-gray-700 glow-button-subtle"><Download className="w-4 h-4" />Download PDF</button>
                </div>
              </div>
            ))}
            {examReportsData.length === 0 && (
              <div className="p-6">
                <p className="text-sm text-gray-600">
                  {isStudent
                    ? 'No exam report cards are available for your account yet. Once exam results are published, they will appear here.'
                    : 'No exam reports available.'}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-6 card-hover">
          <h3 className="font-bold text-blue-900 mb-2">About Reports</h3>
          <ul className="text-sm text-blue-700 space-y-1">{isStudent ? <><li>- Your dashboard shows only exams where your marks are recorded</li><li>- Each exam card can download your individual report card PDF</li><li>- Report card includes school header, grade table, and signature spaces</li></> : <><li>- Comprehensive exam reports include all teachers, students, grades, and attendance</li><li>- PDF reports contain detailed breakdowns and can be shared with stakeholders</li><li>- CSV files can be opened in Excel for custom analysis and data processing</li><li>- All reports are generated in real-time based on the latest faculty entries</li><li>- Historical reports are archived and available for download anytime</li></>}</ul>
        </div>
      </div>

      {selectedExam && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn" onClick={() => setSelectedExam(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto animate-slideUp" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-2xl sticky top-0 z-10"><div className="flex items-center justify-between"><div><h2 className="text-3xl font-bold mb-2">{selectedExam.exam} - {isStudent ? 'My Report' : 'Comprehensive Report'}</h2><p className="text-lg text-indigo-100">{selectedExam.term} ({selectedExam.dateRange})</p></div><button onClick={() => setSelectedExam(null)} className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"><X className="w-6 h-6" /></button></div></div>
            <div className="p-6">
              <div className="mb-8"><h3 className="text-xl font-bold text-gray-900 mb-4">{isStudent ? 'My Statistics' : 'Overall Statistics'}</h3><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"><div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 card-hover"><Users className="w-8 h-8 text-blue-600 mb-2" /><p className="text-sm text-blue-600 mb-1">{isStudent ? 'My Grade' : 'Total Students'}</p><p className="text-2xl font-bold text-blue-900">{isStudent ? (selectedExam.studentStats?.grade || '-') : selectedExam.overallStats.totalStudents}</p></div><div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200 card-hover"><TrendingUp className="w-8 h-8 text-green-600 mb-2" /><p className="text-sm text-green-600 mb-1">{isStudent ? 'My %' : 'Average %'}</p><p className="text-2xl font-bold text-green-900">{isStudent ? (selectedExam.studentStats?.percentage ?? selectedExam.overallStats.averagePercentage) : selectedExam.overallStats.averagePercentage}%</p></div><div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200 card-hover"><BookOpen className="w-8 h-8 text-purple-600 mb-2" /><p className="text-sm text-purple-600 mb-1">{isStudent ? 'My Attendance' : 'Pass Rate'}</p><p className="text-2xl font-bold text-purple-900">{isStudent ? (selectedExam.studentStats?.attendance ?? selectedExam.overallStats.averageAttendance) : selectedExam.overallStats.passPercentage}%</p></div><div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-xl border border-amber-200 card-hover"><TrendingUp className="w-8 h-8 text-amber-600 mb-2" /><p className="text-sm text-amber-600 mb-1">Attendance</p><p className="text-2xl font-bold text-amber-900">{selectedExam.overallStats.averageAttendance}%</p></div><div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-xl border border-emerald-200 card-hover"><Users className="w-8 h-8 text-emerald-600 mb-2" /><p className="text-sm text-emerald-600 mb-1">Top Performers</p><p className="text-2xl font-bold text-emerald-900">{selectedExam.overallStats.topPerformers}</p></div><div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200 card-hover"><Users className="w-8 h-8 text-red-600 mb-2" /><p className="text-sm text-red-600 mb-1">Need Support</p><p className="text-2xl font-bold text-red-900">{selectedExam.overallStats.needsImprovement}</p></div></div></div>

              {!isStudent && <div className="mb-8"><h3 className="text-xl font-bold text-gray-900 mb-4">Teachers In Charge</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{selectedExam.teachersInCharge.map((teacher) => (<div key={teacher.teacherId || teacher.name} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow card-hover bg-gradient-to-br from-white to-gray-50"><div className="flex items-start gap-3"><div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0"><Users className="w-6 h-6 text-indigo-600" /></div><div className="flex-1 min-w-0"><h4 className="font-bold text-gray-900 truncate">{teacher.name}</h4><p className="text-sm text-gray-600">{teacher.subject}</p><div className="flex flex-wrap gap-1 mt-2">{teacher.classes.map((cls, idx) => (<span key={idx} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">{cls}</span>))}</div></div></div></div>))}</div></div>}

              <div className="mb-6"><h3 className="text-xl font-bold text-gray-900 mb-4">{isStudent ? 'My Exam Entry' : 'Student Performance Details'}</h3><div className="dashboard-table-wrap"><table className="dashboard-table w-full"><thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white"><tr><th className="px-4 py-3 text-left font-bold">Rank</th><th className="px-4 py-3 text-left font-bold">Student ID</th><th className="px-4 py-3 text-left font-bold">Name</th><th className="px-4 py-3 text-left font-bold">Class</th><th className="px-4 py-3 text-center font-bold">Percentage</th><th className="px-4 py-3 text-center font-bold">Attendance</th><th className="px-4 py-3 text-center font-bold">Grade</th></tr></thead><tbody className="divide-y divide-gray-200">{selectedExam.students.map((student, idx) => (<tr key={student.studentId + idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}><td className="px-4 py-3"><span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${student.rank === 1 ? 'bg-yellow-100 text-yellow-700' : student.rank === 2 ? 'bg-gray-200 text-gray-700' : student.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{student.rank}</span></td><td className="px-4 py-3 font-mono text-sm text-gray-600">{student.studentId}</td><td className="px-4 py-3 font-medium text-gray-900">{student.name}</td><td className="px-4 py-3 text-gray-700">{student.classSection}</td><td className="px-4 py-3 text-center"><span className={`font-bold text-lg ${getPercentageColor(student.percentage)}`}>{student.percentage}%</span></td><td className="px-4 py-3 text-center"><span className={`font-medium ${getPercentageColor(student.attendance)}`}>{student.attendance}%</span></td><td className="px-4 py-3 text-center"><span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${getGradeColor(student.grade)}`}>{student.grade}</span></td></tr>))}</tbody></table></div></div>

              <div className="flex gap-3 justify-end border-t border-gray-200 pt-6"><button onClick={() => setSelectedExam(null)} className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-300 font-medium text-gray-700 glow-button-subtle">Close</button><button onClick={() => handleDownloadExamPDF(selectedExam)} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 font-medium glow-button"><Download className="w-5 h-5" />Download Complete PDF Report</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


