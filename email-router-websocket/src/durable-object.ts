import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";

// Allow any JSON object for messages
type Message = Record<string, any>;
type WebhookPayload = Record<string, any>;

export class RoomDO extends DurableObject<CloudflareBindings> {
  state: DurableObjectState;
  env: CloudflareBindings;
  app: Hono;
  sessions: WebSocket[];
  roomId: string | null;

  constructor(state: DurableObjectState, env: CloudflareBindings) {
    super(state, env);
    this.state = state;
    this.env = env;
    this.sessions = [];
    this.roomId = null;

    // Create a Hono app for handling requests within the DO
    this.app = new Hono();

    // Route for handling WebSocket connections
    this.app.get("/room/:id/connect", async (c) => {
      const id = c.req.param("id");
      this.roomId = id;

      console.log("Hey ----");
      // Check if the request is a WebSocket upgrade
      const upgradeHeader = c.req.header("Upgrade");
      if (!upgradeHeader || upgradeHeader !== "websocket") {
        return new Response("Expected WebSocket", { status: 400 });
      }

      // Create WebSocket pair
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      // Add the WebSocket to our sessions list
      this.sessions.push(server);

      this.state.acceptWebSocket(server);

      // Send latest 100 messages to the client after connection
      const chatKey = `messages:${id}`;
      let messages = (await this.state.storage.get<Message[]>(chatKey)) || [];
      // Only send the latest 100 messages
      const latestMessages = messages.slice(-100).reverse();
      // Send as a single JSON array
      queueMicrotask(() => {
        try {
          server.send(
            JSON.stringify({ type: "history", messages: latestMessages })
          );
        } catch (e) {
          // Ignore send errors
        }
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    });

    // Webhook endpoint to receive messages
    this.app.post("/webhook/room/:id", async (c) => {
      const id = c.req.param("id");
      this.roomId = id;
      console.log("Hey ---- 2");

      try {
        const payload = await c.req.json<WebhookPayload>();

        // Store the payload as-is as the message
        const message: Message = payload;

        // Broadcast the message to all connected clients
        await this.broadcast(message);

        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Error processing webhook", e);
        return new Response(JSON.stringify({ error: "Invalid payload" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    });
  }

  // Helper method to broadcast messages to all connected clients
  async broadcast(message: Message) {
    // Store the message in durable storage (optional)
    if (this.roomId) {
      const chatKey = `messages:${this.roomId}`;
      let messages = (await this.state.storage.get<Message[]>(chatKey)) || [];
      messages.push(message);
      // Limit to the most recent 100 messages
      if (messages.length > 10000) {
        messages = messages.slice(-100);
      }
      await this.state.storage.put(chatKey, messages);
    }

    // Broadcast to all connected clients
    const messageText = JSON.stringify(message);
    const deadSessions: WebSocket[] = [];

    this.sessions = this.state.getWebSockets().filter((session) => {
      try {
        session.send(messageText);
        return true;
      } catch (err) {
        deadSessions.push(session);
        return false;
      }
    });
  }

  // Method to handle incoming fetch events
  async fetch(request: Request) {
    return this.app.fetch(request);
  }

  // Keep the existing method
  async sayHello() {
    return new Response("Hello world");
  }
}
