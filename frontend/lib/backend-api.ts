import { 
  ApiResponse, 
  SystemConfig, 
  TokenRequest, 
  TokenResponse, 
  WSEvent,
  CameraScore,
  SwitchDecision,
  NarrationResult
} from './backend-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export class BackendAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async getToken(request: TokenRequest): Promise<ApiResponse<TokenResponse>> {
    const response = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getConfig(): Promise<ApiResponse<SystemConfig>> {
    const response = await fetch(`${this.baseUrl}/config`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getHealth(): Promise<{ status: string; timestamp: number }> {
    const response = await fetch(`${this.baseUrl}/health`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  createWebSocketConnection(): WebSocket {
    const wsUrl = this.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    return new WebSocket(`${wsUrl}/ws`);
  }

  // WebSocket event handlers
  onWebSocketEvent(
    ws: WebSocket,
    callbacks: {
      onSwitch?: (decision: SwitchDecision) => void;
      onScore?: (score: CameraScore) => void;
      onNarration?: (narration: NarrationResult) => void;
      onStatus?: (status: any) => void;
      onError?: (error: any) => void;
    }
  ): () => void {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data: WSEvent = JSON.parse(event.data);
        
        switch (data.type) {
          case 'switch':
            callbacks.onSwitch?.(data.payload);
            break;
          case 'score':
            callbacks.onScore?.(data.payload);
            break;
          case 'narration':
            callbacks.onNarration?.(data.payload);
            break;
          case 'status':
            callbacks.onStatus?.(data.payload);
            break;
          case 'error':
            callbacks.onError?.(data.payload);
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        callbacks.onError?.(error);
      }
    };

    ws.addEventListener('message', handleMessage);

    // Return cleanup function
    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }
}

// Create a singleton instance
export const backendAPI = new BackendAPI();
