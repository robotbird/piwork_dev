import { PiLogo } from "@/components/auth/pi-logo";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return <PiLogo className={cn("size-7", className)} />;
}
