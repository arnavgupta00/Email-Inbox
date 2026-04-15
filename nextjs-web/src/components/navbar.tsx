import Link from "next/link";
import { Mail } from "lucide-react";

export function Navbar() {
  return (
    <header className="border-b border-purple-900/20 bg-gradient-to-r from-transparent via-purple-950/10 to-transparent backdrop-blur-sm">
      <div className="justify-between flex h-16 items-center px-8">
        <Link href="/" className="group">
          <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
            <Mail className="h-6 w-6 text-purple-400 group-hover:text-purple-300 transition-colors" />
          </div>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link
            href="/"
            className="text-xs font-medium text-purple-300/60 transition-colors hover:text-purple-300 uppercase tracking-widest"
          >
            Made By Arnav Gupta
          </Link>
        </nav>
      </div>
    </header>
  );
}
