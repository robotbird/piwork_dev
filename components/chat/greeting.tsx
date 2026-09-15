import { motion } from "framer-motion";
import { BrandMark } from "./brand-mark";

export const Greeting = () => (
  <div
    className="flex -translate-y-[100px] flex-col items-center px-4"
    key="overview"
  >
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      initial={{ opacity: 0, scale: 0.92, y: 10 }}
      transition={{ delay: 0.15, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <BrandMark className="size-16 shadow-[0_14px_28px_-18px_rgba(44,119,255,.55)]" />
    </motion.div>
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 text-center text-[28px] font-semibold leading-[1.2] tracking-[-0.04em] text-[#182234] md:text-[36px] dark:text-foreground"
      initial={{ opacity: 0, y: 10 }}
      transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      今天要完成什么？
    </motion.div>
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mt-2.5 max-w-[680px] text-center text-[14px] leading-6 text-[#8390a5] md:text-[16px] dark:text-[#b4b4b4]"
      initial={{ opacity: 0, y: 10 }}
      transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      piwork 会在企业权限范围内调用
      Skill、工具、数据与知识，帮助你完成任务并交付成果。
    </motion.div>
  </div>
);
