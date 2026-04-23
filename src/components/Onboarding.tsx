import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../hooks/useT';

const LS_KEY = 'gymlog-onboarded';

export default function Onboarding() {
  const { t } = useT();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(LS_KEY) !== '1') setOpen(true);
    } catch {}
  }, []);

  function finish() {
    try { localStorage.setItem(LS_KEY, '1'); } catch {}
    setOpen(false);
  }

  if (!mounted || !open) return null;

  const slides = [
    { title: t('onb.step1Title'), body: t('onb.step1Body'), emoji: '🏋️' },
    { title: t('onb.step2Title'), body: t('onb.step2Body'), emoji: '🏆' },
    { title: t('onb.step3Title'), body: t('onb.step3Body'), emoji: '☁️' },
  ];
  const last = step === slides.length - 1;
  const s = slides[step];

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <button
          type="button"
          onClick={finish}
          className="absolute right-3 top-3 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-elevated hover:text-fg"
        >
          {t('onb.skip')}
        </button>
        <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-12 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-accent/15 text-4xl">
            {s.emoji}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{s.title}</h2>
          <p className="text-sm leading-relaxed text-muted">{s.body}</p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border bg-elevated/30 px-5 py-4">
          <div className="flex gap-1.5">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition ${i === step ? 'w-6 bg-accent' : 'w-1.5 bg-border'}`}
                aria-hidden="true"
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => (last ? finish() : setStep(step + 1))}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink transition hover:brightness-110"
          >
            {last ? t('onb.start') : t('onb.next')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
