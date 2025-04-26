"use client";

import { useState, useEffect, use as usePromise } from "react";
import { Navbar } from "@/components/navbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import sanitizeHtml from "sanitize-html";
import React, { useRef } from "react";
import { Dialog } from "@headlessui/react"; // Add this import

/*****************************************************************************************
 * InboxPage — colour‑reversal edition                                                    *
 * -------------------------------------------------------------------------------------- *
 * Goal: render *any* inbound HTML e‑mail in our dark UI without unreadable black text or *
 *       manually deleting every inline style.                                             *
 *                                                                                       *
 * Strategy                                                                               *
 * 1.  Sanitize the markup for safety.                                                    *
 * 2.  Strip ONLY colour / background declarations (keeps layout & fonts).                *
 * 3a. If the e‑mail already declares its own background => trust it, just return HTML.   *
 * 3b. Otherwise wrap the HTML in a <div class="email-dark-invert"> which is styled via   *
 *     global CSS to `filter: invert(1) hue-rotate(180deg)` **in dark mode only**.        *
 *     That reverses the colour scheme—black → white, white → black, etc.—while another   *
 *     nested rule re‑inverts images so photos remain natural.                             *
 *****************************************************************************************/

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
  originalHtml?: string; // Store original HTML
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------
const BG_REGEX = /background(?:-color)?\s*:|\bbgcolor\s*=/i;

function purifyHtml(rawHtml = ""): string {
  return sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags,
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": [
        ...(sanitizeHtml.defaults.allowedAttributes["*"] || []),
        "style", // preserve inline layout rules
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
  const hasBg = false;
  const clean = purifyHtml(rawHtml);

  // If no explicit background, wrap & invert in dark mode only
  return hasBg ? clean : `<div class="email-dark-invert">${clean}</div>`;
}

const mockEmails: Email[] = [];

function toEmail(payload: IncomingEmail): Email {
  return {
    ...payload,
    id: crypto.randomUUID(),
    timestamp: new Date(payload.timestamp ?? Date.now()),
    read: false,
    html: prepareHtml(payload.html),
    originalHtml: payload.html, // Save original HTML
  };
}

