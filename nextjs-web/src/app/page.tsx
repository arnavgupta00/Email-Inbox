import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/navbar";

export default async function Home() {
  return (
    <main
      /* 135 deg = top‑left → bottom‑right  */
      className="
        min-h-screen flex flex-col
        bg-[linear-gradient(135deg,#05090d_0%,#05090d_25%,#0f0b1a_60%,#332137_100%)]
      "
    >
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
                />
                <span className="flex items-center text-muted-foreground">
                  @dejavu.social
                </span>
              </div>
            </div>

            <Button
              className="w-full bg-purple-700 hover:bg-purple-600 text-white"
              asChild
            >
              <Link href="/inbox">Generate &amp; View Inbox</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
