import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      alt="piwork"
      className={cn("rounded-[22%] object-cover", className)}
      height={96}
      priority
      src="/piwork-mark.png"
      width={96}
    />
  );
}
