import { useState } from "react";
import { Home, Users, LogOut } from "lucide-react";
import { pb } from "@/lib/pocketbase";
import { useAuth } from "@/hooks/useAuth";
import { useHousehold } from "@/hooks/useHousehold";
import { useToast } from "@/components/ui/toast";
import { randomToken } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/common";

export function Onboarding() {
  const { user, signOut } = useAuth();
  const { refetchHouseholds, setActiveId } = useHousehold();
  const { toast } = useToast();
  const [householdName, setHouseholdName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy("create");
    try {
      const household = await pb.collection("households").create({
        name: householdName.trim(),
        created_by: user.id,
        ics_token: randomToken(),
      });
      await pb.collection("household_members").create({
        household_id: household.id,
        user_id: user.id,
        role: "owner",
      });
      setActiveId(household.id);
      await refetchHouseholds();
      toast({ title: "Haushalt erstellt 🎉", variant: "success" });
    } catch (err) {
      toast({
        title: "Konnte Haushalt nicht erstellen",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("join");
    try {
      const res = await pb.send<{ household_id: string }>("/api/plan/redeem-invite", {
        method: "POST",
        body: { code: code.trim() },
      });
      if (res?.household_id) setActiveId(res.household_id);
      await refetchHouseholds();
      toast({ title: "Willkommen im Haushalt! 👋", variant: "success" });
    } catch (err: any) {
      toast({
        title: "Beitritt fehlgeschlagen",
        description: err?.response?.message || err?.message || "Code prüfen.",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-secondary/60 to-background p-4">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-3xl bg-primary text-2xl shadow-soft">
          📋
        </div>
        <h1 className="text-2xl font-bold">Los geht's</h1>
        <p className="mt-1 text-muted-foreground">
          Erstelle einen Haushalt oder tritt einem bestehenden bei.
        </p>
      </div>

      <div className="grid w-full max-w-2xl gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Home className="h-5 w-5" />
            </div>
            <CardTitle>Neuen Haushalt erstellen</CardTitle>
            <CardDescription>Du wirst Eigentümer:in und kannst andere einladen.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="hname">Name des Haushalts</Label>
                <Input
                  id="hname"
                  required
                  placeholder="z. B. WG Sonnenallee"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy === "create"}>
                {busy === "create" && <Spinner className="text-primary-foreground" />}
                Haushalt erstellen
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Users className="h-5 w-5" />
            </div>
            <CardTitle>Einem Haushalt beitreten</CardTitle>
            <CardDescription>Gib den Einladungs-Code ein, den du erhalten hast.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={join} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">Einladungs-Code</Label>
                <Input
                  id="code"
                  required
                  placeholder="z. B. 7F3KQM"
                  className="uppercase tracking-widest"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
              <Button type="submit" variant="secondary" className="w-full" disabled={busy === "join"}>
                {busy === "join" && <Spinner />}
                Beitreten
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Button variant="ghost" size="sm" onClick={() => signOut()}>
        <LogOut className="h-4 w-4" /> Abmelden
      </Button>
    </div>
  );
}
