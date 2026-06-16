"use client";

import { useState } from "react";

export function AppearanceBadge({ count, labels }: { count: string; labels: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-block"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex cursor-help rounded-md border border-[#dfded6] bg-white px-2 py-1 font-medium outline-none hover:border-[#28666e] focus:border-[#28666e] focus:ring-2 focus:ring-[#28666e]/20"
        aria-label={`${count}: ${labels.join(", ")}`}
        onClick={() => setOpen(true)}
      >
        {count}
      </button>
      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute left-0 top-full z-50 mt-2 w-56 rounded-lg border border-[#d8d6cc] bg-white p-2 text-xs font-normal text-[#4d554c] shadow-lg",
          open ? "block" : "hidden",
        ].join(" ")}
      >
        <span className="mb-1 block font-semibold text-[#181917]">Date esami</span>
        <span className="grid gap-1">
          {labels.map((label) => (
            <span key={label} className="rounded-md bg-[#fbfbf8] px-2 py-1">
              {label}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
