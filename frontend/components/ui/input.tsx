import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
};

const sharedStyles =
  "w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/30";

export function Input({ label, hint, className = "", ...props }: InputProps) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium text-slate-200">{label}</span>
      <input className={`${sharedStyles} ${className}`.trim()} {...props} />
      {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Textarea({ label, hint, className = "", ...props }: TextareaProps) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium text-slate-200">{label}</span>
      <textarea className={`${sharedStyles} min-h-28 resize-y ${className}`.trim()} {...props} />
      {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
