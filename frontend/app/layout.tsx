import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'labmentix with khush - Real-time 1-on-1 Mentorship',
  description: 'Connect, collaborate, and code together in real-time with your mentor or student.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-dark-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
