import { registerOTel } from "@vercel/otel";

export async function register() {
  registerOTel({ serviceName: "chatbot" });
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.SCHEDULED_TASKS_ENABLED === "true"
  ) {
    const { startScheduler } = await import("./lib/scheduler/scheduler");
    startScheduler();
  }
}
