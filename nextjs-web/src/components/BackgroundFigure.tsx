// components/BackgroundFigure.tsx
import Image from "next/image";

export default function BackgroundFigure() {
  return (
    <Image
      src="https://pub-c604c8e8374e4827ad2569364be2d13a.r2.dev/figure.png"
      alt=""
      /* fill makes it behave like position:absolute;inset:0 */
      fill
      priority
      className="
        object-contain   /* keep aspect ratio */
        opacity-20       /* subtle */
        z-0 
        pointer-events-none select-none
        max-w-full    /* optional size clamp */
        max-h-full
        mx-auto left-2/2 -translate-x-1/3 
        -scale-x-100  
      "
    />
  );
}
