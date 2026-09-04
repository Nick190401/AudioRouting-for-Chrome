import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";
import { Icon, type IconName } from "./Icon";
import { EXTENSION } from "../i18n";
import type { Content } from "../content/de";

const LABEL = "text-[8.5px] font-bold uppercase leading-[1.2] tracking-[.12em] text-node-label";

type Props = {
  readonly eyebrow: string;
  readonly t: Content["home"]["popup"];
};

/**
 * A faithful reproduction of the extension popup in its routing state.
 * Every value here is lifted from popup/popup.css — keep them in step.
 */
export function PopupPreview({ eyebrow, t }: Props) {
  return (
    <figure
      role="img"
      aria-label={t.aria}
      className="m-0 w-[388px] max-w-full justify-self-start overflow-hidden rounded-[18px] border border-line surface shadow-popup lg:justify-self-end"
    >
      <div className="flex min-h-20 items-center justify-between gap-4 border-b border-line px-4.5 pt-[17px] pb-3.5">
        <div className="flex items-center gap-[11px]">
          <BrandMark />
          <div>
            <p className="text-[8.5px] font-bold uppercase leading-[1.2] tracking-[.17em] text-ink-dim">
              {eyebrow}
            </p>
            <p className="mt-[3px] font-display text-[19px] font-semibold leading-none tracking-[-.03em]">
              {EXTENSION.name}
            </p>
          </div>
        </div>
        <span className="inline-flex min-h-7.5 items-center gap-[7px] whitespace-nowrap rounded-full border border-mint/28 bg-mint/8 px-2.5 text-[10.5px] font-semibold text-mint-bright">
          <Dot />
          {t.badge}
        </span>
      </div>

      <div className="px-4.5 pt-4.5 pb-[7px]">
        <div className="mx-px mb-2.5 flex items-center justify-between">
          <p className="text-[9.5px] font-bold uppercase tracking-[.1em] text-ink-soft">
            {t.signalPath}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#5e756c]">
            {t.thisTabOnly}
          </p>
        </div>

        <Node
          icon="tab"
          label={t.sourceLabel}
          title={t.sourceTitle}
          meta={t.sourceMeta}
          trailing={
            <span className="flex h-6 items-center gap-0.5 rounded-full border border-mint/18 bg-mint-wash px-1.5">
              <i className="h-[5px] w-0.5 rounded-full bg-mint" />
              <i className="h-[9px] w-0.5 rounded-full bg-mint" />
              <i className="h-[5px] w-0.5 rounded-full bg-mint" />
            </span>
          }
        />

        <div aria-hidden="true" className="relative ml-[35px] h-8.5">
          <span className="absolute top-0 left-[5px] h-8.5 w-px bg-signal" />
          <span className="absolute top-px left-[3px] h-[9px] w-[5px] animate-route-flow rounded-full bg-mint shadow-[0_0_10px_rgb(94_232_174/65%)]" />
          <span className="absolute top-[11px] left-[17px] text-[8px] font-bold uppercase tracking-[.1em] text-signal-ink">
            {t.audio}
          </span>
        </div>

        <Node
          out
          icon="speaker"
          label={t.targetLabel}
          title={t.targetTitle}
          meta={t.targetMeta}
          trailing={
            <span className="grid size-7.5 place-items-center rounded-[9px] border border-line bg-white/[0.02]">
              <Icon name="chevronRight" className="size-[17px] stroke-[#83968f] stroke-[1.7]" />
            </span>
          }
        />
      </div>

      <div className="px-4.5 pt-3.25 pb-3.75">
        <div className="grid min-h-12.5 grid-cols-[28px_minmax(0,1fr)_20px] items-center gap-2 rounded-xl border border-[#ff8d82]/25 surface-stop px-3.75 text-[12.5px] font-semibold text-[#e8f1ed] shadow-[inset_0_1px_0_rgb(255_255_255/5%)]">
          <span className="grid size-[21px] place-items-center">
            <Icon name="stop" className="size-[21px]" />
          </span>
          <span>{t.stop}</span>
          <span />
        </div>
        <p className="mt-2.5 text-center text-[10px] leading-[1.35] text-ink-soft">{t.note}</p>
      </div>

      <div className="flex min-h-11.25 items-center justify-center gap-3 border-t border-line bg-black/10 px-4.5 py-2.75 text-[9px] font-semibold text-[#6d8179]">
        <span className="inline-flex items-center gap-[5px]">
          <Icon name="shieldSmall" className="size-3.5 stroke-[#4da984] stroke-[1.4]" />
          {t.local}
        </span>
        <span className="h-3.25 w-px bg-line-strong" />
        <span className="inline-flex items-center gap-[5px]">
          <Icon name="refresh" className="size-3.5 stroke-[#4da984] stroke-[1.4]" />
          {t.fullscreen}
        </span>
      </div>
    </figure>
  );
}

function Node({
  icon,
  label,
  title,
  meta,
  trailing,
  out = false,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly title: string;
  readonly meta: string;
  readonly trailing: ReactNode;
  readonly out?: boolean;
}) {
  return (
    <div
      className={`relative grid min-h-20 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-[13px] border px-3.5 py-3.25 ${
        out ? "border-mint-edge surface-mint" : "border-line surface"
      }`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-0.5 ${
          out ? "bg-mint shadow-[0_0_13px_rgb(94_232_174/45%)]" : "bg-node-rail opacity-70"
        }`}
      />
      <span
        className={`grid size-11 place-items-center rounded-[11px] border ${
          out
            ? "border-mint/18 bg-mint-wash text-mint"
            : "border-line-strong bg-white/[0.03] text-node-icon"
        }`}
      >
        <Icon name={icon} className="size-[23px]" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={LABEL}>{label}</span>
        <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold leading-[1.35] tracking-[-.01em]">
          {title}
        </strong>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[10.5px] leading-[1.35] text-ink-soft">
          {meta}
        </span>
      </span>
      {trailing}
    </div>
  );
}

export function Dot() {
  return (
    <span
      aria-hidden="true"
      className="size-1.5 shrink-0 rounded-full bg-mint shadow-[0_0_0_4px_rgb(94_232_174/10%),0_0_10px_rgb(94_232_174/45%)]"
    />
  );
}
