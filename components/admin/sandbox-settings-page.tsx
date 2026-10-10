"use client";

import { useTranslations } from "next-intl";
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { SandboxSettingsView } from "@/lib/admin/sandbox-settings";
import {
  DEFAULT_SANDBOX_RESOURCE,
  LIGHT_SANDBOX_RESOURCE,
  sandboxResourceSchema,
} from "@/lib/runtime/sandbox/resource-policy";

export function SandboxSettingsPage({
  initialData,
}: {
  initialData: SandboxSettingsView;
}) {
  const t = useTranslations("admin.sandboxSettings");
  const [cpu, setCpu] = useState(String(initialData.resource.cpuCores));
  const [memory, setMemory] = useState(String(initialData.resource.memoryMB));
  const [saved, setSaved] = useState(initialData.resource);
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState(false);
  const dirty =
    Number(cpu) !== saved.cpuCores || Number(memory) !== saved.memoryMB;

  const preset = useCallback((resource: typeof saved) => {
    setCpu(String(resource.cpuCores));
    setMemory(String(resource.memoryMB));
    setInvalid(false);
    setError(false);
  }, []);
  const changeCpu = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setCpu(event.target.value);
    setInvalid(false);
  }, []);
  const changeMemory = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setMemory(event.target.value);
    setInvalid(false);
  }, []);
  const lightPreset = useCallback(
    () => preset(LIGHT_SANDBOX_RESOURCE),
    [preset]
  );
  const defaultPreset = useCallback(
    () => preset(DEFAULT_SANDBOX_RESOURCE),
    [preset]
  );

  const save = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (busy) {
        return;
      }
      const result = sandboxResourceSchema.safeParse({
        cpuCores: Number(cpu),
        memoryMB: Number(memory),
      });
      setInvalid(!result.success);
      if (!result.success) {
        return;
      }
      setBusy(true);
      setError(false);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/admin/sandbox-settings`,
          {
            body: JSON.stringify(result.data),
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          }
        );
        if (!response.ok) {
          throw new Error("save failed");
        }
        const data = await response.json();
        const resource = sandboxResourceSchema.parse(data.resource);
        setSaved(resource);
        preset(resource);
        toast.success(t("saved"));
      } catch {
        setError(true);
        toast.error(t("saveFailed"));
      } finally {
        setBusy(false);
      }
    },
    [busy, cpu, memory, preset, t]
  );

  return (
    <section className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-14">
      <div className="mx-auto flex max-w-[960px] flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-heading-lg">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>{t("deployment")}</CardTitle>
            <CardDescription>{t("deploymentNote")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">
              {initialData.provider ?? t("disabled")}
            </Badge>
            <span className="text-sm">
              {t("routing")}: {initialData.routing}
            </span>
            <span className="text-sm text-muted-foreground">
              {t("proxy")}:{" "}
              {t(
                initialData.inferenceConfigured ? "configured" : "notConfigured"
              )}
            </span>
          </CardContent>
        </Card>
        <form onSubmit={save}>
          <Card>
            <CardHeader>
              <CardTitle>{t("limits")}</CardTitle>
              <CardDescription>{t("limitsNote")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-disabled={busy} data-invalid={invalid}>
                  <FieldLabel htmlFor="sandbox-cpu">{t("cpu")}</FieldLabel>
                  <Input
                    aria-describedby="sandbox-cpu-hint"
                    aria-invalid={invalid}
                    disabled={busy}
                    id="sandbox-cpu"
                    max={32}
                    min={0.25}
                    onChange={changeCpu}
                    required
                    step={0.25}
                    type="number"
                    value={cpu}
                  />
                  <FieldDescription id="sandbox-cpu-hint">
                    {t("cpuHint")}
                  </FieldDescription>
                </Field>
                <Field data-disabled={busy} data-invalid={invalid}>
                  <FieldLabel htmlFor="sandbox-memory">
                    {t("memory")}
                  </FieldLabel>
                  <Input
                    aria-describedby="sandbox-memory-hint"
                    aria-invalid={invalid}
                    disabled={busy}
                    id="sandbox-memory"
                    max={32_768}
                    min={512}
                    onChange={changeMemory}
                    required
                    step={128}
                    type="number"
                    value={memory}
                  />
                  <FieldDescription id="sandbox-memory-hint">
                    {t("memoryHint")}
                  </FieldDescription>
                </Field>
                {invalid ? <FieldError>{t("invalid")}</FieldError> : null}
                {error ? <FieldError>{t("saveFailed")}</FieldError> : null}
                <FieldDescription>{t("safetyNote")}</FieldDescription>
              </FieldGroup>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-3">
              <Button disabled={busy || !dirty} type="submit">
                {t(busy ? "saving" : "save")}
              </Button>
              <Button
                disabled={busy}
                onClick={lightPreset}
                type="button"
                variant="outline"
              >
                {t("lightPreset")}
              </Button>
              <Button
                disabled={busy}
                onClick={defaultPreset}
                type="button"
                variant="ghost"
              >
                {t("defaultPreset")}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </section>
  );
}
