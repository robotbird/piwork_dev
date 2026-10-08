// BotID（Vercel Kasada 挑战）默认关闭：仅 Vercel 部署且 NEXT_PUBLIC_BOTID_ENABLED=1
// 时启用。挑战脚本依赖 WebCrypto（crypto.subtle），在非安全上下文
// （如 http://IP:port 自托管访问）下会抛
// "Cannot read properties of undefined (reading 'importKey')"，
// 导致所有受保护请求（/api/chat）在浏览器端直接失败。
// 自托管（非 Vercel）部署服务端也无法完成真实检测，开启只有坏处。
if (process.env.NEXT_PUBLIC_BOTID_ENABLED === "1") {
  void import("botid/client/core").then(({ initBotId }) => {
    initBotId({
      protect: [
        {
          method: "POST",
          path: "/api/chat",
        },
      ],
    });
  });
}
