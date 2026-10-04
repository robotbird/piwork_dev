"use client";

import { Box, LayoutGrid, Shield, Wrench } from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import { PiLogo } from "./pi-logo";

export function RuntimeIllustration() {
  const { t } = usePreferences();
  const capabilities = [
    {
      Icon: LayoutGrid,
      label: t("appSidebar.skills"),
      position: "left-1/2 top-[3%] -translate-x-1/2",
    },
    {
      Icon: Box,
      label: t("auth.models"),
      position: "left-[9%] top-1/2 -translate-y-1/2",
    },
    {
      Icon: Wrench,
      label: t("auth.tools"),
      position: "right-[9%] top-1/2 -translate-y-1/2",
    },
    {
      Icon: Shield,
      label: t("auth.sandbox"),
      position: "bottom-[3%] left-1/2 -translate-x-1/2",
    },
  ];

  return (
    <section
      aria-label={t("auth.platformDescription")}
      className="relative hidden min-h-dvh flex-1 overflow-hidden border-l border-[#e1e7f0] bg-[#f7fbff] lg:flex lg:flex-col lg:items-center lg:justify-center"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-36 -top-52 size-[480px] rounded-full bg-[radial-gradient(circle_at_30%_70%,#edf4ff,transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-44 -left-48 size-[420px] rounded-full bg-[radial-gradient(circle_at_70%_30%,#edf4ff,transparent_70%)]"
      />
      <div className="relative z-10 flex translate-y-4 w-full max-w-[960px] flex-col items-center px-8 py-16 text-center xl:px-12">
        <h2 className="text-[clamp(44px,4vw,68px)] font-semibold leading-none tracking-[-0.055em] text-[#070f26]">
          piwork
        </h2>
        <p className="mt-5 text-[clamp(17px,1.55vw,25px)] text-[#7d89a5]">
          {t("auth.platformDescription")}
        </p>
        <div className="relative mt-8 aspect-[2.05] w-full max-w-[790px]">
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-full overflow-visible"
            fill="none"
            viewBox="0 0 790 427"
          >
            <ellipse cx="395" cy="266" rx="385" ry="173" stroke="#e9f1ff" />
            <ellipse
              cx="395"
              cy="243"
              fill="#eff5ff"
              fillOpacity=".5"
              rx="280"
              ry="145"
              stroke="#e9f1ff"
            />
            <ellipse
              cx="395"
              cy="210"
              rx="252"
              ry="145"
              stroke="#b6d2ff"
              strokeDasharray="6 6"
            />
            <ellipse
              cx="395"
              cy="210"
              rx="172"
              ry="96"
              stroke="#b6d2ff"
              strokeDasharray="5 6"
            />
            <path
              d="M143 210h80m344 0h80M395 65v49m0 192v49"
              stroke="#d6e5ff"
              strokeDasharray="5 6"
            />
            <circle cx="223" cy="210" fill="#accbff" r="5" />
            <circle cx="567" cy="210" fill="#accbff" r="5" />
          </svg>
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 h-[42%] w-[32%] -translate-x-1/2 -translate-y-1/2"
          >
            <svg
              className="absolute inset-0 size-full overflow-visible"
              fill="none"
              viewBox="0 0 240 170"
            >
              <defs>
                <filter
                  height="220%"
                  id="pi-platform-shadow"
                  width="200%"
                  x="-50%"
                  y="-50%"
                >
                  <feGaussianBlur stdDeviation="10" />
                </filter>
                <linearGradient
                  gradientUnits="userSpaceOnUse"
                  id="pi-platform-face"
                  x1="120"
                  x2="120"
                  y1="0"
                  y2="145"
                >
                  <stop stopColor="white" />
                  <stop offset="1" stopColor="#f0f7ff" />
                </linearGradient>
              </defs>
              <ellipse
                cx="120"
                cy="146"
                fill="#b6d0ff"
                filter="url(#pi-platform-shadow)"
                rx="87"
                ry="16"
              />
              <path
                d="M14 86 98 35q22-14 44 0l84 51v20q0 9-12 17l-72 42q-22 13-44 0l-72-42q-12-8-12-17Z"
                fill="#d3e3ff"
              />
              <path
                d="m14 76 84-51q22-14 44 0l84 51v18q0 9-12 17l-72 42q-22 13-44 0l-72-42q-12-8-12-17Z"
                fill="#e4eeff"
              />
              <path
                d="m25 60 73-43q22-14 44 0l73 43q23 14 0 28l-73 43q-22 14-44 0L25 88q-23-14 0-28Z"
                fill="url(#pi-platform-face)"
                stroke="white"
                strokeWidth="2"
              />
            </svg>
            <PiLogo className="absolute left-1/2 top-[22%] h-[46%] w-[38%] -translate-x-1/2" />
          </div>
          {capabilities.map(({ Icon, label, position }) => (
            <div
              className={`absolute ${position} flex size-[clamp(74px,6.2vw,104px)] flex-col items-center justify-center gap-2 rounded-[20px] border border-[#e0eaff] bg-white/95 shadow-[0_14px_28px_-12px_#bfd3fa]`}
              key={label}
            >
              <Icon
                aria-hidden="true"
                className="size-8 text-[#176bff]"
                strokeWidth={1.7}
              />
              <span className="text-sm font-medium text-[#425273]">
                {label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-12 text-[clamp(17px,1.3vw,21px)] font-medium text-[#27395e]">
          {t("auth.platformHeadline")}
        </p>
        <p className="mt-3 text-[clamp(14px,1.15vw,18px)] text-[#8491ad]">
          {t("auth.platformTagline")}
        </p>
      </div>
    </section>
  );
}
