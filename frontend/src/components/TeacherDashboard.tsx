import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Save, Upload, UserCheck, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Navigation } from './Navigation';

interface Student {
  id: string;
  name: string;
  rollNo: string;
  marks: string;
  attendance: boolean;
  parentName: string;
  parentContact: string;
}

const initialStudents: Student[] = [
  { id: '1', name: 'Alice Johnson', rollNo: 'CS001', marks: '85', attendance: true, parentName: 'Mr. Robert Johnson', parentContact: '+1 234-567-8901' },
  { id: '2', name: 'Bob Smith', rollNo: 'CS002', marks: '72', attendance: true, parentName: 'Mrs. Sarah Smith', parentContact: '+1 234-567-8902' },
  { id: '3', name: 'Charlie Brown', rollNo: 'CS003', marks: '68', attendance: false, parentName: 'Mr. David Brown', parentContact: '+1 234-567-8903' },
  { id: '4', name: 'Diana Prince', rollNo: 'CS004', marks: '92', attendance: true, parentName: 'Mrs. Maria Prince', parentContact: '+1 234-567-8904' },
  { id: '5', name: 'Edward Norton', rollNo: 'CS005', marks: '78', attendance: true, parentName: 'Mr. James Norton', parentContact: '+1 234-567-8905' },
];

export function TeacherDashboard() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [selectedClass, setSelectedClass] = useState('Class 10');
  const [selectedSection, setSelectedSection] = useState('Section A');
  const [selectedSubject, setSelectedSubject] = useState('Mathematics');
  const [selectedExamType, setSelectedExamType] = useState('Unit Test');
  const [activeTab, setActiveTab] = useState<'marks' | 'attendance'>('marks');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(false);

  const facultyProfile = {
    name: 'Dr. Sarah Johnson',
    designation: 'Senior Teacher',
    department: 'Mathematics Department',
    email: 'sarah.j@school.edu',
    phone: '+1 234-567-8900',
    experience: '12 Years',
  };

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    navigate('/');
  };

  const handleMarksChange = (id: string, value: string) => {
    setStudents(students.map(s => 
      s.id === id ? { ...s, marks: value } : s
    ));
  };

  const handleAttendanceToggle = (id: string) => {
    setStudents(students.map(s => 
      s.id === id ? { ...s, attendance: !s.attendance } : s
    ));
  };

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleSaveMarks = () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      showToastMessage(`Marks for ${selectedClass} - ${selectedSection} - ${selectedSubject} saved successfully!`, 'success');
    }, 1000);
  };

  const handleSaveAttendance = () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      const presentCount = students.filter(s => s.attendance).length;
      showToastMessage(`Attendance saved! ${presentCount}/${students.length} students present`, 'success');
    }, 1000);
  };

  const handleUploadCSV = () => {
    showToastMessage('CSV upload feature will be implemented soon', 'error');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation role="Faculty" onLogout={handleLogout} />

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-lg border ${
            toastType === 'success' 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            {toastType === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <p className={`font-medium ${
              toastType === 'success' ? 'text-green-900' : 'text-red-900'
            }`}>
              {toastMessage}
            </p>
            <button onClick={() => setShowToast(false)}>
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6">
        {/* Teacher Profile Section */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-6 mb-6 text-white">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-10 h-10 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-1">{facultyProfile.name}</h2>
              <p className="text-indigo-100 mb-3">{facultyProfile.designation} | {facultyProfile.department}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-indigo-200">Email:</span>
                  <span>{facultyProfile.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-indigo-200">Phone:</span>
                  <span>{facultyProfile.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-indigo-200">Experience:</span>
                  <span>{facultyProfile.experience}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Teacher Dashboard</h1>
          <p className="text-gray-600">Faculty enter marks and attendance through this interface.</p>
        </div>

        {/* Selection Panel */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Select Class Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="class" className="block text-sm font-medium text-gray-700 mb-2">
                Class
              </label>
              <select
                id="class"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              >
                <option value="Class 6">Class 6</option>
                <option value="Class 7">Class 7</option>
                <option value="Class 8">Class 8</option>
                <option value="Class 9">Class 9</option>
                <option value="Class 10">Class 10</option>
              </select>
            </div>

            <div>
              <label htmlFor="section" className="block text-sm font-medium text-gray-700 mb-2">
                Section
              </label>
              <select
                id="section"
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              >
                <option value="Section A">Section A</option>
                <option value="Section B">Section B</option>
              </select>
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                Subject
              </label>
              <select
                id="subject"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              >
                <option value="Mathematics">Mathematics</option>
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="English">English</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Biology">Biology</option>
                <option value="History">History</option>
              </select>
            </div>

            <div>
              <label htmlFor="examType" className="block text-sm font-medium text-gray-700 mb-2">
                Exam Type
              </label>
              <select
                id="examType"
                value={selectedExamType}
                onChange={(e) => setSelectedExamType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              >
                <option value="Unit Test">Unit Test</option>
                <option value="Mid Term">Mid Term</option>
                <option value="Final Exam">Final Exam</option>
                <option value="Assignment">Assignment</option>
              </select>
            </div>
          </div>

          <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <p className="text-sm text-indigo-900">
              <strong>Selected:</strong> {selectedClass} - {selectedSection} - {selectedSubject} - {selectedExamType}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-t-xl shadow-sm border border-gray-200 border-b-0">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('marks')}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === 'marks'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Enter Marks
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === 'attendance'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Mark Attendance
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 overflow-hidden">
          {activeTab === 'marks' ? (
            <>
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Student Marks Entry</h2>
                <p className="text-sm text-gray-600 mt-1">Enter marks for each student (Max: 100)</p>
              </div>
              
              <div className="overflow-x-auto table-scroll">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Roll No
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Parent/Guardian
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Marks (out of 100)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {student.rollNo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {student.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {student.parentName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {student.parentContact}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={student.marks}
                            onChange={(e) => handleMarksChange(student.id, e.target.value)}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-4">
                <button
                  onClick={handleSaveMarks}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Marks
                    </>
                  )}
                </button>
                <button
                  onClick={handleUploadCSV}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <Upload className="w-4 h-4" />
                  Upload CSV
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Student Attendance</h2>
                <p className="text-sm text-gray-600 mt-1">Mark students as present or absent</p>
              </div>
              
              <div className="overflow-x-auto table-scroll">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Roll No
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Parent/Guardian
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {student.rollNo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {student.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {student.parentName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {student.parentContact}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleAttendanceToggle(student.id)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              student.attendance
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                          >
                            {student.attendance ? 'Present' : 'Absent'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium text-gray-900">
                      {students.filter(s => s.attendance).length}/{students.length}
                    </span> students present
                  </div>
                  <button
                    onClick={handleSaveAttendance}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Attendance
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
