"use client";

import { useState, useEffect, use as usePromise } from "react";
import { Navbar } from "@/components/navbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import sanitizeHtml from "sanitize-html";
import React, { useRef } from "react";
import { Dialog } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";

const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL || "https://aliasr-ws.aliasr.xyz";

// --------------------------------------------------
// Types
// --------------------------------------------------
interface EmailAddress {
  address: string;
  name: string;
}

interface IncomingEmail {
  subject: string;
  from: EmailAddress | any;
  to: EmailAddress[] | any;
  text: string;
  html: string;
  timestamp?: string | number;
}

interface Email extends Omit<IncomingEmail, "timestamp"> {
  id: string;
  read: boolean;
  timestamp: Date;
  originalHtml?: string;
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------
function hasDotSuffix(email: string): boolean {
  const localPart = email.split("@")[0] || "";
  return localPart.includes(".");
}

function purifyHtml(rawHtml = ""): string {
  return sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags,
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": [
        ...(sanitizeHtml.defaults.allowedAttributes["*"] || []),
        "style",
      ],
    },
    transformTags: {
      "*": (tagName, attribs) => {
        if (attribs.style) {
          attribs.style = attribs.style
            .replace(/color\s*:[^;]+;?/gi, "")
            .replace(/background(?:-color)?\s*:[^;]+;?/gi, "")
            .trim();
          if (!attribs.style) delete attribs.style;
        }
        return { tagName, attribs } as unknown as sanitizeHtml.Tag;
      },
    },
  });
}

function prepareHtml(rawHtml: string | undefined): string {
  if (!rawHtml) return "";
  const clean = purifyHtml(rawHtml);
  return `<div class="email-dark-invert">${clean}</div>`;
}

function toEmail(payload: IncomingEmail): Email {
  return {
    ...payload,
    id: crypto.randomUUID(),
    timestamp: new Date(payload.timestamp ?? Date.now()),
    read: false,
    html: prepareHtml(payload.html),
    originalHtml: payload.html,
  };
}

