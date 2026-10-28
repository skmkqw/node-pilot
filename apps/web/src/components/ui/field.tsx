"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

type FieldProps = {
	icon: React.ReactNode;
	label: string;
	hint?: React.ReactNode;
	trailing?: React.ReactNode;
	children: React.ReactNode;
};

/** Labelled input shell with a leading icon that lights up on focus. */
export function Field({ icon, label, hint, trailing, children }: FieldProps) {
	return (
		<label className="block">
			<span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
			<span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] pl-4 pr-1.5 text-slate-500 transition focus-within:border-cyan-300/50 focus-within:bg-white/[0.06] focus-within:text-cyan-300 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.12)]">
				{icon}
				{children}
				{trailing}
			</span>
			{hint ? <span className="mt-1.5 block text-xs text-slate-500">{hint}</span> : null}
		</label>
	);
}

export const inputClassName =
	"h-12 w-full bg-transparent pr-3 text-sm text-white outline-none placeholder:text-slate-500";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
	icon: React.ReactNode;
	label: string;
	hint?: React.ReactNode;
};

/** Password field with a show/hide toggle. */
export function PasswordField({ icon, label, hint, className, ...props }: PasswordInputProps) {
	const [visible, setVisible] = useState(false);

	return (
		<Field
			icon={icon}
			label={label}
			hint={hint}
			trailing={
				<button
					type="button"
					onClick={() => setVisible((value) => !value)}
					className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:text-white"
					aria-label={visible ? "Hide password" : "Show password"}
				>
					{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
				</button>
			}
		>
			<input type={visible ? "text" : "password"} className={cn(inputClassName, className)} {...props} />
		</Field>
	);
}
