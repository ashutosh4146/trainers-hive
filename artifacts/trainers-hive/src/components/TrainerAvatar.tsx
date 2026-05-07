import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const PALETTE = [
  { bg: "bg-rose-100",    text: "text-rose-700"    },
  { bg: "bg-orange-100",  text: "text-orange-700"  },
  { bg: "bg-amber-100",   text: "text-amber-700"   },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-teal-100",    text: "text-teal-700"    },
  { bg: "bg-cyan-100",    text: "text-cyan-700"    },
  { bg: "bg-blue-100",    text: "text-blue-700"    },
  { bg: "bg-indigo-100",  text: "text-indigo-700"  },
  { bg: "bg-violet-100",  text: "text-violet-700"  },
  { bg: "bg-pink-100",    text: "text-pink-700"    },
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

interface TrainerAvatarProps {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export function TrainerAvatar({ name, avatarUrl, className, fallbackClassName }: TrainerAvatarProps) {
  const color = PALETTE[hashName(name) % PALETTE.length];
  const initials = getInitials(name);

  return (
    <Avatar className={className}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
      <AvatarFallback className={cn("font-semibold", color.bg, color.text, fallbackClassName)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
