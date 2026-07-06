import { useState } from "react";
import { Mail, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { BrandMark } from "@/components/BrandMark";
import { Spinner } from "@/components/common";

type Mode = "signin" | "signup";

export function Login() {
  const { signInWithPassword, signUp } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithPassword(email, password);
      } else {
        await signUp(email, password, displayName || email.split("@")[0]);
      }
    } catch (err) {
      toast({
        title: "Das hat nicht geklappt",
        description: err instanceof Error ? err.message : "Bitte E-Mail und Passwort prüfen.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-secondary/60 to-background p-4">
      <div className="mb-8 flex flex-col items-center text-center">
        <BrandMark className="mb-3 h-16 w-16 rounded-3xl text-3xl shadow-soft" />
        <h1 className="text-3xl font-bold tracking-tight">Plan</h1>
        <p className="mt-1 text-muted-foreground">Euer Haushalt – gemeinsam organisiert.</p>
      </div>

      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="z. B. Marcel"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  className="pl-10"
                  placeholder="du@beispiel.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Passwort</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  className="pl-10"
                  placeholder="mindestens 8 Zeichen"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy && <Spinner className="text-primary-foreground" />}
              {mode === "signin" ? "Anmelden" : "Konto erstellen"}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm">
            {mode === "signin" ? (
              <p className="text-muted-foreground">
                Noch kein Konto?{" "}
                <button
                  className="font-medium text-primary hover:underline"
                  onClick={() => setMode("signup")}
                >
                  Registrieren
                </button>
              </p>
            ) : (
              <p className="text-muted-foreground">
                Schon ein Konto?{" "}
                <button
                  className="font-medium text-primary hover:underline"
                  onClick={() => setMode("signin")}
                >
                  Anmelden
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
