"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface ActionMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const ActionMenuContext = React.createContext<ActionMenuContextValue | null>(null)

function useActionMenu() {
  return React.useContext(ActionMenuContext)
}

function ActionMenu({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  ...props
}: React.ComponentProps<typeof Popover>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen)
      }
      controlledOnOpenChange?.(nextOpen)
    },
    [isControlled, controlledOnOpenChange],
  )

  return (
    <ActionMenuContext.Provider value={{ open, setOpen }}>
      <Popover open={open} onOpenChange={setOpen} {...props} />
    </ActionMenuContext.Provider>
  )
}

function ActionMenuTrigger({
  ...props
}: React.ComponentProps<typeof PopoverTrigger>) {
  return <PopoverTrigger {...props} />
}

function ActionMenuContent({
  className,
  align = "end",
  side = "bottom",
  sideOffset = 6,
  collisionPadding = 12,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      align={align}
      side={side}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        "w-48 gap-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-1.5 text-zinc-900 shadow-lg ring-0 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className,
      )}
      {...props}
    />
  )
}

function ActionMenuItem({
  className,
  onClick,
  closeOnClick = true,
  ...props
}: React.ComponentProps<"button"> & { closeOnClick?: boolean }) {
  const menu = useActionMenu()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    if (closeOnClick && !e.defaultPrevented) {
      menu?.setOpen(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:ring-zinc-300",
        className,
      )}
      {...props}
    />
  )
}

function ActionMenuNote({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-xl px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400", className)}
      {...props}
    />
  )
}

function ActionMenuSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("my-1 h-px bg-zinc-200 dark:bg-zinc-800", className)} {...props} />
}

export {
  ActionMenu,
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuNote,
  ActionMenuSeparator,
  ActionMenuTrigger,
  useActionMenu,
}
