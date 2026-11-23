import { DurableObject } from "cloudflare:workers";

/**
 * One board for the whole app. It stores no card data (that is D1's job),
 * it only broadcasts a "something changed" signal so other devices reload the list.
 */
export class Board extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Pings are answered without waking the Durable Object.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /** `from` is the sender's tab id, so that tab does not reload itself. */
  async notify(from: string): Promise<void> {
    const message = JSON.stringify({ type: "changed", from });
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(message);
      } catch {
        // Socket is closing, ignore.
      }
    }
  }

  webSocketClose(socket: WebSocket): void {
    try {
      socket.close(1000, "closing");
    } catch {
      // Already closed.
    }
  }

  webSocketError(socket: WebSocket): void {
    try {
      socket.close(1011, "error");
    } catch {
      // Already closed.
    }
  }
}
