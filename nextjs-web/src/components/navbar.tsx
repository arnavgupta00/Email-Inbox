import Link from "next/link";
import { Mail } from "lucide-react";

export function Navbar() {
  return (
    <header className="border-b border-purple-900/20 bg-gradient-to-r from-transparent via-purple-950/10 to-transparent backdrop-blur-sm">
      <div className="justify-between flex h-16 items-center px-8">
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
            <Mail className="h-5 w-5 text-purple-400 group-hover:text-purple-300 transition-colors" />
          </div>
          <span className="text-2xl font-bold tracking-widest bg-gradient-to-r from-purple-200 to-purple-100 bg-clip-text text-transparent group-hover:from-purple-100 group-hover:to-purple-50 transition-all">
            ALIAS<span className="text-purple-400">R</span>
          </span>
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
