import {useEffect, useRef, useState, type ReactNode} from 'react';
import {cn} from '@/lib/utils';

/** Fade/slide a section into view on scroll, honoring reduced-motion. */
export function Reveal({children, className}: {children: ReactNode; className?: string}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      {rootMargin: '0px 0px -10% 0px', threshold: 0.1},
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn('transition-all duration-500 ease-out', shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0', className)}
    >
      {children}
    </div>
  );
}
