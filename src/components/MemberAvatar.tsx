import { cn } from "@/lib/utils";
import { contrastText } from "@/lib/utils";
import type { Profile } from "@/types/database";

interface MemberAvatarProps {
  profile?: Pick<Profile, "display_name" | "color" | "avatar_emoji"> | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  showRing?: boolean;
}

const sizeMap = {
  sm: "h-7 w-7 text-sm",
  md: "h-9 w-9 text-base",
  lg: "h-12 w-12 text-xl",
};

/** Runder Avatar mit Mitgliedsfarbe + Emoji – „wem gehört was" auf einen Blick. */
export function MemberAvatar({ profile, size = "md", className, showRing }: MemberAvatarProps) {
  const color = profile?.color ?? "#94a3b8";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium leading-none",
        showRing && "ring-2 ring-background",
        sizeMap[size],
        className,
      )}
      style={{ backgroundColor: color, color: contrastText(color) }}
      title={profile?.display_name ?? "Unbekannt"}
      aria-label={profile?.display_name ?? "Unbekannt"}
    >
      {profile?.avatar_emoji ?? "👤"}
    </span>
  );
}
