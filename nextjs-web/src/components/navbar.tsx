import Link from "next/link";
import { Mail } from "lucide-react";

export function Navbar() {
  return (
    <header className="">
      <div className=" justify-between flex h-16 items-center px-8">
        <Link href="/" className="flex items-center space-x-2">
          <Mail className="h-6 w-6 text-purple-500" />
          {/* <span className="text-xl font-bold tracking-wider">
            TEMP<span className="text-purple-500">MAIL</span>
          </span> */}
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Made By Arnav Gupta
          </Link>
        </nav>
      </div>
    </header>
  );
}
