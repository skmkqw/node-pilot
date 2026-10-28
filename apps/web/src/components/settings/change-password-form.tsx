"use client";

import { KeyRound, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toaster";
import { authApi } from "@/lib/api/endpoints";
import { PasswordStrength } from "./password-strength";

export function ChangePasswordForm() {
	const toast = useToast();
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [confirm, setConfirm] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	const mismatch = confirm.length > 0 && confirm !== next;
	const canSubmit = current.length > 0 && next.length >= 8 && next === confirm;

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		setIsSaving(true);

		try {
			await authApi.changePassword(current, next);
			setCurrent("");
			setNext("");
			setConfirm("");
			toast({ tone: "success", title: "Password changed", description: "Use the new password next time you sign in." });
		} catch (error) {
			toast({ tone: "error", title: "Password not changed", description: (error as Error).message });
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<form onSubmit={submit} className="space-y-4">
			<PasswordField
				icon={<LockKeyhole className="size-4" />}
				label="Current password"
				value={current}
				onChange={(event) => setCurrent(event.target.value)}
				autoComplete="current-password"
				required
			/>
			<div>
				<PasswordField
					icon={<KeyRound className="size-4" />}
					label="New password"
					value={next}
					onChange={(event) => setNext(event.target.value)}
					autoComplete="new-password"
					required
				/>
				<PasswordStrength password={next} />
			</div>
			<PasswordField
				icon={<KeyRound className="size-4" />}
				label="Repeat new password"
				hint={mismatch ? <span className="text-rose-300">The passwords do not match.</span> : undefined}
				value={confirm}
				onChange={(event) => setConfirm(event.target.value)}
				autoComplete="new-password"
				required
			/>
			<Button type="submit" variant="primary" isLoading={isSaving} disabled={!canSubmit}>
				Change password
			</Button>
		</form>
	);
}
