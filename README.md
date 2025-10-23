# Geome Live - The Broadcasting Space

A modern LiveKit-based video conferencing application built with Next.js and React.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm (will be installed automatically)

### 1. Install Dependencies

```bash
cd frontend
pnpm install
```

### 2. Start the Development Server

```bash
pnpm dev
```

### 3. Access the Application

Open http://localhost:3000 in your browser.

## 📱 Features

- **Real-time Video Conferencing**: Powered by LiveKit WebRTC
- **Modern UI**: Clean, responsive interface built with Next.js
- **Customizable Settings**: Camera, microphone, and display options
- **External Stream Support**: Add external video sources
- **Keyboard Shortcuts**: Quick access to common functions
- **Recording Support**: Built-in recording capabilities

## 🏗️ Project Structure

```
frontend/
├── app/                    # Next.js app directory
│   ├── custom/            # Custom video conference page
│   ├── rooms/             # Room-specific pages
│   └── api/               # API routes
├── lib/                   # Utility libraries
│   ├── icons/             # UI icons
│   └── components/        # Reusable components
├── public/                # Static assets
├── styles/                # CSS modules
└── package.json
```

## ⚙️ Configuration

The application uses environment variables for configuration. Create a `.env.local` file in the frontend directory:

```bash
# LiveKit Configuration
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server.com
NEXT_PUBLIC_LIVEKIT_API_KEY=your-api-key
NEXT_PUBLIC_LIVEKIT_API_SECRET=your-api-secret
```

## 🔧 Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm test` - Run tests

### Code Structure

- **Components**: Reusable UI components in `lib/`
- **Pages**: Next.js pages in `app/`
- **Styles**: CSS modules in `styles/`
- **Utils**: Helper functions in `lib/`

## 🎥 Usage

1. **Join a Meeting**: Enter your name and meeting password
2. **Configure Settings**: Adjust camera, microphone, and display settings
3. **Start Broadcasting**: Begin your video conference
4. **Add External Streams**: Include external video sources if needed

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Credits

Built with:
- [LiveKit](https://livekit.io) - WebRTC infrastructure
- [Next.js](https://nextjs.org) - React framework
- [React](https://reactjs.org) - UI library

---

**Created by Geome, Inc** - The Broadcasting Space