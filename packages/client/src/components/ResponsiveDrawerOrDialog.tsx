import * as React from "react"

import { useMediaQuery } from "@/hooks/useMediaQuery"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

interface ResponsiveDrawerOrDialogProps {
  /** Should be an icon from @radix-ui/react-icons */
  iconTrigger: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
  descriptionHidden?: boolean
}

export default function ResponsiveDrawerOrDialog({ iconTrigger, title, description, children, descriptionHidden }: ResponsiveDrawerOrDialogProps) {
  const [open, setOpen] = React.useState(false)

  // https://ui.shadcn.com/docs/components/drawer#responsive-dialog
  const isDesktop = useMediaQuery("(min-width: 768px)")

  // Create a simple button that can properly receive refs
  const TriggerButton = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
    (props, ref) => (
      <button
        ref={ref}
        className="cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 size-9"
        {...props}
      >
        {iconTrigger}
      </button>
    )
  )
  
  TriggerButton.displayName = "TriggerButton"

  // Create a close button that can properly receive refs
  const CloseButton = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
    (props, ref) => (
      <button
        ref={ref}
        className="border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive h-9 px-4 py-2 has-[>svg]:px-3"
        {...props}
      >
        Done
      </button>
    )
  )
  
  CloseButton.displayName = "CloseButton"

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <TriggerButton />
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] font-mono bg-background text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl">{title}</DialogTitle>
            <DialogDescription className={descriptionHidden ? "sr-only" : ""}>
              {description}
            </DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <TriggerButton />
      </DrawerTrigger>
      <DrawerContent className="font-mono bg-background text-foreground">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-xl">{title}</DrawerTitle>
          <DrawerDescription className={descriptionHidden ? "sr-only" : ""}>
            {description}
          </DrawerDescription>
        </DrawerHeader>
        <div className="p-4">
          {children}
        </div>
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <CloseButton />
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
