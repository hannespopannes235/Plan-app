import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useHousehold } from "@/hooks/useHousehold";
import { cn } from "@/lib/utils";

export function HouseholdSwitcher() {
  const { households, activeHousehold, activeId, setActiveId, members } = useHousehold();
  const navigate = useNavigate();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-lg">🏠</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">
            {activeHousehold?.name ?? "Haushalt"}
          </p>
          <p className="text-xs text-muted-foreground">
            {members.length} {members.length === 1 ? "Mitglied" : "Mitglieder"}
          </p>
        </div>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-[15rem] rounded-xl border border-border bg-popover p-1.5 shadow-soft animate-fade-in"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Haushalt wechseln
          </DropdownMenu.Label>
          {households.map((h) => (
            <DropdownMenu.Item
              key={h.id}
              onSelect={() => setActiveId(h.id)}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm outline-none focus:bg-secondary"
            >
              <span className="truncate">{h.name}</span>
              {h.id === activeId && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            onSelect={() => navigate("/einstellungen")}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none focus:bg-secondary",
            )}
          >
            <Plus className="h-4 w-4" /> Verwalten & Einladen
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
