import { motion } from "motion/react";

export const Greeting = () => (
  <div
    className="flex -translate-y-[164px] flex-col items-center px-4"
    key="overview"
  >
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="text-center text-[28px] font-normal leading-9 tracking-[-0.025em] text-foreground"
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      我们该做什么？
    </motion.div>
  </div>
);