// --------------------------------------------------
// Component
// --------------------------------------------------
export default function InboxPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  // Unwrap params promise (App Router "use")
  const resolvedParams = usePromise(params);
  const decodedEmail = decodeURIComponent(resolvedParams.email);

  const [emails, setEmails] = useState<Email[]>(mockEmails);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [viewMode, setViewMode] = useState<"text" | "html" | "originalHtml">(
    "html"
  );
  const [wsConnected, setWsConnected] = useState(false);

  // Sidebar resizing state
  const [sidebarWidth, setSidebarWidth] = useState(550); // px
  const isResizing = useRef(false);

  // Mouse event handlers for resizing
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isResizing.current) return;
      const min = 220,
        max = 600;
      setSidebarWidth(Math.max(min, Math.min(max, e.clientX)));
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

  // --------------------------------------------------
  // WebSocket: connect once per email alias
  // --------------------------------------------------
  useEffect(() => {
    if (!decodedEmail) return;

    let ws: WebSocket | null = null;

    (async () => {
      const url = `wss://durable-object-pubsub.adv-dep-test.workers.dev/room/${decodedEmail}/connect`;
      ws = new WebSocket(url);

      ws.addEventListener("open", () => {
        console.info("📬 WebSocket connected");
        setWsConnected(true);
      });

      ws.addEventListener("message", (event) => {
        try {
          const data:
            | IncomingEmail
            | {
                type: "history";
                messages: IncomingEmail[];
              } = JSON.parse(event.data);

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

            console.log("New email:", mapped);
          }
        } catch (err) {
          console.error("❌ Failed to parse incoming WS message", err);
        }
      });

      ws.addEventListener("error", (err) => console.error("WS error", err));
      ws.addEventListener("close", () => {
        console.info("📭 WebSocket closed");
        setWsConnected(false);
      });
    })();

    return () => {
      if (ws && ws.readyState === ws.OPEN) ws.close();
    };
  }, [decodedEmail]);

  // Compose dialog state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState<{
    to: string;
    subject: string;
    text: string;
    html: string;
    attachments: File[];
  }>({
    to: "",
    subject: "",
    text: "",
    html: "",
    attachments: [],
  });
  async function storeEmail(email: any) {
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: email.subject,
        from: email.from.address,
        to: email.to[0].address,
        text: email.text,
        html: email.html,
        attachments: email.attachments,
        timestamp: email.timestamp,
        // You can add a flag or extra field if needed to distinguish storage
        storage: true,
      }),
    };
    await fetch(
      `https://durable-object-pubsub.adv-dep-test.workers.dev/webhook/room/${email.from.address}`,
      requestOptions
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((result) => console.log("Stored email:", result))
      .catch((error) => console.error("Storage error:", error));
  }

  // Store composed emails (for demo, just log or push to a local array)
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
    // For demo: log or push to a local array
    console.log("Composed email:", composed);
    // Optionally: setEmails(prev => [toEmail(composed), ...prev]);
    await storeEmail(composed);

    setComposeOpen(false);
    setComposeData({
      to: "",
      subject: "",
      text: "",
      html: "",
      attachments: [],
    });
  };

  return (
    <main className="h-screen overflow-hidden flex flex-col bg-background">
      <Navbar />
      <div
        className="flex-1 flex flex-col md:flex-row min-h-0"
        style={{ padding: "24px" }}
      >
        {/* Email list sidebar */}
        <div
          className="border-r border-border flex flex-col min-h-0 bg-card shadow-sm"
          style={{
            width: sidebarWidth,
            minWidth: 220,
            maxWidth: 600,
            transition: isResizing.current ? "none" : "width 0.15s",
            borderRadius: "12px 0 0 12px",
            marginRight: 0,
            padding: "0 0 0 0",
            boxSizing: "border-box",
          }}
        >
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Inbox</h2>
            <p className="text-sm text-muted-foreground break-all">
              {decodedEmail ?? "alias@temp-mail.com"}
            </p>
          </div>
          <ScrollArea className="flex-1 min-h-0 overflow-auto">
            <div className="space-y-1 p-2">
              {!wsConnected ? (
                <div className="text-center text-muted-foreground py-8">
                  Loading...
                </div>
              ) : emails.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No messages
                </div>
              ) : (
                emails.map((email) => (
                  <div
                    key={email.id}
                    className={`p-3 rounded-md cursor-pointer transition-colors ${
                      selectedEmail?.id === email.id
                        ? "bg-secondary"
                        : "hover:bg-secondary/50"
                    } ${!email.read ? "border-l-2 border-purple-500" : ""}`}
                    onClick={() => setSelectedEmail(email)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-medium">
                        {email.from.name || email.from.address || (
                          <span className="inline-flex items-center gap-1">
                            <svg
                              width="16"
                              height="16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-muted-foreground"
                              style={{
                                display: "inline",
                                verticalAlign: "middle",
                              }}
                            >
                              <path d="M2 8h12M10 5l4 3-4 3" />
                            </svg>
                            {email.to}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
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
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
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
        <div
          className="flex-1 flex flex-col min-h-0 bg-card shadow-sm"
          style={{
            borderRadius: "0 12px 12px 0",
            marginLeft: 0,
            padding: "0 0 0 0",
            boxSizing: "border-box",
            minWidth: 0,
          }}
        >
          {selectedEmail ? (
            <>
              <div className="p-8 border-b border-border">
                <div className="flex items-start gap-4">
                  <Avatar>
                    <AvatarImage src={`/placeholder.svg?height=40&width=40`} />
                    <AvatarFallback>
                      {(selectedEmail.from.name ||
                        selectedEmail.from ||
                        selectedEmail.from.address)[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1 overflow-hidden">
                    <h2 className="text-xl font-semibold break-words">
                      {selectedEmail.subject}
                    </h2>
                    <div className="flex items-center text-sm text-muted-foreground flex-wrap gap-x-1">
                      <span className="font-medium break-all">
                        {selectedEmail.from.name || selectedEmail.from.address}
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
                      Darked HTML
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
                  <div className="max-w-3xl">
                    {viewMode === "text" ? (
                      <pre className="whitespace-pre-wrap text-sm">
                        {selectedEmail.text || "(no text content)"}
                      </pre>
                    ) : viewMode === "html" ? (
                      <article
                        className="prose prose-sm max-w-none
                                   dark:prose-invert
                                   text-foreground
                                   [&_*]:!text-current"
                        dangerouslySetInnerHTML={{ __html: selectedEmail.html }}
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
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              {emails.length === 0
                ? "No messages or loading..."
                : "Select an email to view"}
            </div>
          )}
        </div>
      </div>
      {/* Compose Button */}
      <button
        className="fixed bottom-8 right-8 z-50 bg-primary text-primary-foreground rounded-full shadow-lg p-4 hover:bg-primary/90 transition-all flex items-center gap-2"
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
        <span className="hidden sm:inline"></span>
      </button>
      {/* Compose Dialog */}
      <Dialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        className="fixed z-50 inset-0 flex items-center justify-center"
      >
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="relative bg-card rounded-xl shadow-xl w-full max-w-lg mx-auto p-6">
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
            {/* Optionally: HTML input and attachments */}
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
                className="px-4 py-2 rounded-md bg-secondary text-foreground border border-border"
                onClick={() => setComposeOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </Dialog>
    </main>
  );
}
