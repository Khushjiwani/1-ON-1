'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { sessionsApi } from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import dynamic from 'next/dynamic';
import {
  ArrowLeft, Video, VideoOff, Mic, MicOff, Phone, PhoneOff,
  Send, Code2, MessageSquare, Users, Play, Square, Settings,
  Copy, Check, Loader2, AlertCircle, ChevronDown
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Socket } from 'socket.io-client';

// Dynamically import Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'cpp', 'go', 'rust', 'html', 'css', 'sql'];

interface Message {
  id: string;
  content: string;
  type: 'TEXT' | 'SYSTEM';
  user?: { id: string; name: string };
  createdAt: string;
}

interface SessionData {
  id: string;
  title: string;
  description?: string;
  status: 'WAITING' | 'ACTIVE' | 'ENDED';
  language: string;
  inviteCode: string;
  code: string;
  mentor: { id: string; name: string; email: string };
  student?: { id: string; name: string; email: string };
  messages: Message[];
}

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [error, setError] = useState('');

  // Editor state
  const [code, setCode] = useState('// Start coding here...\n');
  const [language, setLanguage] = useState('javascript');
  const [editorLoading, setEditorLoading] = useState(true);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');

  // Video state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [callActive, setCallActive] = useState(false);
  const [callConnecting, setCallConnecting] = useState(false);

  // Misc
  const [copiedCode, setCopiedCode] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const codeUpdateRef = useRef<boolean>(false);

  const isMentor = user?.id === session?.mentor.id;

  // ─── Load session ──────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading]);

  useEffect(() => {
    if (!user || !token) return;

    const loadSession = async () => {
      try {
        const data = await sessionsApi.getOne(sessionId);
        setSession(data.session);
        setCode(data.session.code || '// Start coding here...\n');
        setLanguage(data.session.language || 'javascript');
        setMessages(data.session.messages || []);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load session');
      } finally {
        setLoadingSession(false);
      }
    };

    loadSession();
  }, [user, token, sessionId]);

  // ─── Socket setup ──────────────────────────────────────
  useEffect(() => {
    if (!user || !token || !session) return;

    const socket = getSocket(token);
    socketRef.current = socket;

    socket.emit('join-session', { sessionId });

    socket.on('user-joined', ({ userId, role }) => {
      setPeerConnected(true);
    });

    socket.on('user-left', () => {
      setPeerConnected(false);
      // Clean up WebRTC
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      setRemoteStream(null);
      setCallActive(false);
    });

    socket.on('code-update', ({ code: newCode, language: newLang }) => {
      codeUpdateRef.current = true;
      setCode(newCode);
      if (newLang) setLanguage(newLang);
    });

    socket.on('code-sync', ({ code: syncCode, language: syncLang }) => {
      setCode(syncCode);
      setLanguage(syncLang);
    });

    socket.on('language-update', ({ language: newLang }) => {
      setLanguage(newLang);
    });

    socket.on('new-message', (message: Message) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('user-typing', () => {
      setOtherTyping(true);
      setTimeout(() => setOtherTyping(false), 3000);
    });

    socket.on('user-stopped-typing', () => setOtherTyping(false));

    socket.on('session-status-changed', ({ status }) => {
      setSession(prev => prev ? { ...prev, status } : prev);
    });

    // WebRTC signaling
    socket.on('webrtc-offer', async ({ offer }) => {
      await handleIncomingOffer(offer);
    });

    socket.on('webrtc-answer', async ({ answer }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(answer);
      }
    });

    socket.on('webrtc-ice-candidate', async ({ candidate }) => {
      if (peerConnectionRef.current && candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(candidate);
        } catch {}
      }
    });

    return () => {
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('code-update');
      socket.off('code-sync');
      socket.off('language-update');
      socket.off('new-message');
      socket.off('user-typing');
      socket.off('user-stopped-typing');
      socket.off('session-status-changed');
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
    };
  }, [user, token, session]);

  // ─── Scroll chat to bottom ─────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Code change handler ───────────────────────────────
  const handleCodeChange = useCallback((value: string | undefined) => {
    if (codeUpdateRef.current) {
      codeUpdateRef.current = false;
      return;
    }
    const newCode = value || '';
    setCode(newCode);
    socketRef.current?.emit('code-change', { sessionId, code: newCode, language });
  }, [sessionId, language]);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    socketRef.current?.emit('language-change', { sessionId, language: lang });
  };

  // ─── Chat ──────────────────────────────────────────────
  const sendMessage = () => {
    if (!newMessage.trim()) return;
    socketRef.current?.emit('send-message', { sessionId, content: newMessage });
    setNewMessage('');
    socketRef.current?.emit('typing-stop', { sessionId });
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      socketRef.current?.emit('typing-start', { sessionId });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketRef.current?.emit('typing-stop', { sessionId });
    }, 1500);
  };

  // ─── WebRTC ────────────────────────────────────────────
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('webrtc-ice-candidate', {
          sessionId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallActive(true);
        setCallConnecting(false);
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setCallActive(false);
        setRemoteStream(null);
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const startCall = async () => {
    try {
      setCallConnecting(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current?.emit('webrtc-offer', { sessionId, offer });
    } catch (err) {
      setCallConnecting(false);
      setError('Could not access camera/microphone. Please check permissions.');
    }
  };

  const handleIncomingOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      setCallConnecting(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current?.emit('webrtc-answer', { sessionId, answer });
    } catch (err) {
      setCallConnecting(false);
    }
  };

  const endCall = () => {
    localStream?.getTracks().forEach(t => t.stop());
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCallActive(false);
    setCallConnecting(false);
  };

  const toggleVideo = () => {
    localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setVideoEnabled(!videoEnabled);
  };

  const toggleAudio = () => {
    localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setAudioEnabled(!audioEnabled);
  };

  // ─── Session controls ──────────────────────────────────
  const startSession = async () => {
    await sessionsApi.start(sessionId);
    socketRef.current?.emit('session-started', { sessionId });
    setSession(prev => prev ? { ...prev, status: 'ACTIVE' } : prev);
  };

  const endSession = async () => {
    if (!confirm('End this session for everyone?')) return;
    await sessionsApi.end(sessionId);
    socketRef.current?.emit('session-ended', { sessionId });
    setSession(prev => prev ? { ...prev, status: 'ENDED' } : prev);
  };

  const copyInviteCode = () => {
    if (!session) return;
    navigator.clipboard.writeText(session.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // ─── Render ────────────────────────────────────────────
  if (loading || loadingSession) {
    return (
      <div className="h-screen bg-dark-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-dark-950 flex items-center justify-center flex-col gap-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-dark-400">{error}</p>
        <button onClick={() => router.push('/dashboard')} className="text-primary-400 hover:text-primary-300">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="h-screen bg-dark-950 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-dark-800 bg-dark-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-dark-500 hover:text-white p-1.5 rounded-lg hover:bg-dark-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-white text-sm">{session.title}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                session.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' :
                session.status === 'ENDED' ? 'bg-dark-700 text-dark-500' :
                'bg-amber-500/10 text-amber-400'
              }`}>
                {session.status}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-dark-500">
                {isMentor ? '👨‍🏫 You are the Mentor' : '🎓 You are the Student'}
              </span>
              {peerConnected && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Peer online
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Invite code (mentor) */}
          {isMentor && session.status !== 'ENDED' && (
            <button
              onClick={copyInviteCode}
              className="flex items-center gap-1.5 bg-dark-800 hover:bg-dark-700 border border-dark-700 text-dark-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              {copiedCode ? <><Check className="w-3 h-3 text-emerald-400" /> Copied!</> : <><Copy className="w-3 h-3" /> {session.inviteCode}</>}
            </button>
          )}

          {/* Session controls (mentor) */}
          {isMentor && (
            <>
              {session.status === 'WAITING' && (
                <button
                  onClick={startSession}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  <Play className="w-3.5 h-3.5" /> Start Session
                </button>
              )}
              {session.status === 'ACTIVE' && (
                <button
                  onClick={endSession}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  <Square className="w-3.5 h-3.5" /> End Session
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Code Editor (left) */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-dark-800">
          {/* Editor toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 bg-dark-900 border-b border-dark-800 flex-shrink-0">
            <Code2 className="w-4 h-4 text-dark-500" />
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-dark-800 border border-dark-700 text-dark-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary-500"
              disabled={session.status === 'ENDED'}
            >
              {LANGUAGES.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
            <span className="text-xs text-dark-600 ml-auto">
              {session.status === 'ACTIVE' ? '🟢 Live editing' :
               session.status === 'WAITING' ? '⏳ Waiting to start' : '🔴 Session ended'}
            </span>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              height="100%"
              language={language}
              value={code}
              onChange={handleCodeChange}
              onMount={() => setEditorLoading(false)}
              theme="vs-dark"
              options={{
                fontSize: 14,
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 16, bottom: 16 },
                lineNumbers: 'on',
                renderLineHighlight: 'gutter',
                readOnly: session.status === 'ENDED',
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                smoothScrolling: true,
                cursorSmoothCaretAnimation: 'on',
              }}
            />
          </div>
        </div>

        {/* Right panel: Video + Chat */}
        <div className="w-80 flex flex-col bg-dark-900 overflow-hidden">
          {/* Video section */}
          <div className="flex-shrink-0 border-b border-dark-800">
            {/* Video grid */}
            <div className="relative bg-dark-950 aspect-video">
              {/* Remote video */}
              {remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-14 h-14 bg-dark-800 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Video className="w-6 h-6 text-dark-600" />
                    </div>
                    <p className="text-xs text-dark-600">
                      {callConnecting ? 'Connecting...' : 'No remote video'}
                    </p>
                  </div>
                </div>
              )}

              {/* Local video (PiP) */}
              {localStream && (
                <div className="absolute bottom-2 right-2 w-20 h-14 bg-dark-900 rounded-lg overflow-hidden border border-dark-700">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {callConnecting && (
                <div className="absolute inset-0 flex items-center justify-center bg-dark-950/80">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                </div>
              )}
            </div>

            {/* Video controls */}
            <div className="flex items-center justify-center gap-2 p-3">
              {!callActive && !callConnecting ? (
                <button
                  onClick={startCall}
                  disabled={session.status === 'ENDED'}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" /> Start Video
                </button>
              ) : (
                <>
                  <button
                    onClick={toggleVideo}
                    className={`p-2 rounded-lg transition-colors ${videoEnabled ? 'bg-dark-800 text-white hover:bg-dark-700' : 'bg-red-500/20 text-red-400'}`}
                    title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
                  >
                    {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={toggleAudio}
                    className={`p-2 rounded-lg transition-colors ${audioEnabled ? 'bg-dark-800 text-white hover:bg-dark-700' : 'bg-red-500/20 text-red-400'}`}
                    title={audioEnabled ? 'Mute' : 'Unmute'}
                  >
                    {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={endCall}
                    className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                    title="End call"
                  >
                    <PhoneOff className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Chat/Participants tabs */}
          <div className="flex border-b border-dark-800 flex-shrink-0">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                activeTab === 'chat' ? 'text-primary-400 border-b-2 border-primary-500' : 'text-dark-500 hover:text-dark-300'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
              {messages.length > 0 && (
                <span className="bg-primary-500/20 text-primary-400 text-xs px-1.5 rounded-full">
                  {messages.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                activeTab === 'participants' ? 'text-primary-400 border-b-2 border-primary-500' : 'text-dark-500 hover:text-dark-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              People
            </button>
          </div>

          {/* Chat */}
          {activeTab === 'chat' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-8 h-8 text-dark-700 mx-auto mb-2" />
                    <p className="text-xs text-dark-600">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    if (msg.type === 'SYSTEM') {
                      return (
                        <div key={msg.id} className="text-center">
                          <span className="text-xs text-dark-600 bg-dark-800 px-3 py-1 rounded-full">
                            {msg.content}
                          </span>
                        </div>
                      );
                    }

                    const isOwn = msg.user?.id === user?.id;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                        {!isOwn && (
                          <span className="text-xs text-dark-500 mb-1 px-1">{msg.user?.name}</span>
                        )}
                        <div className={`max-w-[90%] px-3 py-2 rounded-xl text-sm ${
                          isOwn
                            ? 'bg-primary-600 text-white rounded-br-sm'
                            : 'bg-dark-800 text-dark-100 rounded-bl-sm'
                        }`}>
                          {msg.content}
                        </div>
                        <span className="text-xs text-dark-600 mt-1 px-1">
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    );
                  })
                )}
                {otherTyping && (
                  <div className="flex items-center gap-2">
                    <div className="bg-dark-800 px-3 py-2 rounded-xl rounded-bl-sm flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-dark-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-dark-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-dark-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="flex-shrink-0 p-3 border-t border-dark-800">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={handleTyping}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={session.status === 'ENDED' ? 'Session ended' : 'Type a message...'}
                    disabled={session.status === 'ENDED'}
                    className="flex-1 bg-dark-800 border border-dark-700 text-white placeholder-dark-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-500 disabled:opacity-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || session.status === 'ENDED'}
                    className="p-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Participants tab */}
          {activeTab === 'participants' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center gap-3 p-3 bg-dark-800 rounded-xl">
                <div className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center text-sm font-semibold text-primary-400">
                  {session.mentor.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{session.mentor.name}</p>
                  <p className="text-xs text-dark-500">👨‍🏫 Mentor {session.mentor.id === user?.id ? '(You)' : ''}</p>
                </div>
                <span className="ml-auto w-2 h-2 bg-emerald-400 rounded-full" />
              </div>

              {session.student ? (
                <div className="flex items-center gap-3 p-3 bg-dark-800 rounded-xl">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-full flex items-center justify-center text-sm font-semibold text-violet-400">
                    {session.student.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{session.student.name}</p>
                    <p className="text-xs text-dark-500">🎓 Student {session.student.id === user?.id ? '(You)' : ''}</p>
                  </div>
                  <span className={`ml-auto w-2 h-2 rounded-full ${peerConnected ? 'bg-emerald-400' : 'bg-dark-600'}`} />
                </div>
              ) : (
                <div className="p-3 bg-dark-800/50 border border-dashed border-dark-700 rounded-xl text-center">
                  <p className="text-xs text-dark-500">Waiting for student...</p>
                  {isMentor && (
                    <p className="text-xs text-dark-600 mt-1">Share code: <span className="text-primary-400 font-mono">{session.inviteCode}</span></p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
