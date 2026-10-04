"use client";

import { useFormStatus } from "react-dom";

import { LoaderIcon } from "@/components/chat/icons";

import { cn } from "@/lib/utils";

import { Button } from "../ui/button";

export function SubmitButton({
  children,
  isSuccessful,
  className,
}: {
  children: React.ReactNode;
  isSuccessful: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-disabled={pending || isSuccessful}
      className={cn("relative", className)}
      disabled={pending || isSuccessful}
      type={pending ? "button" : "submit"}
      variant="pill"
    >
      {children}

      {pending || isSuccessful ? (
        <span className="absolute right-4 animate-spin">
          <LoaderIcon />
        </span>
      ) : null}

      <output aria-live="polite" className="sr-only">
        {pending || isSuccessful ? "Loading" : "Submit form"}
      </output>
    </Button>
  );
}
