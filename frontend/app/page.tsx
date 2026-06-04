'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Code2, Video, MessageSquare, Users, ArrowRight, Zap, Shield, Globe } from 'lucide-react';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(rgba(14, 165, 233, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(14, 165, 233, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">labmentix with khush</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-dark-300 hover:text-white px-4 py-2 rounded-lg transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2 rounded-lg font-medium transition-all hover:shadow-lg hover:shadow-primary-500/25"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 text-center px-6 pt-20 pb-32 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm px-4 py-1.5 rounded-full mb-8">
          <Zap className="w-4 h-4" />
          Real-time collaborative mentorship
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          Learn to code with your{' '}
          <span className="gradient-text">mentor, live</span>
        </h1>

        <p className="text-xl text-dark-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          1-on-1 video sessions with shared code editor and real-time chat.
          Built for mentors and students who want to learn by doing together.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/auth/register"
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5"
          >
            Start a session <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/auth/login"
            className="flex items-center gap-2 bg-dark-800 hover:bg-dark-700 text-white px-8 py-4 rounded-xl font-semibold text-lg border border-dark-700 transition-all"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 pb-24 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <Video className="w-6 h-6 text-primary-400" />,
              title: 'Live Video Calls',
              desc: 'Face-to-face WebRTC video calls directly in the browser. No extra apps needed.',
              color: 'primary',
            },
            {
              icon: <Code2 className="w-6 h-6 text-violet-400" />,
              title: 'Shared Code Editor',
              desc: 'Monaco editor (same as VS Code) with real-time sync. Both mentor and student type in the same editor.',
              color: 'violet',
            },
            {
              icon: <MessageSquare className="w-6 h-6 text-emerald-400" />,
              title: 'Session Chat',
              desc: 'Built-in chat with message history. Share links, snippets, and feedback instantly.',
              color: 'emerald',
            },
          ].map((f, i) => (
            <div
              key={i}
              className="glass rounded-2xl p-6 hover:border-primary-500/30 transition-all hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-xl bg-dark-800 flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-dark-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="relative z-10 px-6 pb-24 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Two roles, one platform</h2>
          <p className="text-dark-400">Whether you teach or learn, labmentix with khush is built for you.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-8 border-primary-500/20">
            <div className="w-14 h-14 bg-primary-500/10 rounded-2xl flex items-center justify-center mb-5">
              <Shield className="w-7 h-7 text-primary-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Mentor</h3>
            <ul className="space-y-2 text-dark-400 text-sm">
              <li className="flex items-center gap-2"><span className="text-primary-400">✓</span> Create private sessions</li>
              <li className="flex items-center gap-2"><span className="text-primary-400">✓</span> Share invite code with student</li>
              <li className="flex items-center gap-2"><span className="text-primary-400">✓</span> Control session start/end</li>
              <li className="flex items-center gap-2"><span className="text-primary-400">✓</span> Guide code in real-time</li>
            </ul>
          </div>

          <div className="glass rounded-2xl p-8 border-violet-500/20">
            <div className="w-14 h-14 bg-violet-500/10 rounded-2xl flex items-center justify-center mb-5">
              <Users className="w-7 h-7 text-violet-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Student</h3>
            <ul className="space-y-2 text-dark-400 text-sm">
              <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Join via invite code</li>
              <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Code alongside mentor</li>
              <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Ask questions in chat</li>
              <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> See & hear mentor live</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-dark-800 px-6 py-8 text-center text-dark-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Code2 className="w-4 h-4" />
          <span className="font-semibold text-dark-400">labmentix with khush</span>
        </div>
        Built with Next.js, Node.js, Socket.io, WebRTC, and PostgreSQL
      </footer>
    </main>
  );
}
