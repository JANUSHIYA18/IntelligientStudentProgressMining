import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Lightbulb, Users, TrendingUp, Sparkles, Activity, Target } from 'lucide-react';
import { Navigation } from './Navigation';
import { apiRequest, getSessionAuth } from '../api/client';

type RecommendationItem = {
  _id?: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  category?: string;
};

const priorityWeight = (priority: RecommendationItem['priority']) => {
  if (priority === 'high') return 90;
  if (priority === 'medium') return 70;
  return 50;
};

export function Recommendations() {
  const navigate = useNavigate();
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [error, setError] = useState('');
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [aiTriggered, setAiTriggered] = useState(false);

  useEffect(() => {
    const { token, user } = getSessionAuth();
    if (!token || !user) navigate('/');
  }, [navigate]);

  const analysis = useMemo(() => {
    const high = items.filter((item) => item.priority === 'high').length;
    const medium = items.filter((item) => item.priority === 'medium').length;
    const low = items.filter((item) => item.priority === 'low').length;
    const total = Math.max(items.length, 1);

    const urgency = Math.min(100, Math.round((high / total) * 100 + (medium / total) * 40));
    const balance = Math.max(0, Math.round(100 - Math.abs(high - low) * 18));
    const actionability = Math.min(100, Math.round(((high + medium) / total) * 85));

    return { urgency, balance, actionability, high, medium, low, total };
  }, [items]);

  const handleRunLiveRecommendations = async () => {
    const { token, user } = getSessionAuth();
    if (!token || !user?.studentId) {
      setLiveError('Student session not found.');
      return;
    }

    try {
      setAiTriggered(true);
      setLiveLoading(true);
      setLiveError('');
      setError('');
      const data = await apiRequest<RecommendationItem[]>(
        `/student/${user.studentId}/recommendations`,
        { token, bypassCache: true, cacheTtlMs: 0 }
      );
      setItems(data);
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'Failed to run live recommendations');
      setItems([]);
    } finally {
      setLiveLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    navigate('/');
  };

  const renderPlanVisual = (item: RecommendationItem, index: number) => {
    const seed = item.title.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const mode = index % 5;
    const barValues = Array.from({ length: 6 }, (_, i) => 30 + ((seed + i * 17) % 55));
    const lineValues = Array.from({ length: 7 }, (_, i) => 20 + ((seed + i * 11) % 60));
    const ringValue = priorityWeight(item.priority);

    if (mode === 0) {
      return (
        <svg viewBox="0 0 240 140" className="w-full h-36 rounded-lg bg-white border border-indigo-100">
          {barValues.map((v, i) => {
            const w = 24;
            const x = 18 + (i * 36);
            const h = Math.round((v / 100) * 100);
            const y = 120 - h;
            return <rect key={`m0-${i}`} x={x} y={y} width={w} height={h} rx="4" fill="#6366f1" opacity={0.9 - (i * 0.08)} />;
          })}
        </svg>
      );
    }

    if (mode === 1) {
      const points = lineValues.map((v, i) => `${18 + (i * 34)},${120 - Math.round((v / 100) * 90)}`).join(' ');
      return (
        <svg viewBox="0 0 240 140" className="w-full h-36 rounded-lg bg-white border border-indigo-100">
          <polyline points={points} fill="none" stroke="#4f46e5" strokeWidth="3" />
          <polygon points={`${points} 222,120 18,120`} fill="rgba(79,70,229,0.2)" />
        </svg>
      );
    }

    if (mode === 2) {
      const circumference = 2 * Math.PI * 42;
      const dash = (ringValue / 100) * circumference;
      return (
        <svg viewBox="0 0 240 140" className="w-full h-36 rounded-lg bg-white border border-indigo-100">
          <circle cx="120" cy="70" r="42" fill="none" stroke="#e0e7ff" strokeWidth="12" />
          <circle cx="120" cy="70" r="42" fill="none" stroke="#4f46e5" strokeWidth="12" strokeDasharray={`${dash} ${circumference - dash}`} transform="rotate(-90 120 70)" strokeLinecap="round" />
          <text x="120" y="75" textAnchor="middle" fontSize="14" fill="#4338ca" fontWeight="700">{ringValue}%</text>
        </svg>
      );
    }

    if (mode === 3) {
      const spokes = Array.from({ length: 8 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 8;
        const radius = 20 + ((seed + i * 13) % 35);
        const x = 120 + Math.cos(angle) * radius;
        const y = 70 + Math.sin(angle) * radius;
        return { x, y };
      });
      const polygonPoints = spokes.map((p) => `${p.x},${p.y}`).join(' ');
      return (
        <svg viewBox="0 0 240 140" className="w-full h-36 rounded-lg bg-white border border-indigo-100">
          {Array.from({ length: 8 }, (_, i) => {
            const angle = (Math.PI * 2 * i) / 8;
            return <line key={`sp-${i}`} x1="120" y1="70" x2={120 + Math.cos(angle) * 50} y2={70 + Math.sin(angle) * 50} stroke="#c7d2fe" strokeWidth="1" />;
          })}
          <polygon points={polygonPoints} fill="rgba(99,102,241,0.25)" stroke="#6366f1" strokeWidth="2" />
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 240 140" className="w-full h-36 rounded-lg bg-white border border-indigo-100">
        {barValues.map((v, i) => {
          const w = 26;
          const x = 16 + i * 36;
          const h1 = Math.round((v / 100) * 50);
          const h2 = Math.round(((100 - v) / 100) * 40);
          return (
            <g key={`m4-${i}`}>
              <rect x={x} y={120 - h1} width={w} height={h1} rx="3" fill="#7c3aed" />
              <rect x={x} y={120 - h1 - h2} width={w} height={h2} rx="3" fill="#c4b5fd" />
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 animate-fadeIn">
      <Navigation role="Student" onLogout={handleLogout} />

      <div className="max-w-5xl mx-auto p-6 animate-slideUp">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI-Powered Recommendations</h1>
          <p className="text-gray-600">Click AI button to generate live plans and visual analysis.</p>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (liveLoading) return;
                handleRunLiveRecommendations();
              }}
              aria-busy={liveLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border shadow-sm transition-all duration-300 text-sm font-semibold hover:brightness-110 active:brightness-95"
              style={{ background: 'linear-gradient(90deg, #059669 0%, #0284c7 100%)', color: '#ffffff', borderColor: '#065f46' }}
            >
              <Sparkles className="w-4 h-4" />
              {liveLoading ? 'Running AI Analysis...' : 'AI Live Recommendations'}
            </button>
            {liveError && <span className="text-sm text-red-600">{liveError}</span>}
          </div>
        </div>

        {!aiTriggered && (
          <div className="bg-white border border-indigo-200 rounded-xl p-8 text-center card-hover">
            <Sparkles className="w-8 h-8 text-indigo-600 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-gray-900">No AI Content Yet</h2>
            <p className="text-gray-600 mt-2">Only after clicking the AI button, recommendations and visuals will appear here.</p>
          </div>
        )}

        {aiTriggered && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 card-hover">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Live Insight Matrix</h2>
                <p className="text-sm text-gray-600 mt-1">Real-time analysis from your generated plans.</p>
              </div>
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {[
                    { label: 'Urgency Index', value: analysis.urgency, icon: Activity },
                    { label: 'Balance Index', value: analysis.balance, icon: Target },
                    { label: 'Actionability Index', value: analysis.actionability, icon: Sparkles }
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="flex items-center justify-between mb-1 text-sm text-gray-700">
                        <span className="inline-flex items-center gap-2"><row.icon className="w-4 h-4 text-indigo-600" />{row.label}</span>
                        <span className="font-semibold">{row.value}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${row.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
                  <h3 className="font-bold text-indigo-900 mb-3">Priority Orbit</h3>
                  <div className="mx-auto w-44 h-44 rounded-full flex items-center justify-center border-8 border-indigo-100" style={{ background: `conic-gradient(#ef4444 0 ${(analysis.high / analysis.total) * 100}%, #f59e0b ${(analysis.high / analysis.total) * 100}% ${((analysis.high + analysis.medium) / analysis.total) * 100}%, #10b981 ${((analysis.high + analysis.medium) / analysis.total) * 100}% 100%)` }}>
                    <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-inner">
                      <p className="text-sm font-bold text-gray-800">{analysis.total} Plans</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded bg-red-100 text-red-700 font-semibold">High: {analysis.high}</div>
                    <div className="p-2 rounded bg-amber-100 text-amber-700 font-semibold">Medium: {analysis.medium}</div>
                    <div className="p-2 rounded bg-green-100 text-green-700 font-semibold">Low: {analysis.low}</div>
                  </div>
                </div>
              </div>
            </div>

            {items.map((rec, index) => (
              <div key={rec._id || index} className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 card-hover overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">{rec.title}</h2>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${rec.priority === 'high' ? 'bg-red-100 text-red-700' : rec.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {rec.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gray-600 mt-2">Category: {rec.category || 'academic'}</p>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4">
                    {renderPlanVisual(rec, index)}
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-600" />
                      Personalized Suggestion
                    </h3>
                    <div className="flex items-start gap-3 p-4 bg-indigo-50 rounded-lg border border-indigo-100 card-hover">
                      <Users className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                      <p className="text-gray-700">{rec.description}</p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-600"><strong>Pro Tip:</strong> Follow this plan for 7 days continuously, then review progress.</p>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
