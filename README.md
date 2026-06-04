# 🚀 labmentix with khush — Real-time 1-on-1 Mentorship Platform

A production-ready web platform for live mentor-student coding sessions featuring:

- ✅ **Authentication** — Register/Login with JWT, role-based (Mentor/Student)
- ✅ **Session Management** — Create, join via invite code, start, end sessions
- ✅ **Shared Code Editor** — Monaco Editor (VS Code) with real-time sync via Socket.io
- ✅ **Live Chat** — Message history, typing indicators, stored in PostgreSQL
- ✅ **Video Call** — WebRTC peer-to-peer 1-on-1 video with camera/mic controls
- ✅ **Real-time** — Full bidirectional sync for editor, chat, and session status

---

## 🧠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Monaco Editor |
| Backend | Node.js, Express.js, Socket.io |
| Video | WebRTC (browser-native) + Socket.io signaling |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT + bcrypt |
| Real-time | Socket.io (editor sync, chat, WebRTC signaling) |

---

## 📁 Project Structure

```
mentor-platform/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma        # DB schema (users, sessions, messages)
│   ├── src/
│   │   ├── index.js             # App entry point
│   │   ├── middleware/
│   │   │   └── auth.js          # JWT auth middleware
│   │   ├── routes/
│   │   │   ├── auth.js          # /api/auth (login, register, me)
│   │   │   ├── sessions.js      # /api/sessions (CRUD + join/start/end)
│   │   │   └── users.js         # /api/users (profile)
│   │   └── socket/
│   │       └── handlers.js      # All Socket.io event handlers
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── app/
    │   ├── page.tsx             # Landing page
    │   ├── layout.tsx           # Root layout
    │   ├── globals.css
    │   ├── auth/
    │   │   ├── login/page.tsx   # Login page
    │   │   └── register/page.tsx # Register page
    │   ├── dashboard/
    │   │   └── page.tsx         # Main dashboard (create/join sessions)
    │   └── session/[sessionId]/
    │       └── page.tsx         # The full session workspace
    ├── lib/
    │   ├── auth.tsx             # Auth context + useAuth hook
    │   ├── api.ts               # Axios API client
    │   └── socket.ts            # Socket.io client singleton
    └── package.json
```

---

## ⚡ Quick Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database (local or [Supabase](https://supabase.com) free tier)

---

### 1. Clone and install

```bash
git clone <your-repo>
cd mentor-platform

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

---

### 2. Setup Backend

```bash
cd backend

# Copy and fill in your environment variables
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/mentor_platform"
JWT_SECRET="your-random-secret-key-here"
PORT=5000
CLIENT_URL="http://localhost:3000"
```

```bash
# Push DB schema & generate Prisma client
npx prisma db push
npx prisma generate

# Start backend
npm run dev
```

Backend will run at: `http://localhost:5000`

---

### 3. Setup Frontend

```bash
cd frontend

# Copy env
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

```bash
npm run dev
```

Frontend will run at: `http://localhost:3000`

---

## 🎮 How to Use

### As a Mentor
1. Register with role **Mentor**
2. Click **New Session** on dashboard
3. Fill in title, language → Create
4. Copy the **6-character invite code** (shown on the session card)
5. Share the code with your student
6. Enter the session, click **Start Session**
7. Code, chat, and video call together!

### As a Student
1. Register with role **Student**
2. Click **Join Session** → Enter the invite code from your mentor
3. Enter the session workspace
4. Click **Start Video** to initiate video call
5. Code together in real-time!

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register (name, email, password, role) |
| POST | `/api/auth/login` | Login (email, password) |
| GET | `/api/auth/me` | Get current user |

### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List your sessions |
| POST | `/api/sessions` | Create session (mentor only) |
| POST | `/api/sessions/join` | Join by invite code |
| GET | `/api/sessions/:id` | Get session details + messages |
| PATCH | `/api/sessions/:id/start` | Start session (mentor) |
| PATCH | `/api/sessions/:id/end` | End session (mentor) |
| DELETE | `/api/sessions/:id` | Delete session (mentor) |

### Socket Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `join-session` | Client → Server | `{ sessionId }` |
| `code-change` | Client → Server | `{ sessionId, code, language }` |
| `code-update` | Server → Client | `{ code, language }` |
| `send-message` | Client → Server | `{ sessionId, content }` |
| `new-message` | Server → Client | message object |
| `webrtc-offer` | Client → Server | `{ sessionId, offer }` |
| `webrtc-answer` | Client → Server | `{ sessionId, answer }` |
| `webrtc-ice-candidate` | Both | `{ sessionId, candidate }` |
| `session-started/ended` | Client → Server | `{ sessionId }` |

---

## 🚀 Deployment

### Frontend → Vercel
1. Push to GitHub
2. Import in [vercel.com](https://vercel.com)
3. Set env vars: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`

### Backend → Railway or Render
1. Create new service from GitHub repo
2. Set root directory to `backend/`
3. Set env vars: `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`, `PORT`
4. Railway auto-detects Node.js

### Database → Supabase (Free)
1. Create project at [supabase.com](https://supabase.com)
2. Copy the **Direct connection** string from Settings → Database
3. Use as `DATABASE_URL`
4. Run `npx prisma db push` against Supabase

---

## 🎯 Resume Description

> **labmentix with khush** — Built a 1-on-1 mentorship web platform with real-time collaborative code editing using Monaco Editor + Socket.io, video conferencing with WebRTC peer connections, session-based chat with live typing indicators, and JWT authentication with role-based access control. Stack: Next.js, Node.js/Express, Socket.io, PostgreSQL/Prisma.

---

## 📝 Notes

- Video call uses public Google STUN servers (free) — works for most network setups
- Code sync uses last-write-wins strategy with 2-second debounce for DB saves
- All socket events are authenticated via JWT in handshake
- Sessions are private — only assigned mentor and student can access
