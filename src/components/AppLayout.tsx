import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  CheckSquare,
  UtensilsCrossed,
  Wallet,
  CalendarDays,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HouseholdSwitcher } from "@/components/HouseholdSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { to: "/", label: "Übersicht", icon: LayoutDashboard, end: true },
  { to: "/einkauf", label: "Einkauf", icon: ShoppingCart },
  { to: "/aufgaben", label: "Aufgaben", icon: CheckSquare },
  { to: "/essensplan", label: "Essen", icon: UtensilsCrossed },
  { to: "/budget", label: "Budget", icon: Wallet },
  { to: "/kalender", label: "Kalender", icon: CalendarDays },
];

export function AppLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      {/* Desktop-Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card/60 px-3 py-5 backdrop-blur lg:flex">
        <div className="flex items-center gap-2 px-3 pb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-lg">📋</div>
          <span className="text-xl font-bold tracking-tight">Plan</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <NavLink
          to="/einstellungen"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )
          }
        >
          <Settings className="h-5 w-5" />
          Einstellungen
        </NavLink>
      </aside>

      {/* Hauptbereich */}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
          <HouseholdSwitcher />
          <ThemeToggle />
        </header>

        <main className="container max-w-3xl px-4 pb-28 pt-5 lg:pb-10 animate-fade-in" key={location.pathname}>
          <Outlet />
        </main>
      </div>

      {/* Mobile-Bottom-Nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-border bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