// --------------------------------------------------
// Password Gate Component
// --------------------------------------------------
function PasswordGate({
  email,
  isProtected,
  hasPassword,
  onAuthenticated,
}: {
  email: string;
  isProtected: boolean;
  hasPassword: boolean;
  onAuthenticated: (token: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isSettingPassword = isProtected && !hasPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSettingPassword) {
        if (password !== confirmPassword) {
          setError("Passwords do not match");
          setLoading(false);
          return;
        }
        // Set password
        const res = await fetch(`${WS_BASE_URL}/room/${email}/password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = (await res.json()) as {
          success?: boolean;
          token?: string;
          error?: string;
        };
        if (data.success && data.token) {
          sessionStorage.setItem(`aliasr_token_${email}`, data.token);
          onAuthenticated(data.token);
        } else {
          setError(data.error || "Failed to set password");
        }
      } else {
        // Verify password
        const res = await fetch(`${WS_BASE_URL}/room/${email}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = (await res.json()) as {
          valid?: boolean;
          token?: string;
          error?: string;
        };
        if (data.valid && data.token) {
          sessionStorage.setItem(`aliasr_token_${email}`, data.token);
          onAuthenticated(data.token);
        } else {
          setError(data.error || "Invalid password");
        }
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-screen flex flex-col bg-[linear-gradient(135deg,#05090d_0%,#05090d_25%,#0f0b1a_60%,#332137_100%)]"
    >
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="max-w-sm w-full space-y-6"
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/20 mb-4">
              <svg
                width="32"
                height="32"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-purple-400"
              >
                <rect x="3" y="11" width="26" height="16" rx="2" />
                <path d="M7 11V7a9 9 0 1 1 18 0v4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {isSettingPassword ? "Set Password" : "Protected Inbox"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 break-all">
              {email}
            </p>
            {isSettingPassword && (
              <p className="text-xs text-purple-300 mt-1">
                This inbox requires a password. Set one to continue.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder={
                  isSettingPassword ? "Create password" : "Enter password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-purple-700/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-purple-500 transition-colors"
                autoFocus
              />
            </div>
            {isSettingPassword && (
              <div>
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-purple-700/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            )}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-400 text-center"
              >
                {error}
              </motion.div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-purple-700 hover:bg-purple-600 text-white font-medium transition-all disabled:opacity-50"
            >
              {loading
                ? "..."
                : isSettingPassword
                ? "Set Password & Enter"
                : "Unlock Inbox"}
            </button>
          </form>
        </motion.div>
      </div>
    </motion.main>
  );
}

// --------------------------------------------------
// Skeleton loader
// --------------------------------------------------
function EmailSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="p-3 rounded-md animate-pulse">
          <div className="flex justify-between items-start mb-2">
            <div className="h-4 bg-secondary rounded w-32" />
            <div className="h-3 bg-secondary rounded w-16" />
          </div>
          <div className="h-4 bg-secondary rounded w-48 mb-1" />
          <div className="h-3 bg-secondary rounded w-64" />
        </div>
      ))}
    </div>
  );
}

// --------------------------------------------------
// Main Inbox Component
// --------------------------------------------------
export default function InboxPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const resolvedParams = usePromise(params);
  const decodedEmail = decodeURIComponent(resolvedParams.email);

  // Password protection state
  const [authState, setAuthState] = useState<
    "checking" | "needs_password" | "needs_set_password" | "authenticated"
  >("checking");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [roomProtected, setRoomProtected] = useState(false);
  const [roomHasPassword, setRoomHasPassword] = useState(false);

  // Email state
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [viewMode, setViewMode] = useState<"text" | "html" | "originalHtml">(
    "html"
  );
  const [wsConnected, setWsConnected] = useState(false);

  // Sidebar resizing
  const [sidebarWidth, setSidebarWidth] = useState(550);
  const isResizing = useRef(false);

  // Password protection check & optional password add
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [addPwValue, setAddPwValue] = useState("");
  const [addPwConfirm, setAddPwConfirm] = useState("");
  const [addPwError, setAddPwError] = useState("");
  const [addPwLoading, setAddPwLoading] = useState(false);

  // Check if room is protected on mount
  useEffect(() => {
    if (!decodedEmail) return;

    (async () => {
      try {
        // Check for existing token in sessionStorage
        const existingToken = sessionStorage.getItem(
          `aliasr_token_${decodedEmail}`
        );

        const res = await fetch(`${WS_BASE_URL}/room/${decodedEmail}/status`);
        const data = (await res.json()) as {
          isProtected?: boolean;
          hasPassword?: boolean;
        };

        setRoomProtected(!!data.isProtected);
        setRoomHasPassword(!!data.hasPassword);

        const isDotSuffix = hasDotSuffix(decodedEmail.split("@")[0] || "");

        if (data.isProtected && data.hasPassword) {
          if (existingToken) {
            // Try with existing token - will validate on WS connect
            setAuthToken(existingToken);
            setAuthState("authenticated");
          } else {
            setAuthState("needs_password");
          }
        } else if (isDotSuffix && !data.hasPassword) {
          // Dot-suffix email with no password yet — force password setup
          setRoomProtected(true);
          setAuthState("needs_set_password");
        } else {
          setAuthState("authenticated");
        }
      } catch {
        // If status check fails, allow access (graceful degradation)
        setAuthState("authenticated");
      }
    })();
  }, [decodedEmail]);

  // Sidebar resize handlers
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isResizing.current) return;
      setSidebarWidth(Math.max(220, Math.min(600, e.clientX)));
    }
    function onMouseUp() {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // WebSocket connection
  useEffect(() => {
    if (!decodedEmail || authState !== "authenticated") return;

    let ws: WebSocket | null = null;

    (async () => {
      let url = `wss://${WS_BASE_URL.replace(/^https?:\/\//, "")}/room/${decodedEmail}/connect`;
      if (authToken) {
        url += `?token=${authToken}`;
      }
      ws = new WebSocket(url);

      ws.addEventListener("open", () => {
        setWsConnected(true);
      });

      ws.addEventListener("message", (event) => {
        try {
          const data:
            | IncomingEmail
            | { type: "history"; messages: IncomingEmail[] } = JSON.parse(
            event.data
          );

          if (
            "type" in data &&
            data.type === "history" &&
            Array.isArray(data.messages)
          ) {
            const mapped = data.messages.map(toEmail);
            setEmails((prev) => [...mapped, ...prev]);
            setSelectedEmail(
              (sel) => sel ?? (mapped.length > 0 ? mapped[0] : null)
            );
          } else {
            const mapped = [toEmail(data as IncomingEmail)];
            setEmails((prev) => [...mapped, ...prev]);
            setSelectedEmail((sel) => sel ?? mapped[0]);
          }
        } catch (err) {
          console.error("Failed to parse WS message", err);
        }
      });

      ws.addEventListener("error", () => {
        // Token might be invalid; clear it
        if (authToken) {
          sessionStorage.removeItem(`aliasr_token_${decodedEmail}`);
          setAuthState("needs_password");
        }
      });
      ws.addEventListener("close", () => {
        setWsConnected(false);
      });
    })();

    return () => {
      if (ws && ws.readyState === ws.OPEN) ws.close();
    };
  }, [decodedEmail, authState, authToken]);

  // Compose dialog state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState({
    to: "",
    subject: "",
    text: "",
    html: "",
    attachments: [] as File[],
  });

  async function storeEmail(email: any) {
    await fetch(`${WS_BASE_URL}/webhook/room/${email.from.address}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: email.subject,
        from: email.from.address,
        to: email.to[0].address,
        text: email.text,
        html: email.html,
        attachments: email.attachments,
        timestamp: email.timestamp,
        storage: true,
      }),
    }).catch((error) => console.error("Storage error:", error));
  }

  const handleComposeSend = async () => {
    const composed = {
      subject: composeData.subject,
      from: { address: decodedEmail, name: "" },
      to: [{ address: composeData.to, name: "" }],
      text: composeData.text,
      html: composeData.html,
      attachments: composeData.attachments,
      timestamp: new Date(),
    };
    await storeEmail(composed);
    setComposeOpen(false);
    setComposeData({ to: "", subject: "", text: "", html: "", attachments: [] });
  };

  const handleAddPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddPwError("");
    if (addPwValue !== addPwConfirm) {
      setAddPwError("Passwords do not match");
      return;
    }
    setAddPwLoading(true);
    try {
      const res = await fetch(`${WS_BASE_URL}/room/${decodedEmail}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: addPwValue }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        token?: string;
        error?: string;
      };
      if (data.success && data.token) {
        sessionStorage.setItem(`aliasr_token_${decodedEmail}`, data.token);
        setAuthToken(data.token);
        setRoomProtected(true);
        setRoomHasPassword(true);
        setShowAddPassword(false);
        setAddPwValue("");
        setAddPwConfirm("");
      } else {
        setAddPwError(data.error || "Failed to set password");
      }
    } catch {
      setAddPwError("Connection error");
    } finally {
      setAddPwLoading(false);
    }
  };

  // --- Loading / Auth Gate ---
  if (authState === "checking") {
    return (
      <main className="h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-muted-foreground"
        >
          Loading...
        </motion.div>
      </main>
    );
  }

  if (authState === "needs_password" || authState === "needs_set_password") {
    return (
      <PasswordGate
        email={decodedEmail}
        isProtected={roomProtected}
        hasPassword={roomHasPassword}
        onAuthenticated={(token) => {
          setAuthToken(token);
          setAuthState("authenticated");
        }}
      />
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="h-screen overflow-hidden flex flex-col bg-background"
    >
      <Navbar />
      <div
        className="flex-1 flex flex-col md:flex-row min-h-0"
        style={{ padding: "24px" }}
      >
        {/* Email list sidebar */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="border-r border-border flex flex-col min-h-0 bg-card shadow-sm"
          style={{
            width: sidebarWidth,
            minWidth: 220,
            maxWidth: 600,
            transition: isResizing.current ? "none" : "width 0.15s",
            borderRadius: "12px 0 0 12px",
          }}
        >
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Inbox</h2>
              {!roomProtected && !roomHasPassword && (
                <button
                  onClick={() => setShowAddPassword(true)}
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                  title="Add password protection"
                >
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="2" y="7" width="10" height="6" rx="1" />
                    <path d="M4 7V5a3 3 0 1 1 6 0v2" />
                  </svg>
                  Protect
                </button>
              )}
              {roomProtected && (
                <span className="text-xs text-purple-400 flex items-center gap-1">
                  <svg
                    width="12"
                    height="12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="2" y="6" width="8" height="5" rx="1" />
                    <path d="M3.5 6V4.5a2.5 2.5 0 0 1 5 0V6" />
                  </svg>
                  Protected
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground break-all mt-1">
              {decodedEmail}
            </p>
          </div>
          <ScrollArea className="flex-1 min-h-0 overflow-auto">
            {!wsConnected ? (
              <EmailSkeleton />
            ) : emails.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-muted-foreground py-8"
              >
                No messages yet
              </motion.div>
            ) : (
              <div className="space-y-1 p-2">
                <AnimatePresence>
                  {emails.map((email, idx) => (
                    <motion.div
                      key={email.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2, delay: idx * 0.03 }}
                      className={`p-3 rounded-md cursor-pointer transition-colors ${
                        selectedEmail?.id === email.id
                          ? "bg-secondary"
                          : "hover:bg-secondary/50"
                      } ${
                        !email.read ? "border-l-2 border-purple-500" : ""
                      }`}
                      onClick={() => setSelectedEmail(email)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium truncate">
                          {email.from.name || email.from.address || (
                            <span className="inline-flex items-center gap-1">
                              <svg
                                width="16"
                                height="16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-muted-foreground"
                              >
                                <path d="M2 8h12M10 5l4 3-4 3" />
                              </svg>
                              {email.to}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          {formatDistanceToNow(email.timestamp, {
                            addSuffix: true,
                          })}
                        </div>
                      </div>
                      <div className="text-sm font-medium truncate">
                        {email.subject}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {(email.text || "").substring(0, 60)}...
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </motion.div>

        {/* Resizer */}
        <div
          style={{
            width: 8,
            cursor: "col-resize",
            background:
              "linear-gradient(to right, transparent 30%, #8883 50%, transparent 70%)",
            zIndex: 10,
            userSelect: "none",
          }}
          onMouseDown={() => {
            isResizing.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          className="hidden md:block"
        />

        {/* Email content */}
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="flex-1 flex flex-col min-h-0 bg-card shadow-sm"
          style={{
            borderRadius: "0 12px 12px 0",
            minWidth: 0,
          }}
        >
          <AnimatePresence mode="wait">
            {selectedEmail ? (
              <motion.div
                key={selectedEmail.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col flex-1 min-h-0"
              >
                <div className="p-8 border-b border-border">
                  <div className="flex items-start gap-4">
                    <Avatar>
                      <AvatarImage
                        src={`/placeholder.svg?height=40&width=40`}
                      />
                      <AvatarFallback>
                        {(
                          selectedEmail.from.name ||
                          selectedEmail.from ||
                          selectedEmail.from.address
                        )[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1 overflow-hidden">
                      <h2 className="text-xl font-semibold break-words">
                        {selectedEmail.subject}
                      </h2>
                      <div className="flex items-center text-sm text-muted-foreground flex-wrap gap-x-1">
                        <span className="font-medium break-all">
                          {selectedEmail.from.name ||
                            selectedEmail.from.address}
                        </span>
                        <span className="mx-1 hidden sm:inline">•</span>
                        <span className="break-all">
                          {selectedEmail.from.address}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {selectedEmail.timestamp.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* View mode toggle */}
                  <div className="mt-4 flex gap-2">
                    <button
                      className={`px-3 py-1 rounded-md text-sm border transition-all ${
                        viewMode === "text"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary border-transparent hover:border-border"
                      }`}
                      onClick={() => setViewMode("text")}
                    >
                      Plain text
                    </button>
                    {selectedEmail.html && (
                      <button
                        className={`px-3 py-1 rounded-md text-sm border transition-all ${
                          viewMode === "html"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary border-transparent hover:border-border"
                        }`}
                        onClick={() => setViewMode("html")}
                      >
                        Darkened HTML
                      </button>
                    )}
                    {selectedEmail.originalHtml && (
                      <button
                        className={`px-3 py-1 rounded-md text-sm border transition-all ${
                          viewMode === "originalHtml"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary border-transparent hover:border-border"
                        }`}
                        onClick={() => setViewMode("originalHtml")}
                      >
                        Original HTML
                      </button>
                    )}
                  </div>
                </div>

                <ScrollArea className="flex-1 min-h-0 p-8 overflow-auto">
                  <div className="flex justify-center">
                    <div className="max-w-3xl w-full">
                      {viewMode === "text" ? (
                        <pre className="whitespace-pre-wrap text-sm">
                          {selectedEmail.text || "(no text content)"}
                        </pre>
                      ) : viewMode === "html" ? (
                        <article
                          className="prose prose-sm max-w-none dark:prose-invert text-foreground [&_*]:!text-current"
                          dangerouslySetInnerHTML={{
                            __html: selectedEmail.html,
                          }}
                        />
                      ) : (
                        <article
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: selectedEmail.originalHtml || "",
                          }}
                        />
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex items-center justify-center text-muted-foreground"
              >
                {emails.length === 0
                  ? "Waiting for emails..."
                  : "Select an email to view"}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Compose Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
        className="fixed bottom-8 right-8 z-50 bg-primary text-primary-foreground rounded-full shadow-lg p-4 hover:bg-primary/90 hover:scale-105 transition-all flex items-center gap-2"
        onClick={() => setComposeOpen(true)}
        aria-label="Compose"
        style={{ boxShadow: "0 4px 24px #0002" }}
      >
        <svg
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      </motion.button>

      {/* Compose Dialog */}
      <Dialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        className="fixed z-50 inset-0 flex items-center justify-center"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40"
          aria-hidden="true"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="relative bg-card rounded-xl shadow-xl w-full max-w-lg mx-auto p-6"
        >
          <Dialog.Title className="text-lg font-semibold mb-4">
            Compose Mail
          </Dialog.Title>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleComposeSend();
            }}
          >
            <div>
              <label className="block text-sm font-medium mb-1">To</label>
              <input
                type="email"
                required
                className="w-full px-3 py-2 rounded-md border bg-background text-foreground"
                value={composeData.to}
                onChange={(e) =>
                  setComposeData((d) => ({ ...d, to: e.target.value }))
                }
                placeholder="recipient@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <input
                type="text"
                className="w-full px-3 py-2 rounded-md border bg-background text-foreground"
                value={composeData.subject}
                onChange={(e) =>
                  setComposeData((d) => ({ ...d, subject: e.target.value }))
                }
                placeholder="Subject"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea
                className="w-full px-3 py-2 rounded-md border bg-background text-foreground min-h-[100px]"
                value={composeData.text}
                onChange={(e) =>
                  setComposeData((d) => ({ ...d, text: e.target.value }))
                }
                placeholder="Write your message..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                HTML (optional)
              </label>
              <textarea
                className="w-full px-3 py-2 rounded-md border bg-background text-foreground min-h-[60px]"
                value={composeData.html}
                onChange={(e) =>
                  setComposeData((d) => ({ ...d, html: e.target.value }))
                }
                placeholder="<b>HTML content</b>"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Attachments
              </label>
              <input
                type="file"
                multiple
                onChange={(e) =>
                  setComposeData((d) => ({
                    ...d,
                    attachments: Array.from(e.target.files || []),
                  }))
                }
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                className="px-4 py-2 rounded-md bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
                onClick={() => setComposeOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Send
              </button>
            </div>
          </form>
        </motion.div>
      </Dialog>

      {/* Add Password Dialog */}
      <Dialog
        open={showAddPassword}
        onClose={() => setShowAddPassword(false)}
        className="fixed z-50 inset-0 flex items-center justify-center"
      >
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative bg-card rounded-xl shadow-xl w-full max-w-sm mx-auto p-6"
        >
          <Dialog.Title className="text-lg font-semibold mb-2">
            Add Password Protection
          </Dialog.Title>
          <p className="text-sm text-muted-foreground mb-4">
            Protect this inbox so only people with the password can view it.
          </p>
          <form onSubmit={handleAddPassword} className="space-y-3">
            <input
              type="password"
              placeholder="Create password"
              value={addPwValue}
              onChange={(e) => setAddPwValue(e.target.value)}
              className="w-full px-3 py-2 rounded-md border bg-background text-foreground"
              autoFocus
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={addPwConfirm}
              onChange={(e) => setAddPwConfirm(e.target.value)}
              className="w-full px-3 py-2 rounded-md border bg-background text-foreground"
            />
            {addPwError && (
              <div className="text-sm text-red-400">{addPwError}</div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-md bg-secondary text-foreground border border-border"
                onClick={() => setShowAddPassword(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addPwLoading}
                className="px-4 py-2 rounded-md bg-purple-700 text-white hover:bg-purple-600 transition-colors disabled:opacity-50"
              >
                {addPwLoading ? "..." : "Set Password"}
              </button>
            </div>
          </form>
        </motion.div>
      </Dialog>
    </motion.main>
  );
}
