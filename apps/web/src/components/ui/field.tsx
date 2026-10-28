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

/** Labelled input shell; on focus it lifts with a hard shadow and the icon plate turns saffron. */
export function Field({ icon, label, hint, trailing, children }: FieldProps) {
	return (
		<label className="group block">
			<span className="label mb-1.5 block text-ink">{label}</span>
			<span className="flex items-stretch border-2 border-ink bg-surface text-ink transition-shadow focus-within:shadow-[4px_4px_0_var(--ink)]">
				<span className="grid w-11 shrink-0 place-items-center border-r-2 border-ink bg-ground transition-colors group-focus-within:bg-accent">{icon}</span>
				{children}
				{trailing}
			</span>
			{hint ? <span className="mt-1.5 block font-mono text-xs text-muted">{hint}</span> : null}
		</label>
	);
}

export const inputClassName =
	"h-12 min-w-0 flex-1 bg-transparent px-3 font-mono text-sm text-ink outline-none placeholder:text-muted/70";

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
					className="grid w-11 shrink-0 place-items-center border-l-2 border-ink text-ink transition hover:bg-accent"
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
