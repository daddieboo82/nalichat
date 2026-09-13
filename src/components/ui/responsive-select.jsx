"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  Select as BaseSelect,
  SelectGroup,
  SelectValue as BaseSelectValue,
  SelectTrigger as BaseSelectTrigger,
  SelectContent as BaseSelectContent,
  SelectLabel,
  SelectItem as BaseSelectItem,
  SelectSeparator,
} from "@/components/ui/select"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

/**
 * A drop-in replacement for the shadcn Select that renders a native-feeling
 * bottom-sheet (Drawer) on mobile screens and the standard popover on desktop.
 *
 * Usage is identical to the regular Select:
 *   <Select value={v} onValueChange={setV}>
 *     <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
 *     <SelectContent>
 *       <SelectItem value="a">A</SelectItem>
 *     </SelectContent>
 *   </Select>
 */

const ResponsiveSelectContext = React.createContext({
  isMobile: false,
  value: undefined,
  onValueChange: () => {},
  placeholder: undefined,
  open: false,
  setOpen: () => {},
})

function Select({ value, defaultValue, onValueChange, children, ...props }) {
  const isMobile = useIsMobile()
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)

  const currentValue = value !== undefined ? value : internalValue

  const handleChange = (v) => {
    if (value === undefined) setInternalValue(v)
    onValueChange?.(v)
  }

  if (!isMobile) {
    return (
      <BaseSelect value={value} defaultValue={defaultValue} onValueChange={onValueChange} {...props}>
        {children}
      </BaseSelect>
    )
  }

  return (
    <ResponsiveSelectContext.Provider
      value={{ isMobile, value: currentValue, onValueChange: handleChange, open, setOpen }}
    >
      {children}
    </ResponsiveSelectContext.Provider>
  )
}
/** @type {any} */
(({ className, children, placeholder, ...props }, ref) => {
  const ctx = React.useContext(ResponsiveSelectContext)

  if (!ctx.isMobile) {
    return <BaseSelectValue ref={ref} className={className} placeholder={placeholder} {...props}>{children}</BaseSelectValue>
  }

  return (
    <span ref={ref} className={cn("truncate", className)} {...props}>
      {ctx.value !== undefined ? String(ctx.value) : placeholder}
      {children}
    </span>
  )
})
SelectValue.displayName = "ResponsiveSelectValue"
/** @type {any} */
(({ className, children, ...props }, ref) => {
  const ctx = React.useContext(ResponsiveSelectContext)

  if (!ctx.isMobile) {
    return (
      <BaseSelectTrigger ref={ref} className={className} {...props}>
        {children}
      </BaseSelectTrigger>
    )
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => ctx.setOpen(true)}
      className={cn(
        "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm select-none [&>span]:line-clamp-1",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  )
})
SelectTrigger.displayName = "ResponsiveSelectTrigger"

function SelectContent({ children, className }) {
  const ctx = React.useContext(ResponsiveSelectContext)

  if (!ctx.isMobile) {
    return <BaseSelectContent className={className}>{children}</BaseSelectContent>
  }

  return (
    <Drawer open={ctx.open} onOpenChange={ctx.setOpen}>
      <DrawerContent className="max-h-[70vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-base">Select an option</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function SelectItem({ value, children, className }) {
  const ctx = React.useContext(ResponsiveSelectContext)

  if (!ctx.isMobile) {
    return (
      <BaseSelectItem value={value} className={className}>
        {children}
      </BaseSelectItem>
    )
  }

  const selected = ctx.value === value

  return (
    <button
      type="button"
      onClick={() => {
        ctx.onValueChange(value)
        ctx.setOpen(false)
      }}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-base select-none active:bg-accent/60",
        selected && "bg-accent/40 text-accent-foreground",
        className
      )}
    >
      <span>{children}</span>
      {selected && <Check className="h-4 w-4 text-primary" />}
    </button>
  )
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
}