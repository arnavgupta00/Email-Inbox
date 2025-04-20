"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

// Mock data for emails
const mockEmails = [
  {
    id: "1",
    sender: "Twitter",
    email: "no-reply@twitter.com",
    subject: "Confirm your email address",
    content:
      "Please confirm your email address to complete your Twitter account setup. Click the link below to verify your email.",
    timestamp: new Date(2023, 3, 15, 10, 30),
    read: true,
  },
  {
    id: "2",
    sender: "GitHub",
    email: "noreply@github.com",
    subject: "Your GitHub access token",
    content:
      "You recently requested a new access token for your GitHub account. Here is your new token: gh_123456789abcdef. This token will expire in 30 days.",
    timestamp: new Date(2023, 3, 15, 9, 45),
    read: false,
  },
  {
    id: "3",
    sender: "Vercel",
    email: "team@vercel.com",
    subject: "Your deployment is live",
    content:
      "Your project has been successfully deployed to production. You can view it at https://your-project.vercel.app. If you have any issues, please let us know.",
    timestamp: new Date(2023, 3, 14, 18, 20),
    read: false,
  },
  {
    id: "4",
    sender: "Netflix",
    email: "info@netflix.com",
    subject: "New login to your account",
    content:
      "We noticed a new login to your Netflix account from a new device. If this was you, you can ignore this email. If not, please secure your account immediately.",
    timestamp: new Date(2023, 3, 14, 15, 10),
    read: true,
  },
  {
    id: "5",
    sender: "Amazon",
    email: "no-reply@amazon.com",
    subject: "Your Amazon order #123-4567890-1234567",
    content:
      "Thank you for your order. We'll send a confirmation when your item ships. Your estimated delivery date is Thursday, April 20. You can view the status of your order or make changes to it by visiting Your Orders on Amazon.com.",
    timestamp: new Date(2023, 3, 13, 12, 0),
    read: true,
  },
];

export default function InboxPage() {
  const [selectedEmail, setSelectedEmail] = useState(mockEmails[0]);
  const [emails] = useState(mockEmails);

  return (
    <main className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Email list sidebar */}
        <div className="w-full md:w-1/3 border-r border-border">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Inbox</h2>
            <p className="text-sm text-muted-foreground">alias@temp-mail.com</p>
          </div>
          <ScrollArea className="h-[calc(100vh-8rem)]">
            <div className="space-y-1 p-2">
              {emails.map((email) => (
                <div
                  key={email.id}
                  className={`p-3 rounded-md cursor-pointer transition-colors ${
                    selectedEmail.id === email.id
                      ? "bg-secondary"
                      : "hover:bg-secondary/50"
                  } ${!email.read ? "border-l-2 border-purple-500" : ""}`}
                  onClick={() => setSelectedEmail(email)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-medium">{email.sender}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(email.timestamp, {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                  <div className="text-sm font-medium truncate">
                    {email.subject}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {email.content.substring(0, 60)}...
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Email content */}
        <div className="flex-1 flex flex-col">
          {selectedEmail ? (
            <>
              <div className="p-6 border-b border-border">
                <div className="flex items-start gap-4">
                  <Avatar>
                    <AvatarImage src={`/placeholder.svg?height=40&width=40`} />
                    <AvatarFallback>{selectedEmail.sender[0]}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold">
                      {selectedEmail.subject}
                    </h2>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span className="font-medium">
                        {selectedEmail.sender}
                      </span>
                      <span className="mx-2">•</span>
                      <span>{selectedEmail.email}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedEmail.timestamp.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
              <ScrollArea className="flex-1 p-6">
                <div className="max-w-3xl space-y-4">
                  <div className="text-sm whitespace-pre-line">
                    {selectedEmail.content}
                  </div>
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select an email to view
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
