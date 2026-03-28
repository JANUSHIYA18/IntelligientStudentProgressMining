import { useState } from 'react';
import { apiRequest } from '../api/client';
import { useNavigate } from 'react-router';
import { LogIn, GraduationCap, BookOpen, Users, TrendingUp, Award } from 'lucide-react';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Admin' | 'Faculty' | 'Student'>('Student');
  const [errors, setErrors] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const completeLogin = (data: { token: string; user: any }) => {
    sessionStorage.setItem("user", JSON.stringify(data.user));
    sessionStorage.setItem("token", data.token);

    if (data.user.role === "Admin") {
      navigate("/admin");
    } else if (data.user.role === "Faculty") {
      navigate("/faculty");
    } else {
      navigate("/student");
    }
  };

  const validateInputs = () => {
    const newErrors = { username: '', password: '' };
    let isValid = true;
    const trimmedUsername = username.trim().toLowerCase();

    if (!trimmedUsername) {
      newErrors.username = 'Email is required';
      isValid = false;
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
      isValid = false;
    }

    if (trimmedUsername) {
      if (role === 'Student' && !/^[^@\s]+@student\.in$/i.test(trimmedUsername)) {
        newErrors.username = 'Invalid student email format';
        isValid = false;
      }

      if (role === 'Faculty' && !/^[^@\s]+@teacher\.in$/i.test(trimmedUsername)) {
        newErrors.username = 'Invalid teacher email format';
        isValid = false;
      }

      if (role === 'Admin' && trimmedUsername !== 'janushiya@admin.in') {
        newErrors.username = 'Invalid admin credentials';
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateInputs()) {
      return;
    }

    try {
      setLoading(true);

      const data = await apiRequest<{ token: string; user: any }>("/auth/login", {
        method: "POST",
        body: {
          username: username.trim().toLowerCase(),
          password,
          role
        }
      });

      completeLogin(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      setErrors((prev) => ({ ...prev, password: message }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex animate-fadeIn">
      {/* Left Side - Branding & Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-700 via-purple-700 to-indigo-800 relative overflow-hidden">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-300 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-white animate-slideUp">
          {/* Logo */}
          <div className="mb-8 flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">ProgressIQ</h1>
          </div>

          {/* Tagline */}
          <p className="text-xl text-indigo-100 mb-12 text-center max-w-md">
            Intelligent Student Progress Mining
          </p>

          {/* Illustration Area */}
          <div className="relative w-full max-w-lg">
            {/* Central Illustration Card */}
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-white/20 card-hover">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl p-6 shadow-lg transform hover:scale-105 transition-transform card-hover">
                  <Users className="w-10 h-10 text-white mb-3" />
                  <p className="text-white text-sm font-medium">480+ Students</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl p-6 shadow-lg transform hover:scale-105 transition-transform card-hover">
                  <BookOpen className="w-10 h-10 text-white mb-3" />
                  <p className="text-white text-sm font-medium">24 Classes</p>
                </div>
                <div className="bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl p-6 shadow-lg transform hover:scale-105 transition-transform card-hover">
                  <TrendingUp className="w-10 h-10 text-white mb-3" />
                  <p className="text-white text-sm font-medium">Live Analytics</p>
                </div>
                <div className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl p-6 shadow-lg transform hover:scale-105 transition-transform card-hover">
                  <Award className="w-10 h-10 text-white mb-3" />
                  <p className="text-white text-sm font-medium">AI Reports</p>
                </div>
              </div>
              
              {/* Feature Highlights */}
              <div className="space-y-3 text-white/90 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <p>Real-time Performance Tracking</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <p>AI-Powered Recommendations</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <p>Comprehensive Reports & Analytics</p>
                </div>
              </div>
            </div>

            {/* Floating Elements */}
            <div className="absolute -top-6 -right-6 w-20 h-20 bg-yellow-400 rounded-full opacity-80 animate-bounce"></div>
            <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-pink-400 rounded-full opacity-80 animate-pulse"></div>
          </div>

          {/* Footer Text */}
          <p className="mt-12 text-indigo-200 text-sm text-center max-w-md">
            School Edition - Empowering educators with data-driven insights for student success
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md animate-slideUp">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mb-4 shadow-lg">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              ProgressIQ
            </h1>
            <p className="text-gray-600 text-sm">Intelligent Student Progress Mining</p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 card-hover border border-gray-100">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back!</h2>
              <p className="text-gray-600 text-sm">Please enter your credentials to continue</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Username/Email Field */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setErrors({ ...errors, username: '' });
                  }}
                  className={`w-full px-4 py-3 border ${errors.username ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all`}
                  placeholder="Enter your email"
                  disabled={loading}
                />
                {errors.username && (
                  <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                    <span>!</span> {errors.username}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors({ ...errors, password: '' });
                  }}
                  className={`w-full px-4 py-3 border ${errors.password ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all`}
                  placeholder="Enter your password"
                  disabled={loading}
                />
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                    <span>!</span> {errors.password}
                  </p>
                )}
              </div>

              {/* Role Selection */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Role
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'Admin' | 'Faculty' | 'Student')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white transition-all appearance-none cursor-pointer"
                  disabled={loading}
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="Student">Student</option>
                  <option value="Faculty">Teacher</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 flex items-center justify-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl glow-button transform active:scale-95"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Logging in...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Login to ProgressIQ
                  </>
                )}
              </button>
            </form>

            {/* Footer Note */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                Protected by ProgressIQ Security
              </p>
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Need help? <a href="#" className="text-indigo-600 hover:text-indigo-700 font-medium">Contact Support</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


