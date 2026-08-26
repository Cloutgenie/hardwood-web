import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">
            H
          </span>
          <span className="font-heading text-lg tracking-wide uppercase">
            Hardwood <span className="text-primary">Sim</span>
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <a href="https://thedyme.net" className="hover:text-foreground">
            The Dyme
          </a>
          <Link href="/build?league=nba" className="hover:text-foreground">
            NBA
          </Link>
          <Link href="/build?league=college" className="hover:text-foreground">
            College
          </Link>
        </nav>
      </div>
    </header>
  );
}
