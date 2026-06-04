import { AuthProvider } from '@/lib/auth';

export default function SessionLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
