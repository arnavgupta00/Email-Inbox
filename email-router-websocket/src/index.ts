import { Hono } from "hono";
import { cors } from "hono/cors";
export { RoomDO } from "./durable-object";

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "https://aliasr.xyz",
      "http://localhost:8787",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.get("/room/:id", async (c) => {
  const id = c.req.param("id");
  const doId = c.env.ROOM.idFromName(id);
  const stub = c.env.ROOM.get(doId);
  const response = await stub.sayHello();
  return response as unknown as Response;
});

// Check if a room is password-protected
app.get("/room/:id/status", async (c) => {
  const id = c.req.param("id");
  const doId = c.env.ROOM.idFromName(id);
  const stub = c.env.ROOM.get(doId);
  return stub.fetch(c.req.raw);
});

// Set password for a room
app.post("/room/:id/password", async (c) => {
  const id = c.req.param("id");
  const doId = c.env.ROOM.idFromName(id);
  const stub = c.env.ROOM.get(doId);
  return stub.fetch(c.req.raw);
});

// Verify password for a room
app.post("/room/:id/verify", async (c) => {
  const id = c.req.param("id");
  const doId = c.env.ROOM.idFromName(id);
  const stub = c.env.ROOM.get(doId);

  // Inject the master key into the request for server-side validation
  const body = await c.req.json();
  const newRequest = new Request(c.req.raw.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      _masterKey: c.env.MASTER_KEY || "",
    }),
  });
  return stub.fetch(newRequest);
});

// WebSocket connection endpoint
app.get("/room/:id/connect", async (c) => {
  const id = c.req.param("id");
  const doId = c.env.ROOM.idFromName(id);
  const stub = c.env.ROOM.get(doId);
  return stub.fetch(c.req.raw);
});

// Webhook endpoint for receiving messages from email-router
app.post("/webhook/room/:id", async (c) => {
  const id = c.req.param("id");
  const doId = c.env.ROOM.idFromName(id);
  const stub = c.env.ROOM.get(doId);
  return stub.fetch(c.req.raw);
});

app.get("/hello", (c) => {
  return c.text("Hello from Aliasr!");
});

export default app;
