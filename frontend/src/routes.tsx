import { Suspense, lazy, type ComponentType } from "react";
import { createBrowserRouter } from "react-router";

const LoginPage = lazy(() => import("./components/Login").then((module) => ({ default: module.Login })));
const AdminDashboardPage = lazy(() => import("./components/AdminDashboard").then((module) => ({ default: module.AdminDashboard })));
const FacultyDashboardPage = lazy(() => import("./components/FacultyDashboard").then((module) => ({ default: module.FacultyDashboard })));
const StudentDashboardPage = lazy(() => import("./components/StudentDashboard").then((module) => ({ default: module.StudentDashboard })));
const GraphsPage = lazy(() => import("./components/Graphs").then((module) => ({ default: module.Graphs })));
const RecommendationsPage = lazy(() => import("./components/Recommendations").then((module) => ({ default: module.Recommendations })));
const ReportsPage = lazy(() => import("./components/Reports").then((module) => ({ default: module.Reports })));
const ActivityLogPage = lazy(() => import("./components/ActivityLog").then((module) => ({ default: module.ActivityLog })));
const TeacherReportsPage = lazy(() => import("./components/TeacherReports").then((module) => ({ default: module.TeacherReports })));
const ClassManagementPage = lazy(() => import("./components/ClassManagement").then((module) => ({ default: module.ClassManagement })));

const PageLoader = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
    <div className="w-full max-w-md rounded-2xl border border-indigo-100 bg-white/95 p-6 shadow-sm">
      <div className="h-3 w-32 rounded-full bg-indigo-100" />
      <div className="mt-4 h-10 rounded-xl bg-gradient-to-r from-indigo-100 via-purple-100 to-blue-100 animate-pulse" />
      <div className="mt-3 h-24 rounded-xl bg-gray-100 animate-pulse" />
    </div>
  </div>
);

const withSuspense = (Component: ComponentType) => {
  function SuspendedRoute() {
    return (
      <Suspense fallback={<PageLoader />}>
        <Component />
      </Suspense>
    );
  }

  return SuspendedRoute;
};

export const router = createBrowserRouter([
  {
    path: "/",
    Component: withSuspense(LoginPage),
  },
  {
    path: "/admin",
    Component: withSuspense(AdminDashboardPage),
  },
  {
    path: "/faculty",
    Component: withSuspense(FacultyDashboardPage),
  },
  {
    path: "/class-management",
    Component: withSuspense(ClassManagementPage),
  },
  {
    path: "/teacher-reports",
    Component: withSuspense(TeacherReportsPage),
  },
  {
    path: "/student",
    Component: withSuspense(StudentDashboardPage),
  },
  {
    path: "/graphs",
    Component: withSuspense(GraphsPage),
  },
  {
    path: "/recommendations",
    Component: withSuspense(RecommendationsPage),
  },
  {
    path: "/reports",
    Component: withSuspense(ReportsPage),
  },
  {
    path: "/activity-log",
    Component: withSuspense(ActivityLogPage),
  },
]);
