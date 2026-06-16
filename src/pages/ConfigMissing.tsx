import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ConfigMissing() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-lg">
        <CardHeader>
          <div className="mb-2 text-4xl">🛠️</div>
          <CardTitle>Fast geschafft – Supabase verbinden</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Es fehlen die Umgebungsvariablen für Supabase. Lege eine Datei{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 font-mono">.env</code> im
            Projektordner an (Vorlage:{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 font-mono">.env.example</code>):
          </p>
          <pre className="overflow-x-auto rounded-xl bg-secondary p-4 text-xs text-foreground">
{`VITE_SUPABASE_URL=https://dein-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=dein-anon-key`}
          </pre>
          <p>
            Danach den Dev-Server neu starten (<code className="font-mono">npm run dev</code>). Die
            Einrichtung ist Schritt für Schritt in der{" "}
            <span className="font-medium text-foreground">README</span> beschrieben.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
