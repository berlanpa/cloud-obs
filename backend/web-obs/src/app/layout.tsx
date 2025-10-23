import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI-OBS - Intelligent Auto-Director',
  description: 'Real-time AI-powered camera switching and narration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
