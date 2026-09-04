type Props = {
  readonly size?: "md" | "sm";
};

const BAR = "w-[2.5px] rounded-full bg-mint shadow-[0_0_9px_rgb(94_232_174/30%)]";

// Bar heights are class names rather than style props: the pages ship a
// style-src 'self' CSP, which blocks inline style attributes.
const BARS = {
  md: ["h-2 opacity-55", "h-[17px]", "h-[25px]", "h-3.5", "h-[7px] opacity-55"],
  sm: ["h-[7px] opacity-55", "h-[15px]", "h-[22px]", "h-3"],
} as const;

/** The waveform lockup from the extension popup. */
export function BrandMark({ size = "md" }: Props) {
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center gap-[2.5px] border border-mint/25 surface-mark shadow-mark ${
        size === "md" ? "size-10 rounded-xl" : "size-9 rounded-[11px]"
      }`}
    >
      {BARS[size].map((bar) => (
        <span key={bar} className={`${BAR} ${bar}`} />
      ))}
    </div>
  );
}
