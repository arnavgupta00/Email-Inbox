"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/navbar";
import BackgroundFigure from "@/components/BackgroundFigure";

export default function Home() {
  const [alias, setAlias] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleGenerate = () => {
    setError("");
    const trimmed = alias.trim();
    if (!trimmed) {
      setError("Please enter an alias or email.");
      return;
    }
    if (trimmed.includes("@")) {
      if (trimmed.endsWith("@dejavu.social")) {
        router.push(`/${trimmed}`);
      } else {
        setError("Only @dejavu.social emails are allowed.");
      }
    } else {
      router.push(`/${trimmed}@dejavu.social`);
    }
  };

  return (
    <main
      /* 135 deg = top‑left → bottom‑right  */
      className="
      relative           /* anchor for the absolute Image */
      min-h-screen flex flex-col
      bg-[linear-gradient(135deg,#05090d_0%,#05090d_25%,#0f0b1a_60%,#332137_100%)]
    "
    >
      <BackgroundFigure />
      <Navbar />

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center flex flex-col items-center justify-center">
            <h1
              className="
                text-8xl font-bold tracking-wider outline-text mb-2
                bg-clip-text text-transparent
              "
            >
              DISPOSABLE
            </h1>
            <p className="text-sm text-purple-300 uppercase tracking-widest">
              Generate temporary email addresses
            </p>
          </div>

          <div className="mt-12 space-y-6">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Enter your preferred alias
              </p>
              <div className="flex space-x-2">
                <Input
                  type="text"
                  placeholder="alias"
                  className="bg-background border-purple-700/50 focus:border-purple-500"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleGenerate();
                  }}
                />
                <span className="flex items-center text-muted-foreground">
                  @dejavu.social
                </span>
              </div>
              {error && (
                <div className="text-xs text-red-400 pt-1">{error}</div>
              )}
            </div>

            <Button
              className="w-full bg-purple-700 hover:bg-purple-600 text-white"
              onClick={handleGenerate}
            >
              Generate &amp; View Inbox
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
