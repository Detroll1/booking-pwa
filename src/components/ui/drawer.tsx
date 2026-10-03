import * as React from 'react';
import {Drawer as DrawerPrimitive} from '@base-ui/react/drawer';
import {cn} from '@/lib/utils';

/**
 * shadcn/ui `base-nova` Drawer branch, built on Base UI's Drawer primitive
 * (@base-ui/react/drawer). We use this one branch everywhere for bottom sheets
 * and never mix in the older Vaul props. The bottom-sheet flow is sequential:
 * each step renders inside the same drawer with Back/Next controls.
 */

const Drawer = DrawerPrimitive.Root;
const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerClose = DrawerPrimitive.Close;
const DrawerPortal = DrawerPrimitive.Portal;

const DrawerBackdrop = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Backdrop>>(
  ({className, ...props}, ref) => (
    <DrawerPrimitive.Backdrop
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm',
        'transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
        className,
      )}
      {...props}
    />
  ),
);
DrawerBackdrop.displayName = 'DrawerBackdrop';

const DrawerViewport = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Viewport>>(
  ({className, ...props}, ref) => (
    <DrawerPrimitive.Viewport
      ref={ref}
      className={cn('fixed inset-0 z-50 flex items-end justify-center', className)}
      {...props}
    />
  ),
);
DrawerViewport.displayName = 'DrawerViewport';

const DrawerContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Popup>>(
  ({className, children, ...props}, ref) => (
    <DrawerPortal>
      <DrawerBackdrop />
      <DrawerViewport>
        <DrawerPrimitive.Popup
          ref={ref}
          className={cn(
            'flex max-h-dvh w-full max-w-2xl flex-col gap-3 overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 pb-safe text-primary shadow-lg outline-none',
            'transition-transform duration-200 ease-out data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full',
            className,
          )}
          {...props}
        >
          <div aria-hidden className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border" />
          {children}
        </DrawerPrimitive.Popup>
      </DrawerViewport>
    </DrawerPortal>
  ),
);
DrawerContent.displayName = 'DrawerContent';

function DrawerHeader({className, ...props}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1', className)} {...props} />;
}

const DrawerTitle = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>>(
  ({className, ...props}, ref) => (
    <DrawerPrimitive.Title ref={ref} className={cn('text-lg font-semibold text-primary', className)} {...props} />
  ),
);
DrawerTitle.displayName = 'DrawerTitle';

const DrawerDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({className, ...props}, ref) => (
  <DrawerPrimitive.Description ref={ref} className={cn('text-sm text-secondary', className)} {...props} />
));
DrawerDescription.displayName = 'DrawerDescription';

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerPortal,
  DrawerBackdrop,
  DrawerViewport,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
};
