// biome-ignore-all lint/performance/noJsxPropsBind: React Compiler memoizes this view; model rows bind their own policy actions.
"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  type RoleModelPolicy,
  roleModelPolicySchema,
} from "@/lib/admin/role-model-policy";
import {
  type RoleTokenPolicy,
  roleTokenPolicySchema,
} from "@/lib/admin/role-token-policy";
import type { AdminRole } from "@/lib/admin/roles";
import type { ActiveModelCatalog } from "@/lib/ai/active-models";

type Payload = {
  role: AdminRole;
  catalog: ActiveModelCatalog;
  usage: { daily: number; monthly: number; missing: number };
};
export function RolePoliciesPanel({
  role,
  tab,
  onSaved,
}: {
  role: AdminRole;
  tab: "models" | "quota";
  onSaved: (role: AdminRole) => void;
}) {
  const { t } = usePreferences();
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [modelPolicy, setModelPolicy] = useState<RoleModelPolicy>({
    allowSwitch: true,
    defaultModelId: null,
    enabledModelIds: [],
  });
  const [limits, setLimits] = useState({ daily: "", monthly: "", perRun: "" });
  const [action, setAction] = useState<RoleTokenPolicy["action"]>("block");
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setFailed(false);
    fetch(`/api/admin/roles/${role.id}/policies?refresh=${reload}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Load failed");
        }
        const payload = (await response.json()) as Payload;
        if (controller.signal.aborted) {
          return;
        }
        setData(payload);
        setModelPolicy(
          payload.role.modelPolicy ?? {
            allowSwitch: true,
            defaultModelId:
              payload.catalog.defaultModelId ??
              payload.catalog.models[0]?.id ??
              null,
            enabledModelIds: payload.catalog.models.map((model) => model.id),
          }
        );
        const quota = payload.role.tokenPolicy;
        setLimits({
          daily: quota?.daily?.toString() ?? "",
          monthly: quota?.monthly?.toString() ?? "",
          perRun: quota?.perRun?.toString() ?? "",
        });
        setAction(quota?.action ?? "block");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true);
        }
      });
    return () => controller.abort();
  }, [role.id, reload]);
  async function save(reset = false) {
    if (saving) {
      return;
    }
    const policy =
      tab === "models"
        ? modelPolicy
        : {
            action,
            daily: limits.daily.trim() ? Number(limits.daily) : null,
            monthly: limits.monthly.trim() ? Number(limits.monthly) : null,
            perRun: limits.perRun.trim() ? Number(limits.perRun) : null,
          };
    const parsed =
      tab === "models"
        ? roleModelPolicySchema.safeParse(policy)
        : roleTokenPolicySchema.safeParse(policy);
    if (!reset && !parsed.success) {
      toast.error(t("roleWorkspace.invalidPolicy"));
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/roles/${role.id}/policies`, {
        body: JSON.stringify({
          [tab === "models" ? "modelPolicy" : "tokenPolicy"]: reset
            ? null
            : parsed.data,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!response.ok) {
        throw new Error("Save failed");
      }
      const updated = (await response.json()) as AdminRole;
      onSaved(updated);
      setReload((value) => value + 1);
      toast.success(t("roleWorkspace.saved"));
    } catch {
      toast.error(t("roleWorkspace.saveFailed"));
    } finally {
      setSaving(false);
    }
  }
  if (failed) {
    return (
      <div
        className="mt-5 p-6 text-center text-sm text-muted-foreground"
        role="alert"
      >
        {t("roleWorkspace.loadFailed")}
        <Button
          className="ml-3"
          onClick={() => setReload((value) => value + 1)}
          variant="outline"
        >
          {t("common.retry")}
        </Button>
      </div>
    );
  }
  if (!data) {
    return (
      <p
        className="p-10 text-center text-sm text-muted-foreground"
        role="status"
      >
        {t("roleWorkspace.loading")}
      </p>
    );
  }
  const unavailable = modelPolicy.enabledModelIds.filter(
    (id) => !data.catalog.models.some((model) => model.id === id)
  );
  return (
    <section
      aria-label={t(`roleWorkspace.${tab}`)}
      className="mt-5 rounded-xl border border-border p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-medium">{t(`roleWorkspace.${tab}`)}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(`roleWorkspace.${tab}Hint`)}
          </p>
        </div>
        {tab === "models" ? (
          <div className="flex items-center gap-3">
            <label
              className="text-sm font-medium"
              htmlFor={`role-switch-${role.id}`}
            >
              {t("roleWorkspace.allowSwitch")}
            </label>
            <Switch
              checked={modelPolicy.allowSwitch}
              disabled={saving}
              id={`role-switch-${role.id}`}
              onCheckedChange={(allowSwitch) =>
                setModelPolicy((current) => ({ ...current, allowSwitch }))
              }
            />
          </div>
        ) : null}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {t(
          (tab === "models" ? data.role.modelPolicy : data.role.tokenPolicy)
            ? "roleWorkspace.configured"
            : "roleWorkspace.inherited"
        )}
      </p>
      {tab === "models" ? (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("roleWorkspace.enabledCount", {
              count: modelPolicy.enabledModelIds.filter(
                (id) => !unavailable.includes(id)
              ).length,
            })}
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  {[
                    "modelName",
                    "provider",
                    "enabled",
                    "defaultModel",
                    "notes",
                  ].map((key) => (
                    <th className="px-4 py-3 font-medium" key={key} scope="col">
                      {t(`roleWorkspace.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.catalog.models.map((model) => (
                  <tr className="border-t border-border/70" key={model.id}>
                    <td className="px-4 py-4 font-medium">{model.name}</td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {model.providerName ?? model.providerKey}
                    </td>
                    <td className="px-4 py-4">
                      <Switch
                        aria-label={t("roleWorkspace.enableModel", {
                          name: model.name,
                        })}
                        checked={modelPolicy.enabledModelIds.includes(model.id)}
                        disabled={saving}
                        onCheckedChange={(enabled) =>
                          setModelPolicy((current) => {
                            const enabledModelIds = enabled
                              ? [...current.enabledModelIds, model.id]
                              : current.enabledModelIds.filter(
                                  (id) => id !== model.id
                                );
                            const defaultModelId =
                              current.defaultModelId &&
                              enabledModelIds.includes(current.defaultModelId)
                                ? current.defaultModelId
                                : (enabledModelIds.find((id) =>
                                    data.catalog.models.some(
                                      (entry) => entry.id === id
                                    )
                                  ) ?? null);
                            return {
                              ...current,
                              defaultModelId,
                              enabledModelIds,
                            };
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-4">
                      <input
                        aria-label={t("roleWorkspace.setDefault", {
                          name: model.name,
                        })}
                        checked={modelPolicy.defaultModelId === model.id}
                        className="size-4 accent-primary"
                        disabled={
                          saving ||
                          !modelPolicy.enabledModelIds.includes(model.id)
                        }
                        name={`role-default-${role.id}`}
                        onChange={() =>
                          setModelPolicy((current) => ({
                            ...current,
                            defaultModelId: model.id,
                          }))
                        }
                        type="radio"
                      />
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {model.description || "—"}
                    </td>
                  </tr>
                ))}
                {data.catalog.models.length === 0 ? (
                  <tr>
                    <td
                      className="p-10 text-center text-muted-foreground"
                      colSpan={5}
                    >
                      {t("roleWorkspace.noModels")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {unavailable.length ? (
            <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
              {t("roleWorkspace.unavailable", { count: unavailable.length })}
              <Button
                disabled={saving}
                onClick={() =>
                  setModelPolicy((current) => ({
                    ...current,
                    defaultModelId:
                      current.defaultModelId &&
                      !unavailable.includes(current.defaultModelId)
                        ? current.defaultModelId
                        : (data.catalog.models.find((model) =>
                            current.enabledModelIds.includes(model.id)
                          )?.id ?? null),
                    enabledModelIds: current.enabledModelIds.filter(
                      (id) => !unavailable.includes(id)
                    ),
                  }))
                }
                size="sm"
                variant="outline"
              >
                {t("roleWorkspace.removeUnavailable")}
              </Button>
            </div>
          ) : null}
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {t("roleWorkspace.modelRules")}
          </p>
        </>
      ) : (
        <>
          <fieldset
            className="mt-4 overflow-hidden rounded-lg border border-border"
            disabled={saving}
          >
            <legend className="sr-only">
              {t("roleWorkspace.quotaConfig")}
            </legend>
            <h4 className="bg-muted/40 px-4 py-3 font-medium">
              {t("roleWorkspace.quotaConfig")}
            </h4>
            <div className="grid gap-4 p-4">
              {(["monthly", "daily", "perRun"] as const).map((key) => (
                <div
                  className="grid items-center gap-2 sm:grid-cols-[200px_1fr]"
                  key={key}
                >
                  <label
                    className="text-sm"
                    htmlFor={`quota-${key}-${role.id}`}
                  >
                    {t(`roleWorkspace.${key}`)}
                  </label>
                  <div className="relative">
                    <Input
                      className="pr-20"
                      id={`quota-${key}-${role.id}`}
                      max="1000000000000"
                      min="1"
                      onChange={(event) =>
                        setLimits((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      placeholder={t("roleWorkspace.unlimited")}
                      step="1"
                      type="number"
                      value={limits[key]}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                      Tokens
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            <h4 className="bg-muted/40 px-4 py-3 font-medium">
              {t("roleWorkspace.excessPolicy")}
            </h4>
            <div className="grid items-center gap-2 p-4 sm:grid-cols-[200px_1fr]">
              <label className="text-sm" htmlFor={`quota-action-${role.id}`}>
                {t("roleWorkspace.excessAction")}
              </label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={saving}
                id={`quota-action-${role.id}`}
                onChange={(event) =>
                  setAction(event.target.value as RoleTokenPolicy["action"])
                }
                value={action}
              >
                <option value="block">{t("roleWorkspace.block")}</option>
                <option value="warn">{t("roleWorkspace.warn")}</option>
              </select>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
            <h4 className="font-medium text-foreground">
              {t("roleWorkspace.usageNotes")}
            </h4>
            <p className="mt-2">
              {t("roleWorkspace.usageRecorded", {
                daily: data.usage.daily.toLocaleString(),
                missing: data.usage.missing,
                monthly: data.usage.monthly.toLocaleString(),
              })}
            </p>
            <p className="mt-2 leading-6">{t("roleWorkspace.quotaRules")}</p>
          </div>
        </>
      )}
      <div className="mt-5 flex justify-end gap-3">
        <Button disabled={saving} onClick={() => save(true)} variant="outline">
          {t("roleWorkspace.reset")}
        </Button>
        <Button disabled={saving} onClick={() => save()}>
          {t(saving ? "roleWorkspace.saving" : "roleWorkspace.save")}
        </Button>
      </div>
    </section>
  );
}
