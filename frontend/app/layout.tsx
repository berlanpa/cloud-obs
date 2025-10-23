import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: {
    default: 'Pablo Berlanga Boemare | AI-Native Cloud OBS',
    template: '%s',
  },
  description:
    'AI-powered auto-director system that intelligently switches between camera feeds using YOLO object detection, Vision-Language Models, and Whisper ASR.',
  twitter: {
    creator: '@pabloberlanga',
    site: '@pabloberlanga',
    card: 'summary_large_image',
  },
  openGraph: {
    url: 'https://ai-obs.pabloberlanga.com',
    images: [
      {
        url: 'https://ai-obs.pabloberlanga.com/images/ai-obs-open-graph.png',
        width: 2000,
        height: 1000,
        type: 'image/png',
      },
    ],
    siteName: 'AI-Native Cloud OBS',
  },
  icons: {
    icon: {
      rel: 'icon',
      url: '/favicon.png',
    },
    apple: [
      {
        rel: 'apple-touch-icon',
        url: '/favicon.png',
        sizes: '180x180',
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#070707',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-lk-theme="default">
        <Toaster />
        {children}
      </body>
    </html>
  );
}
