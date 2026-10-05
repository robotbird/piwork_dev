import { z } from "zod";
import { requireAdminSession } from "@/lib/admin/access";
import { roleModelPolicySchema } from "@/lib/admin/role-model-policy";
import { roleTokenPolicySchema } from "@/lib/admin/role-token-policy";
import { getActiveModelCatalog } from "@/lib/ai/active-models";
import {
  getRoleTokenUsage,
  updateRolePolicy,
} from "@/lib/db/role-policy-queries";
import { getRoleById, getRoleView } from "@/lib/db/role-queries";

const inputSchema = z
  .object({
    modelPolicy: roleModelPolicySchema.nullable().optional(),
    tokenPolicy: roleTokenPolicySchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
const idSchema = z.string().uuid();
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  if (!(await requireAdminSession())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid role ID" }, { status: 400 });
  }
  try {
    const role = await getRoleById(id);
    if (!role) {
      return Response.json({ error: "Role not found" }, { status: 404 });
    }
    const [catalog, usage] = await Promise.all([
      getActiveModelCatalog(),
      getRoleTokenUsage(id),
    ]);
    return Response.json(
      { catalog, role: await getRoleView(id), usage },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { error: "Unable to load role policies" },
      { status: 500 }
    );
  }
}
export async function PUT(request: Request, context: Context) {
  if (!(await requireAdminSession())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid role ID" }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid policy" }, { status: 400 });
  }
  try {
    const role = await getRoleById(id);
    if (!role) {
      return Response.json({ error: "Role not found" }, { status: 404 });
    }
    const policy = parsed.data.modelPolicy;
    if (policy) {
      const catalog = await getActiveModelCatalog();
      const ids = new Set(catalog.models.map((model) => model.id));
      // Previously granted but currently unavailable IDs may be removed, never newly granted.
      if (
        policy.enabledModelIds.some(
          (modelId) =>
            !ids.has(modelId) &&
            !role.modelPolicy?.enabledModelIds.includes(modelId)
        )
      ) {
        return Response.json(
          { error: "Model is not available" },
          { status: 400 }
        );
      }
      if (policy.defaultModelId && !ids.has(policy.defaultModelId)) {
        return Response.json(
          { error: "Default model is not available" },
          { status: 400 }
        );
      }
    }
    await updateRolePolicy(id, parsed.data);
    return Response.json(await getRoleView(id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Unable to save role policies" },
      { status: 500 }
    );
  }
}
