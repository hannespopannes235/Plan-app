import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, LogOut, UserPlus, Plus, Trash2 } from "lucide-react";
import { pb } from "@/lib/pocketbase";
import { useAuth } from "@/hooks/useAuth";
import { useHousehold } from "@/hooks/useHousehold";
import { useToast } from "@/components/ui/toast";
import { MEMBER_COLORS, AVATAR_EMOJIS } from "@/lib/constants";
import { randomInviteCode, cn } from "@/lib/utils";
import type { Invite, Profile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MemberAvatar } from "@/components/MemberAvatar";

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const { activeHousehold, activeId, members, profiles, myRole, refetchHouseholds } = useHousehold();
  const { toast } = useToast();
  const qc = useQueryClient();

  const myProfile = user ? profiles[user.id] : null;
  const [name, setName] = useState("");
  const [color, setColor] = useState(MEMBER_COLORS[0]);
  const [emoji, setEmoji] = useState(AVATAR_EMOJIS[0]);
  const [initialized, setInitialized] = useState(false);

  // Profilwerte einmalig übernehmen, sobald geladen
  useEffect(() => {
    if (myProfile && !initialized) {
      setName(myProfile.display_name);
      setColor(myProfile.color);
      setEmoji(myProfile.avatar_emoji);
      setInitialized(true);
    }
  }, [myProfile, initialized]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      await pb.collection("users").update(user!.id, {
        display_name: name.trim(),
        color,
        avatar_emoji: emoji,
      });
      // AuthStore aktualisieren, damit Begrüßung/Avatar sofort stimmen
      await pb.collection("users").authRefresh();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", activeId] });
      toast({ title: "Profil gespeichert", variant: "success" });
    },
    onError: (e) => toast({ title: "Fehler", description: String(e), variant: "error" }),
  });

  const invitesQuery = useQuery({
    queryKey: ["invites", activeId],
    enabled: !!activeId,
    queryFn: async (): Promise<Invite[]> =>
      pb.collection("invites").getFullList<Invite>({
        filter: pb.filter("household_id = {:h}", { h: activeId }),
        sort: "-created",
      }),
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      await pb.collection("invites").create({
        household_id: activeId,
        code: randomInviteCode(),
        created_by: user!.id,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites", activeId] }),
    onError: (e) => toast({ title: "Fehler", description: String(e), variant: "error" }),
  });

  const deleteInvite = useMutation({
    mutationFn: async (id: string) => {
      await pb.collection("invites").delete(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites", activeId] }),
  });

  const leaveHousehold = useMutation({
    mutationFn: async () => {
      const membership = await pb
        .collection("household_members")
        .getFirstListItem(pb.filter("household_id = {:h} && user_id = {:u}", { h: activeId, u: user!.id }));
      await pb.collection("household_members").delete(membership.id);
    },
    onSuccess: () => {
      refetchHouseholds();
      toast({ title: "Haushalt verlassen", variant: "success" });
    },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Einstellungen</h1>

      {/* Profil */}
      <Card>
        <CardHeader>
          <CardTitle>Mein Profil</CardTitle>
          <CardDescription>Name, Farbe und Avatar – so erkennen dich die anderen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <MemberAvatar profile={{ display_name: name, color, avatar_emoji: emoji }} size="lg" />
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="p-name">Anzeigename</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Farbe</Label>
            <div className="flex flex-wrap gap-2">
              {MEMBER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full transition-transform",
                    color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "hover:scale-110",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Farbe ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Avatar</Label>
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors",
                    emoji === e ? "bg-primary/20 ring-2 ring-primary" : "bg-secondary hover:bg-secondary/70",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={() => saveProfile.mutate()} disabled={!name.trim()}>
            Profil speichern
          </Button>
        </CardContent>
      </Card>

      {/* Mitglieder */}
      <Card>
        <CardHeader>
          <CardTitle>Mitglieder ({members.length})</CardTitle>
          <CardDescription>{activeHousehold?.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {members.map((m) => {
              const p: Profile | undefined = profiles[m.user_id];
              return (
                <li key={m.user_id} className="flex items-center gap-3">
                  <MemberAvatar profile={p} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {p?.display_name ?? "Mitglied"}
                      {m.user_id === user?.id && (
                        <span className="ml-1 text-xs text-muted-foreground">(du)</span>
                      )}
                    </p>
                    <p className="text-xs capitalize text-muted-foreground">{m.role}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Einladungen */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Einladen
          </CardTitle>
          <CardDescription>
            Teile einen Code – wer ihn beim Onboarding eingibt, tritt diesem Haushalt bei.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="secondary" onClick={() => createInvite.mutate()}>
            <Plus className="h-4 w-4" /> Neuen Einladungs-Code erstellen
          </Button>
          <ul className="space-y-2">
            {(invitesQuery.data ?? []).map((inv) => (
              <InviteRow key={inv.id} invite={inv} onDelete={() => deleteInvite.mutate(inv.id)} />
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Konto / Aktionen */}
      <Card>
        <CardHeader>
          <CardTitle>Konto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" /> Abmelden
            </Button>
            {myRole !== "owner" && (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => {
                  if (confirm("Diesen Haushalt wirklich verlassen?")) leaveHousehold.mutate();
                }}
              >
                <Trash2 className="h-4 w-4" /> Haushalt verlassen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InviteRow({ invite, onDelete }: { invite: Invite; onDelete: () => void }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const expired = new Date(invite.expires_at) < new Date();

  const copy = async () => {
    await navigator.clipboard.writeText(invite.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Code kopiert", variant: "success" });
  };

  return (
    <li className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
      <code className={cn("flex-1 font-mono text-lg font-bold tracking-widest", expired && "line-through opacity-50")}>
        {invite.code}
      </code>
      <span className="text-xs text-muted-foreground">
        {expired ? "abgelaufen" : `gültig bis ${new Date(invite.expires_at).toLocaleDateString("de-DE")}`}
      </span>
      <Button variant="ghost" size="icon" onClick={copy} aria-label="Code kopieren">
        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Code löschen">
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
    </li>
  );
}
