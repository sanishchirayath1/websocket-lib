export enum WebSocketState {
  CONNECTING,
  OPEN,
  CLOSING,
  CLOSED,
}

export class WebSocketClient {
  private ws!: WebSocket;
  private state: WebSocketState;
  private retryCount: number;
  private maxRetryCount: number;
  private retryDelay: number;
  private pingInterval: number;
  private pingTimer: ReturnType<typeof setInterval> | null;

  constructor(
    private url: string,
    options?: {
      maxRetryCount?: number;
      retryDelay?: number;
      pingInterval?: number;
    }
  ) {
    this.state = WebSocketState.CONNECTING;
    this.retryCount = 0;
    this.maxRetryCount = options?.maxRetryCount ?? 5;
    this.retryDelay = options?.retryDelay ?? 1000;
    this.pingInterval = options?.pingInterval ?? 30000; // Default to 30 seconds
    this.pingTimer = null;
    this.connect();
  }

  private connect(): void {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.state = WebSocketState.OPEN;
      this.startPing();
    };
    this.ws.onclose = () => {
      this.state = WebSocketState.CLOSED;
      this.stopPing();
      if (this.retryCount < this.maxRetryCount) {
        this.retryCount++;
        setTimeout(() => this.connect(), this.retryDelay);
      }
    };
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.state === WebSocketState.OPEN) {
        this.sendPing();
      }
    }, this.pingInterval);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private sendPing(): void {
    this.ws.send("ping");
  }

  send(message: string): void {
    if (this.state !== WebSocketState.OPEN) {
      throw new Error(
        `WebSocket not in open state, current state: ${this.state}`
      );
    }
    this.ws.send(message);
  }

  close(): void {
    if (this.state === WebSocketState.OPEN) {
      this.state = WebSocketState.CLOSING;
      this.stopPing();
      this.ws.close();
    }
  }

  onMessage(callback: (message: string) => void): void {
    this.ws.onmessage = (event: MessageEvent) => {
      const message = event.data;
      if (message === "pong") {
        // Ignore pong messages
        return;
      }
      callback(message);
    };
  }

  onError(callback: (error: Error) => void): void {
    this.ws.onerror = (event: Event) => {
      const error = new Error("WebSocket error");
      callback(error);
    };
  }

  onClose(callback: () => void): void {
    this.ws.onclose = () => {
      callback();
    };
  }
}
