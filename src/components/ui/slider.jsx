import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

// The Root/Track/Range only had horizontal sizing (h-1.5 w-full track), so a
// vertical fader — used throughout the Studio mixer — had no visible groove or
// fill: Radix laid the Root out as a flex ROW by default, collapsing the
// vertical Track to a near-invisible sliver and leaving what looked like a
// bare circle floating with no guide line. data-[orientation=…] variants give
// each part correct flex direction and sizing in both orientations, while
// still letting a consumer's className (merged last via cn) override size.
const Slider = React.forwardRef(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex touch-none select-none items-center",
      "data-[orientation=horizontal]:w-full",
      "data-[orientation=vertical]:flex-col data-[orientation=vertical]:justify-center",
      className
    )}
    {...props}>
    <SliderPrimitive.Track
      className={cn(
        "relative grow overflow-hidden rounded-full bg-primary/20",
        "data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full",
        "data-[orientation=vertical]:w-1.5 data-[orientation=vertical]:h-full"
      )}>
      <SliderPrimitive.Range
        className={cn(
          "absolute bg-primary",
          "data-[orientation=horizontal]:h-full",
          "data-[orientation=vertical]:w-full data-[orientation=vertical]:bottom-0"
        )} />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block h-4 w-4 shrink-0 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
