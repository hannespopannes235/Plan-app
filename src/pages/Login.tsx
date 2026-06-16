import { useState } from "react";
import { Mail, Lock, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/common";

type Mode = "signin" | "signup" | "magic";

export function Login() {
  const { signInWithPassword, signUp, signInWithMagicLink } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithPassword(email, password);
      } else if (mode === "signup") {
        const { needsConfirm } = await signUp(email, password, displayName || email.split("@")[0]);
        if (needsConfirm) {
          setSent(true);
          toast({
            title: "Fast geschafft!",
            description: "Bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach.",
            variant: "success",
          });
        }
      } else {
        await signInWithMagicLink(email);
        setSent(true);
        toast({
          title: "Magic-Link gesendet",
          description: "Schau in dein Postfach und klick auf den Link zum Anmelden.",
          variant: "success",
        });
      }
    } catch (err) {
      toast({
        title: "Das hat nicht geklappt",
        description: err instanceof Error ? err.message : "Unbekannter Fehler",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-secondary/60 to-background p-4">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-3xl shadow-soft">
          📋
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Plan</h1>
        <p className="mt-1 text-muted-foreground">Euer Haushalt – gemeinsam organisiert.</p>
      </div>

      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          {sent ? (
            <div className="space-y-3 text-center">
              <div className="text-4xl">📨</div>
              <p className="font-semibold">Prüfe dein Postfach</p>
              <p className="text-sm text-muted-foreground">
                Wir haben dir eine E-Mail an <span className="font-medium">{email}</span> geschickt.
              </p>
              <Button variant="ghost" onClick={() => setSent(false)}>
                Zurück
              </Button>
            </div>
          ) : (
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

              {mode !== "magic" && (
                <div className="space-y-1.5">
                  <Label htmlFor="password">Passwort</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      className="pl-10"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    />
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy && <Spinner className="text-primary-foreground" />}
                {mode === "signin" && "Anmelden"}
                {mode === "signup" && "Konto erstellen"}
                {mode === "magic" && (
                  <>
                    <Sparkles className="h-4 w-4" /> Magic-Link senden
                  </>
                )}
              </Button>
            </form>
          )}

          {!sent && (
            <div className="mt-5 space-y-2 text-center text-sm">
              {mode === "signin" && (
                <>
                  <button className="text-muted-foreground hover:text-foreground" onClick={() => setMode("magic")}>
                    Lieber per Magic-Link anmelden
                  </button>
                  <p className="text-muted-foreground">
                    Noch kein Konto?{" "}
                    <button className="font-medium text-primary hover:underline" onClick={() => setMode("signup")}>
                      Registrieren
                    </button>
                  </p>
                </>
              )}
              {mode === "signup" && (
                <p className="text-muted-foreground">
                  Schon ein Konto?{" "}
                  <button className="font-medium text-primary hover:underline" onClick={() => setMode("signin")}>
                    Anmelden
                  </button>
                </p>
              )}
              {mode === "magic" && (
                <button className="text-muted-foreground hover:text-foreground" onClick={() => setMode("signin")}>
                  Mit Passwort anmelden
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
