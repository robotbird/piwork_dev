import type { SVGProps } from "react";

/** piwork gear mark (π monogram in a gear), from public/piwork-logo.svg. */
export function PiLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <clipPath id="piwork-logo-gear">
          <path d="M 256.00,14.00 L 287.59,16.07 L 310.61,52.19 L 336.75,61.06 L 377.00,46.42 L 403.32,64.01 L 405.20,106.80 L 423.40,127.55 L 465.58,135.00 L 479.58,163.39 L 459.81,201.39 L 465.19,228.46 L 498.00,256.00 L 495.93,287.59 L 459.81,310.61 L 450.94,336.75 L 465.58,377.00 L 447.99,403.32 L 405.20,405.20 L 384.45,423.40 L 377.00,465.58 L 348.61,479.58 L 310.61,459.81 L 283.54,465.19 L 256.00,498.00 L 224.41,495.93 L 201.39,459.81 L 175.25,450.94 L 135.00,465.58 L 108.68,447.99 L 106.80,405.20 L 88.60,384.45 L 46.42,377.00 L 32.42,348.61 L 52.19,310.61 L 46.81,283.54 L 14.00,256.00 L 16.07,224.41 L 52.19,201.39 L 61.06,175.25 L 46.42,135.00 L 64.01,108.68 L 106.80,106.80 L 127.55,88.60 L 135.00,46.42 L 163.39,32.42 L 201.39,52.19 L 228.46,46.81 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#piwork-logo-gear)">
        <rect fill="#FF7066" height="512" width="512" x="0" y="0" />
        <path d="M 0 80 L 256 256 L 256 512 L 0 512 Z" fill="#0877F5" />
        <path d="M 512 80 L 256 256 L 256 512 L 512 512 Z" fill="#F8BB39" />
        <circle cx="256" cy="256" fill="white" r="163" />
      </g>
      <g strokeLinejoin="round">
        <path
          d="M 151 189 H 361 V 236 H 319 V 343 Q 319 355 331 362 L 354 375 H 307 Q 279 375 279 345 V 236 H 232 V 344 Q 232 357 218 368 L 201 381 H 154 L 179 357 Q 187 349 187 335 V 236 H 151 Z"
          fill="#FF7066"
        />
        <path
          d="M 187 236 H 232 V 344 Q 232 357 218 368 L 201 381 H 154 L 179 357 Q 187 349 187 335 Z"
          fill="#0877F5"
        />
        <path
          d="M 279 258 H 319 V 343 Q 319 355 331 362 L 354 375 H 307 Q 279 375 279 345 Z"
          fill="#F8BB39"
        />
      </g>
    </svg>
  );
}
