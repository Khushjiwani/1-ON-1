'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { sessionsApi } from '@/lib/api';
import {
  Code2, Plus, LogOut, Users, Clock, CheckCircle2,
  Copy, Check, Trash2, Play, AlertCircle, Loader2, X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Session {
  id: string;
  title: string;
  description?: string;
  status: 'WAITING' | 'ACTIVE' | 'ENDED';
  language: string;
  inviteCode: string;
  createdAt: string;
  mentor: { id: string; name: string };
  student?: { id: string; name: string };
  _count?: { messages: number };
}

const LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'cpp', 'go', 'rust', 'html', 'css', 'sql'];

export default function DashboardPage() {
  const { user, logout, loading, token } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [error, setError] = useState('');

  // Create session modal
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createLang, setCreateLang] = useState('javascript');
  const [creating, setCreating] = useState(false);

  // Join session modal
  const [showJoin, setShowJoin] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  // Copied code state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) fetchSessions();
  }, [user]);

  const fetchSessions = async () => {
    try {
      setLoadingSessions(true);
      const data = await sessionsApi.getAll();
      setSessions(data.sessions);
    } catch (err) {
      setError('Failed to load sessions');
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) return;
    setCreating(true);
    try {
      const data = await sessionsApi.create({
        title: createTitle,
        description: createDesc,
        language: createLang,
      });
      setSessions([data.session, ...sessions]);
      setShowCreate(false);
      setCreateTitle('');
      setCreateDesc('');
      setCreateLang('javascript');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoining(true);
    setJoinError('');
    try {
      const data = await sessionsApi.join(inviteCode.trim());
      router.push(`/session/${data.session.id}`);
    } catch (err: any) {
      setJoinError(err.response?.data?.error || 'Failed to join session');
    } finally {
      setJoining(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session?')) return;
    try {
      await sessionsApi.delete(id);
      setSessions(sessions.filter(s => s.id !== id));
    } catch {
      setError('Failed to delete session');
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const statusColor = (status: string) => {
    if (status === 'ACTIVE') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (status === 'ENDED') return 'text-dark-500 bg-dark-800 border-dark-700';
    return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  };

  const statusLabel = (status: string) => {
    if (status === 'ACTIVE') return 'Live';
    if (status === 'ENDED') return 'Ended';
    return 'Waiting';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Navbar */}
      <nav className="border-b border-dark-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">labmentix with khush</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-dark-500">
                {user.role === 'MENTOR' ? '👨‍🏫 Mentor' : '🎓 Student'}
              </p>
            </div>
            <button
              onClick={logout}
              className="text-dark-500 hover:text-dark-300 p-2 rounded-lg hover:bg-dark-800 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {user.role === 'MENTOR' ? 'Your Sessions' : 'My Learning Sessions'}
            </h1>
            <p className="text-dark-400 mt-1">
              {user.role === 'MENTOR'
                ? 'Create and manage your mentoring sessions'
                : 'Join sessions with your mentor using an invite code'}
            </p>
          </div>
          <div className="flex gap-3">
            {user.role === 'STUDENT' && (
              <button
                onClick={() => setShowJoin(true)}
                className="flex items-center gap-2 bg-dark-800 hover:bg-dark-700 border border-dark-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all"
              >
                <Users className="w-4 h-4" />
                Join Session
              </button>
            )}
            {user.role === 'MENTOR' && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all"
              >
                <Plus className="w-4 h-4" />
                New Session
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-6">
            <AlertCircle className="w-4 h-4" />
            {error}
            <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Sessions list */}
        {loadingSessions ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-24 glass rounded-2xl">
            <div className="w-16 h-16 bg-dark-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Code2 className="w-8 h-8 text-dark-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No sessions yet</h3>
            <p className="text-dark-500 text-sm">
              {user.role === 'MENTOR'
                ? 'Create your first session to get started.'
                : 'Ask your mentor for an invite code to join a session.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="glass rounded-2xl p-6 hover:border-dark-600 transition-all animate-fade-in"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white truncate">{session.title}</h3>
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusColor(session.status)}`}>
                        {statusLabel(session.status)}
                      </span>
                      <span className="text-xs bg-dark-800 text-dark-400 px-2 py-0.5 rounded-full">
                        {session.language}
                      </span>
                    </div>

                    {session.description && (
                      <p className="text-dark-400 text-sm mb-3">{session.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-dark-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                      </span>
                      {session.student ? (
                        <span className="flex items-center gap-1 text-emerald-500">
                          <CheckCircle2 className="w-3 h-3" />
                          Student: {session.student.name}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Waiting for student
                        </span>
                      )}
                      {session._count && (
                        <span>{session._count.messages} messages</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Invite code (mentor only) */}
                    {user.role === 'MENTOR' && session.status !== 'ENDED' && (
                      <button
                        onClick={() => copyInviteCode(session.inviteCode)}
                        className="flex items-center gap-1.5 bg-dark-800 hover:bg-dark-700 border border-dark-700 text-dark-300 text-xs px-3 py-2 rounded-lg transition-colors"
                        title="Copy invite code"
                      >
                        {copiedCode === session.inviteCode ? (
                          <><Check className="w-3 h-3 text-emerald-400" /> Copied!</>
                        ) : (
                          <><Copy className="w-3 h-3" /> {session.inviteCode}</>
                        )}
                      </button>
                    )}

                    {/* Enter session button */}
                    {session.status !== 'ENDED' && (
                      <button
                        onClick={() => router.push(`/session/${session.id}`)}
                        className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Enter
                      </button>
                    )}

                    {/* Delete (mentor only) */}
                    {user.role === 'MENTOR' && (
                      <button
                        onClick={() => handleDelete(session.id)}
                        className="text-dark-600 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                        title="Delete session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-8 w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Create New Session</h2>
              <button onClick={() => setShowCreate(false)} className="text-dark-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Session Title *</label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="e.g. React Hooks Deep Dive"
                  required
                  className="w-full bg-dark-800 border border-dark-700 text-white placeholder-dark-500 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Description (optional)</label>
                <textarea
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="What will you cover in this session?"
                  rows={3}
                  className="w-full bg-dark-800 border border-dark-700 text-white placeholder-dark-500 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-500 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Programming Language</label>
                <select
                  value={createLang}
                  onChange={(e) => setCreateLang(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-primary-500 transition-colors"
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang} value={lang}>{lang.charAt(0).toUpperCase() + lang.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 bg-dark-800 hover:bg-dark-700 text-dark-300 py-3 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Session Modal */}
      {showJoin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-8 w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Join Session</h2>
              <button onClick={() => setShowJoin(false)} className="text-dark-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              {joinError && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {joinError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Invite Code</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABC123"
                  required
                  maxLength={6}
                  className="w-full bg-dark-800 border border-dark-700 text-white placeholder-dark-500 rounded-xl px-4 py-3 font-mono text-center text-2xl tracking-widest focus:outline-none focus:border-primary-500 transition-colors"
                />
                <p className="text-xs text-dark-500 mt-2">Ask your mentor for the 6-character invite code</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowJoin(false); setJoinError(''); }}
                  className="flex-1 bg-dark-800 hover:bg-dark-700 text-dark-300 py-3 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining}
                  className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {joining ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining...</> : 'Join Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
