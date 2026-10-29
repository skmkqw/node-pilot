"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { filesApi } from "@/lib/api/endpoints";
import type { FileEntry } from "@/lib/api/types";
import { formatBytes, formatDateTime } from "@/lib/format";
import { FileIcon } from "./file-icon";

type MediaViewerProps = {
	items: FileEntry[];
	index: number | null;
	onIndexChange: (index: number | null) => void;
};

/** Full-screen viewer for videos, audio and images with keyboard navigation. */
export function MediaViewer({ items, index, onIndexChange }: MediaViewerProps) {
	const current = index !== null ? items[index] ?? null : null;
	// Keep rendering the last item while the modal animates out.
	const [lastItem, setLastItem] = useState<FileEntry | null>(null);

	if (current && current !== lastItem) {
		setLastItem(current);
	}

	const item = current ?? lastItem;
	const close = useCallback(() => onIndexChange(null), [onIndexChange]);

	const step = useCallback(
		(delta: number) => {
			if (index === null || items.length < 2) return;
			onIndexChange((index + delta + items.length) % items.length);
		},
		[index, items.length, onIndexChange],
	);

	useEffect(() => {
		if (index === null) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.target instanceof HTMLMediaElement) return;
			if (event.key === "ArrowRight") step(1);
			if (event.key === "ArrowLeft") step(-1);
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [index, step]);

	return (
		<Modal open={current !== null} onClose={close} className="max-w-5xl" labelledBy="media-viewer-title">
			{item ? (
				<div>
					<div className="flex items-center gap-3 border-b-2 border-ink bg-accent px-4 py-3 pr-14">
						<span className="led animate-blink bg-alert" />
						<span className="label">Playback{items.length > 1 && index !== null ? ` · ${index + 1} / ${items.length}` : ""}</span>
					</div>

					<div className="relative border-b-2 border-ink bg-black">
						<AnimatePresence mode="wait">
							<motion.div
								key={item.path}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.15 }}
								className="grid min-h-[16rem] place-items-center"
							>
								<MediaContent item={item} />
							</motion.div>
						</AnimatePresence>

						{items.length > 1 ? (
							<>
								<NavButton side="left" onClick={() => step(-1)} />
								<NavButton side="right" onClick={() => step(1)} />
							</>
						) : null}
					</div>

					<div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex min-w-0 items-center gap-3">
							<FileIcon kind={item.kind} />
							<div className="min-w-0">
								<h2 id="media-viewer-title" className="truncate font-bold">
									{item.name}
								</h2>
								<p className="font-mono text-xs text-muted">
									{formatBytes(item.sizeBytes)} · {formatDateTime(item.modifiedAtUtc)}
								</p>
							</div>
						</div>
						<a href={filesApi.contentUrl(item.path, true)} download className={buttonStyles("primary", "md")}>
							<Download className="size-4" /> Download
						</a>
					</div>
				</div>
			) : null}
		</Modal>
	);
}

function MediaContent({ item }: { item: FileEntry }) {
	const src = filesApi.contentUrl(item.path);

	if (item.kind === "Image") {
		// eslint-disable-next-line @next/next/no-img-element
		return <img src={src} alt={item.name} className="max-h-[70vh] w-auto object-contain" />;
	}

	if (item.kind === "Audio") {
		return (
			<div className="flex w-full flex-col items-center gap-8 bg-ground px-6 py-14">
				<div className="flex h-16 items-end gap-1.5" aria-hidden>
					{Array.from({ length: 12 }).map((_, bar) => (
						<motion.span
							key={bar}
							className="w-3 border-2 border-ink bg-accent"
							animate={{ height: ["20%", "100%", "35%", "80%", "20%"] }}
							transition={{ duration: 1.2 + (bar % 4) * 0.15, repeat: Infinity, delay: bar * 0.06, ease: "linear" }}
						/>
					))}
				</div>
				<audio src={src} controls autoPlay className="w-full max-w-md" />
			</div>
		);
	}

	return <video key={src} src={src} controls autoPlay playsInline className="max-h-[70vh] w-full bg-black" />;
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
	const Icon = side === "left" ? ChevronLeft : ChevronRight;

	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={side === "left" ? "Previous" : "Next"}
			className={`absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center border-2 border-ink bg-accent shadow-[3px_3px_0_var(--ink)] transition active:shadow-none ${side === "left" ? "left-3" : "right-3"}`}
		>
			<Icon className="size-5" />
		</button>
	);
}
