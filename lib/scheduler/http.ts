import { ZodError } from "zod";
export function taskApiError(error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return Response.json(
      { error: "输入无效，请检查任务名称、内容、计划和时区" },
      { status: 400 }
    );
  }
  console.error("[scheduled-tasks]", error);
  return Response.json({ error: "操作失败，请稍后重试" }, { status: 500 });
}
