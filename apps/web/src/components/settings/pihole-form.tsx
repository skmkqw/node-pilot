"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleCheck, Globe, KeyRound, PlugZap, TriangleAlert, Unplug } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, PasswordField, inputClassName } from "@/components/ui/field";
import { useToast } from "@/components/ui/toaster";
import { settingsApi } from "@/lib/api/endpoints";
import type { AdBlockerStatus, PiHoleConnectionInfo } from "@/lib/api/types";
import { formatCompact } from "@/lib/format";

type PiHoleFormProps = {
	info: PiHoleConnectionInfo | null;
	onSaved?: (info: PiHoleConnectionInfo) => void;
	onDisconnected?: () => void;
	/** Extra buttons next to Save, e.g. "Skip" in the setup wizard. */
	secondaryAction?: React.ReactNode;
};

/**
 * Connects NodePilot to a Pi-hole v6 instance. "Test" checks the values without saving;
 * the stored password is never sent back to the browser, so an empty field keeps it.
 */
export function PiHoleForm({ info, onSaved, onDisconnected, secondaryAction }: PiHoleFormProps) {
	const toast = useToast();
	const [baseUrl, setBaseUrl] = useState(info?.baseUrl ?? "");
	const [password, setPassword] = useState("");
	const [result, setResult] = useState<AdBlockerStatus | null>(null);
	const [busy, setBusy] = useState<"test" | "save" | "disconnect" | null>(null);

	const savedPasswordUsable = Boolean(info?.hasPassword && info.source === "App");
	// Empty password field: reuse the saved one if there is one, otherwise "no password".
	const passwordToSend = password ? password : savedPasswordUsable ? null : "";

	const test = async () => {
		setBusy("test");
		setResult(null);

		try {
			setResult(await settingsApi.testPiHole(baseUrl, passwordToSend));
		} catch (error) {
			toast({ tone: "error", title: "Test failed", description: (error as Error).message });
		} finally {
			setBusy(null);
		}
	};

	const save = async (event: React.FormEvent) => {
		event.preventDefault();
		setBusy("save");

		try {
			const saved = await settingsApi.savePiHole(baseUrl, passwordToSend);
			setPassword("");
			toast({ tone: "success", title: "Pi-hole connected", description: saved.baseUrl ?? undefined });
			onSaved?.(saved);
		} catch (error) {
			toast({ tone: "error", title: "Could not save", description: (error as Error).message });
		} finally {
			setBusy(null);
		}
	};

	const disconnect = async () => {
		setBusy("disconnect");

		try {
			await settingsApi.disconnectPiHole();
			setBaseUrl("");
			setPassword("");
			setResult(null);
			toast({ tone: "success", title: "Pi-hole disconnected" });
			onDisconnected?.();
		} catch (error) {
			toast({ tone: "error", title: "Could not disconnect", description: (error as Error).message });
		} finally {
			setBusy(null);
		}
	};

	return (
		<form onSubmit={save} className="space-y-4">
			{info?.source === "Environment" ? (
				<p className="rounded-2xl border border-sky-300/15 bg-sky-400/[0.06] px-4 py-3 text-xs leading-5 text-sky-100/80">
					Currently configured through environment variables. Saving here takes precedence.
				</p>
			) : null}

			<Field icon={<Globe className="size-4" />} label="Pi-hole address" hint="The address you open the Pi-hole admin page with, e.g. http://192.168.1.2">
				<input
					value={baseUrl}
					onChange={(event) => {
						setBaseUrl(event.target.value);
						setResult(null);
					}}
					placeholder="http://192.168.1.2"
					inputMode="url"
					autoComplete="off"
					required
					className={inputClassName}
				/>
			</Field>

			<PasswordField
				icon={<KeyRound className="size-4" />}
				label="App password"
				hint={
					savedPasswordUsable
						? "A password is saved. Leave empty to keep it."
						: "Pi-hole → Settings → Web interface / API → Configure app password. Leave empty if Pi-hole has no password."
				}
				value={password}
				onChange={(event) => {
					setPassword(event.target.value);
					setResult(null);
				}}
				placeholder={savedPasswordUsable ? "•••••••• (saved)" : "Pi-hole app password"}
				autoComplete="off"
			/>

			<AnimatePresence initial={false}>
				{result ? (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						className="overflow-hidden"
					>
						{result.reachable ? (
							<div className="flex items-start gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
								<CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />
								<span>
									Connected. Blocking is {result.blockingEnabled ? "on" : "off"}, {formatCompact(result.totalQueries)} queries
									today, {result.activeClients ?? 0} devices.
								</span>
							</div>
						) : (
							<div className="flex items-start gap-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
								<TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-300" />
								<span>{result.message ?? "Pi-hole could not be reached."}</span>
							</div>
						)}
					</motion.div>
				) : null}
			</AnimatePresence>

			<div className="flex flex-wrap items-center gap-2 pt-1">
				<Button type="button" variant="secondary" onClick={() => void test()} isLoading={busy === "test"} disabled={!baseUrl || busy !== null}>
					<PlugZap className="size-4" /> Test connection
				</Button>
				<Button type="submit" variant="primary" isLoading={busy === "save"} disabled={!baseUrl || busy !== null}>
					Save
				</Button>
				{secondaryAction}
				{info?.source === "App" ? (
					<Button
						type="button"
						variant="ghost"
						className="ml-auto hover:text-rose-300"
						onClick={() => void disconnect()}
						isLoading={busy === "disconnect"}
						disabled={busy !== null}
					>
						<Unplug className="size-4" /> Disconnect
					</Button>
				) : null}
			</div>
		</form>
	);
}
