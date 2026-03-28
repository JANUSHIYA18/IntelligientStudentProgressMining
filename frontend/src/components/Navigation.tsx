import { useNavigate } from 'react-router';
import { LayoutDashboard, BarChart3, Lightbulb, FileText, Activity, LogOut, ClipboardList } from 'lucide-react';

interface NavigationProps {
  role: 'Admin' | 'Faculty' | 'Student';
  onLogout: () => void;
}

export function Navigation({ role, onLogout }: NavigationProps) {
  const navigate = useNavigate();
  let user: { name?: string } = {};
  try {
    user = JSON.parse(sessionStorage.getItem('user') || '{}');
  } catch {
    user = {};
  }
  const avatarLetter = (user?.name?.trim?.()?.charAt(0) || role.charAt(0)).toUpperCase();

  const getLinks = () => {
    if (role === 'Admin') {
      return [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
        { label: 'Graphs', icon: BarChart3, path: '/graphs' },
        { label: 'Activity Log', icon: Activity, path: '/activity-log' },
        { label: 'Reports', icon: FileText, path: '/reports' },
      ];
    } else if (role === 'Faculty') {
      return [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/faculty' },
        { label: 'Class Management', icon: ClipboardList, path: '/class-management' },
        { label: 'Graphs', icon: BarChart3, path: '/graphs' },
        { label: 'Class Reports', icon: FileText, path: '/teacher-reports' },
      ];
    } else {
      return [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/student' },
        { label: 'Graphs', icon: BarChart3, path: '/graphs' },
        { label: 'Recommendations', icon: Lightbulb, path: '/recommendations' },
        { label: 'Reports', icon: FileText, path: '/reports' },
      ];
    }
  };

  const links = getLinks();

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="font-bold text-lg sm:text-xl text-indigo-600 shrink-0">{role} Portal</div>

          <div className="flex-1 min-w-0 overflow-x-auto">
            <div className="flex items-center gap-2 sm:gap-4 min-w-max">
              {links.map((link) => (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className="flex items-center gap-2 px-3 py-2 text-sm sm:text-base text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors whitespace-nowrap"
                  title={link.label}
                >
                  <link.icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors glow-button-subtle shrink-0"
            title="Logout"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-semibold text-sm flex items-center justify-center shadow-md">
              {avatarLetter}
            </div>
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
