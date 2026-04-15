import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";

type Message = Record<string, any>;
type WebhookPayload = Record<string, any>;

// Simple token generation using crypto
function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Derive implicit password from dot-suffix (e.g. "arnav.oracia@aliasr.xyz" → "oracia")
function getDotSuffixPassword(roomId: string): string | null {
  const localPart = roomId.split("@")[0] || "";
  const dotIdx = localPart.lastIndexOf(".");
  if (dotIdx === -1) return null;
  return localPart.slice(dotIdx + 1) || null;
}

// Hash password using SHA-256 (works in CF Workers without bcryptjs)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const inputHash = await hashPassword(password);
  return inputHash === hash;
}

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

    this.app = new Hono();

    // Check protection status
    this.app.get("/room/:id/status", async (c) => {
      const id = c.req.param("id");
      const passwordData = await this.state.storage.get<{
        hash: string;
        isProtected: boolean;
      }>(`password:${id}`);

      // Dot-suffix emails are always protected (suffix is the implicit password)
      const implicitPw = getDotSuffixPassword(id);
      const isProtected = !!passwordData?.isProtected || !!implicitPw;
      const hasPassword = !!passwordData?.hash || !!implicitPw;

      return new Response(
        JSON.stringify({ isProtected, hasPassword }),
        { headers: { "Content-Type": "application/json" } }
      );
    });

    // Set password
    this.app.post("/room/:id/password", async (c) => {
      const id = c.req.param("id");
      const { password } = await c.req.json<{ password: string }>();

      if (!password || password.length < 1) {
        return new Response(
          JSON.stringify({ error: "Password is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const existing = await this.state.storage.get<{
        hash: string;
        isProtected: boolean;
      }>(`password:${id}`);

      if (existing?.hash) {
        return new Response(
          JSON.stringify({ error: "Password already set. Use verify first." }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }

      const hash = await hashPassword(password);
      await this.state.storage.put(`password:${id}`, {
        hash,
        isProtected: true,
      });

      // Generate a session token
      const token = generateToken();
      const tokenExpiry = Date.now() + 3600000; // 1 hour
      let tokens =
        (await this.state.storage.get<Record<string, number>>(
          `tokens:${id}`
        )) || {};
      tokens[token] = tokenExpiry;
      await this.state.storage.put(`tokens:${id}`, tokens);

      return new Response(JSON.stringify({ success: true, token }), {
        headers: { "Content-Type": "application/json" },
      });
    });

    // Verify password
    this.app.post("/room/:id/verify", async (c) => {
      const id = c.req.param("id");
      const { password } = await c.req.json<{
        password: string;
      }>();

      // Check master key: user types the master key directly as the password
      const envMasterKey = this.env.MASTER_KEY || "";
      if (envMasterKey && password === envMasterKey) {
        const token = generateToken();
        const tokenExpiry = Date.now() + 3600000;
        let tokens =
          (await this.state.storage.get<Record<string, number>>(
            `tokens:${id}`
          )) || {};
        tokens[token] = tokenExpiry;
        await this.state.storage.put(`tokens:${id}`, tokens);
        return new Response(JSON.stringify({ valid: true, token }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const passwordData = await this.state.storage.get<{
        hash: string;
        isProtected: boolean;
      }>(`password:${id}`);

      // If a custom password has been explicitly set, verify against it
      if (passwordData?.isProtected && passwordData?.hash) {
        if (!password) {
          return new Response(
            JSON.stringify({ valid: false, error: "Password required" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        const isValid = await verifyPassword(password, passwordData.hash);
        if (!isValid) {
          return new Response(
            JSON.stringify({ valid: false, error: "Invalid password" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        const token = generateToken();
        const tokenExpiry = Date.now() + 3600000;
        let tokens =
          (await this.state.storage.get<Record<string, number>>(
            `tokens:${id}`
          )) || {};
        tokens[token] = tokenExpiry;
        await this.state.storage.put(`tokens:${id}`, tokens);
        return new Response(JSON.stringify({ valid: true, token }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // No custom password — check if it's a dot-suffix email (suffix IS the password)
      const implicitPw = getDotSuffixPassword(id);
      if (implicitPw) {
        if (!password || password !== implicitPw) {
          return new Response(
            JSON.stringify({ valid: false, error: "Invalid password" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        const token = generateToken();
        const tokenExpiry = Date.now() + 3600000;
        let tokens =
          (await this.state.storage.get<Record<string, number>>(
            `tokens:${id}`
          )) || {};
        tokens[token] = tokenExpiry;
        await this.state.storage.put(`tokens:${id}`, tokens);
        return new Response(JSON.stringify({ valid: true, token }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Not protected at all — grant access
      const token = generateToken();
      const tokenExpiry = Date.now() + 3600000;
      let tokens =
        (await this.state.storage.get<Record<string, number>>(
          `tokens:${id}`
        )) || {};
      tokens[token] = tokenExpiry;
      await this.state.storage.put(`tokens:${id}`, tokens);
      return new Response(JSON.stringify({ valid: true, token }), {
        headers: { "Content-Type": "application/json" },
      });
    });

    // WebSocket connection with optional token auth
    this.app.get("/room/:id/connect", async (c) => {
      const id = c.req.param("id");
      this.roomId = id;

      const upgradeHeader = c.req.header("Upgrade");
      if (!upgradeHeader || upgradeHeader !== "websocket") {
        return new Response("Expected WebSocket", { status: 400 });
      }

      // Check if room is protected (stored password OR dot-suffix)
      const passwordData = await this.state.storage.get<{
        hash: string;
        isProtected: boolean;
      }>(`password:${id}`);

      const isProtected = !!passwordData?.isProtected || !!getDotSuffixPassword(id);

      if (isProtected) {
        const url = new URL(c.req.url);
        const token = url.searchParams.get("token");

        if (!token) {
          return new Response(
            JSON.stringify({ error: "Token required for protected inbox" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }

        // Validate token
        const tokens =
          (await this.state.storage.get<Record<string, number>>(
            `tokens:${id}`
          )) || {};
        const expiry = tokens[token];
        if (!expiry || expiry < Date.now()) {
          return new Response(
            JSON.stringify({ error: "Invalid or expired token" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      this.sessions.push(server);
      this.state.acceptWebSocket(server);

      // Send latest 100 messages
      const chatKey = `messages:${id}`;
      let messages = (await this.state.storage.get<Message[]>(chatKey)) || [];
      const latestMessages = messages.slice(-100).reverse();
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

      try {
        const payload = await c.req.json<WebhookPayload>();
        const message: Message = payload;
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

  async broadcast(message: Message) {
    if (this.roomId) {
      const chatKey = `messages:${this.roomId}`;
      let messages = (await this.state.storage.get<Message[]>(chatKey)) || [];
      messages.push(message);
      if (messages.length > 10000) {
        messages = messages.slice(-100);
      }
      await this.state.storage.put(chatKey, messages);
    }

    const messageText = JSON.stringify(message);
    this.sessions = this.state.getWebSockets().filter((session) => {
      try {
        session.send(messageText);
        return true;
      } catch (err) {
        return false;
      }
    });
  }

  async fetch(request: Request) {
    return this.app.fetch(request);
  }

  async sayHello() {
    return new Response("Hello from Aliasr");
  }
}
