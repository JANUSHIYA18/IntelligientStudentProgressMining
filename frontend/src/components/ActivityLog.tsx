import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Activity, User, FileText, LogIn, Upload, Download, Clock } from 'lucide-react';
import { Navigation } from './Navigation';
import { apiRequest, getSessionAuth } from '../api/client';
import { triggerBase64Download, type DownloadPayload } from '../api/download';

type ActivityItem = {
  _id: string;
  actorName: string;
  action: string;
  details?: string;
  type: string;
  createdAt: string;
};

export function ActivityLog() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ActivityItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const { token, user } = getSessionAuth();
      if (!token || !user) {
        navigate('/');
        return;
      }
      try {
        const data = await apiRequest<ActivityItem[]>('/admin/activities?limit=100', { token });
        setLogs(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load activity logs');
      }
    };

    load();
  }, [navigate]);

  const stats = useMemo(() => ({
    total: logs.length,
    logins: logs.filter((l) => l.type === 'login').length,
    updates: logs.filter((l) => l.type === 'update').length,
    downloads: logs.filter((l) => l.type === 'download').length,
  }), [logs]);

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    navigate('/');
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'login': return <LogIn className="w-4 h-4 text-blue-600" />;
      case 'update': return <FileText className="w-4 h-4 text-green-600" />;
      case 'download': return <Download className="w-4 h-4 text-purple-600" />;
      case 'upload': return <Upload className="w-4 h-4 text-indigo-600" />;
      case 'view': return <User className="w-4 h-4 text-amber-600" />;
      case 'generate': return <FileText className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'login': return 'bg-blue-100 text-blue-700';
      case 'update': return 'bg-green-100 text-green-700';
      case 'download': return 'bg-purple-100 text-purple-700';
      case 'upload': return 'bg-indigo-100 text-indigo-700';
      case 'view': return 'bg-amber-100 text-amber-700';
      case 'generate': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleExportLogs = async () => {
    const { token } = getSessionAuth();
    if (!token) return;

    try {
      const payload = await apiRequest<DownloadPayload>('/admin/activities/export?format=csv&limit=2000', { token });
      triggerBase64Download(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export logs');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 animate-fadeIn">
      <Navigation role="Admin" onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto p-6 animate-slideUp">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Activity Log</h1>
          <p className="text-gray-600">This module tracks system usage for transparency.</p>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 card-hover"><p className="text-sm text-gray-600 mb-1">Today's Activities</p><p className="text-2xl font-bold text-gray-900">{stats.total}</p></div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 card-hover"><p className="text-sm text-gray-600 mb-1">Logins</p><p className="text-2xl font-bold text-blue-600">{stats.logins}</p></div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 card-hover"><p className="text-sm text-gray-600 mb-1">Updates</p><p className="text-2xl font-bold text-amber-600">{stats.updates}</p></div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 card-hover"><p className="text-sm text-gray-600 mb-1">Downloads</p><p className="text-2xl font-bold text-purple-600">{stats.downloads}</p></div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 card-hover">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
            <button onClick={handleExportLogs} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm glow-button-subtle"><Download className="w-4 h-4" />Export Logs</button>
          </div>

          <div className="divide-y divide-gray-200">
            {logs.map((log) => (
              <div key={log._id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex-shrink-0">{getActivityIcon(log.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1"><p className="font-medium text-gray-900">{log.action}</p><span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeBadge(log.type)}`}>{log.type}</span></div>
                    <p className="text-sm text-gray-600 mb-1">{log.actorName}</p>
                    {log.details && <p className="text-xs text-gray-600 mb-1">{log.details}</p>}
                    <div className="flex items-center gap-1 text-xs text-gray-500"><Clock className="w-3 h-3" />{new Date(log.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 mt-6 card-hover">
          <h3 className="font-medium text-indigo-900 mb-2">Activity Logging Policy</h3>
          <ul className="text-sm text-indigo-700 space-y-1">
            <li>- All user actions are automatically logged for security and audit purposes</li>
            <li>- Logs are retained for 90 days and then archived</li>
            <li>- Only administrators have access to view complete activity logs</li>
            <li>- Sensitive data is encrypted and protected according to data privacy regulations</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
