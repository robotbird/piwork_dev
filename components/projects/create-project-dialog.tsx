// biome-ignore-all lint/performance/noJsxPropsBind: small dialog form
"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectSummary } from "./shared";
import { request } from "./shared";

export function CreateProjectDialog({
  onCreated,
  onOpenChange,
  open,
}: {
  onCreated: (project: ProjectSummary) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const { project } = await request<{ project: ProjectSummary }>(
        "/api/projects",
        {
          body: JSON.stringify({ name: trimmed }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      );
      toast.success(t("created", { name: project.name }));
      onOpenChange(false);
      setName("");
      onCreated(project);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("createFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          setName("");
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createDescription")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="grid gap-2 py-2">
            <Label htmlFor="project-name">{t("nameLabel")}</Label>
            <Input
              autoFocus
              id="project-name"
              maxLength={128}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("namePlaceholder")}
              value={name}
            />
          </div>
          <DialogFooter className="mt-2">
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              {tc("cancel")}
            </Button>
            <Button disabled={!name.trim() || submitting} type="submit">
              {t("createAction")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
