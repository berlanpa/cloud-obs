'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function CamerasPage() {
  const [localIP, setLocalIP] = useState<string>('');
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    // Get local IP from window location
    const hostname = window.location.hostname;
    const port = process.env.NEXT_PUBLIC_API_URL?.split(':')[2] || '3000';
    setLocalIP(`${hostname}:${port}`);
  }, []);

  const cameras = [
    { id: 'cam-1', name: 'Camera 1', color: 'bg-blue-500' },
    { id: 'cam-2', name: 'Camera 2', color: 'bg-green-500' },
    { id: 'cam-3', name: 'Camera 3', color: 'bg-yellow-500' },
    { id: 'cam-4', name: 'Camera 4', color: 'bg-purple-500' },
    { id: 'cam-5', name: 'Camera 5', color: 'bg-red-500' },
  ];

  const getCameraUrl = (camId: string) => {
    return `http://${localIP}/camera.html?id=${camId}`;
  };

  const copyToClipboard = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">📱 Connect Cameras</h1>
            <p className="text-gray-400">
              Scan QR codes with your phone to use it as a camera
            </p>
          </div>
          <a
            href="/"
            className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
          >
            ← Back to Dashboard
          </a>
        </div>
      </div>

      {/* Instructions */}
      <div className="max-w-6xl mx-auto mb-8 p-6 bg-gray-900 rounded-lg border border-gray-800">
        <h2 className="text-xl font-semibold mb-4">📖 Instructions</h2>
        <ol className="space-y-2 text-gray-300">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">
              1
            </span>
            <span>Open your phone&apos;s camera app</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">
              2
            </span>
            <span>Point it at any QR code below</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">
              3
            </span>
            <span>Tap the notification to open the camera page</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">
              4
            </span>
            <span>Tap &quot;Start Broadcasting&quot; - done! 🎉</span>
          </li>
        </ol>
        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-sm text-yellow-200">
            💡 <strong>Tip:</strong> Use different devices for each camera (phones, tablets, laptops)
          </p>
        </div>
      </div>

      {/* QR Codes Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cameras.map((camera, index) => {
          const url = getCameraUrl(camera.id);

          return (
            <div
              key={camera.id}
              className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden"
            >
              {/* Header */}
              <div className={`${camera.color} px-4 py-3 flex items-center justify-between`}>
                <h3 className="font-bold text-white">{camera.name}</h3>
                <span className="text-xs bg-black/30 px-2 py-1 rounded">
                  {camera.id}
                </span>
              </div>

              {/* QR Code */}
              <div className="p-6 bg-white flex items-center justify-center">
                <QRCodeSVG value={url} size={200} level="H" />
              </div>

              {/* URL */}
              <div className="p-4 space-y-2">
                <div className="text-xs text-gray-500 font-mono break-all">
                  {url}
                </div>
                <button
                  onClick={() => copyToClipboard(url, index)}
                  className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition text-sm"
                >
                  {copied === index ? '✓ Copied!' : '📋 Copy URL'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Tips */}
      <div className="max-w-6xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
          <div className="text-2xl mb-2">🔄</div>
          <h4 className="font-semibold mb-1">Flip Camera</h4>
          <p className="text-sm text-gray-400">
            Use the &quot;Flip Camera&quot; button to switch between front and back cameras
          </p>
        </div>

        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
          <div className="text-2xl mb-2">📶</div>
          <h4 className="font-semibold mb-1">Same Network</h4>
          <p className="text-sm text-gray-400">
            Your phone must be on the same Wi-Fi network as this computer
          </p>
        </div>

        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
          <div className="text-2xl mb-2">🔋</div>
          <h4 className="font-semibold mb-1">Stay Awake</h4>
          <p className="text-sm text-gray-400">
            The app prevents your phone from sleeping while broadcasting
          </p>
        </div>
      </div>
    </div>
  );
}
