"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
		<Modal open={current !== null} onClose={close} className="max-w-5xl overflow-hidden" labelledBy="media-viewer-title">
			{item ? (
				<div>
					<div className="relative bg-black">
						<AnimatePresence mode="wait">
							<motion.div
								key={item.path}
								initial={{ opacity: 0, scale: 0.98 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.98 }}
								transition={{ duration: 0.25 }}
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

					<div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex min-w-0 items-center gap-3">
							<FileIcon kind={item.kind} />
							<div className="min-w-0">
								<h2 id="media-viewer-title" className="truncate font-medium text-white">
									{item.name}
								</h2>
								<p className="text-xs text-muted">
									{formatBytes(item.sizeBytes)} · {formatDateTime(item.modifiedAtUtc)}
									{items.length > 1 && index !== null ? ` · ${index + 1} of ${items.length}` : ""}
								</p>
							</div>
						</div>
						<a href={filesApi.contentUrl(item.path, true)} download>
							<Button variant="secondary" size="md">
								<Download className="size-4" /> Download
							</Button>
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
		return <img src={src} alt={item.name} className="max-h-[72vh] w-auto object-contain" />;
	}

	if (item.kind === "Audio") {
		return (
			<div className="flex w-full flex-col items-center gap-8 px-6 py-14">
				<div className="relative grid size-28 place-items-center">
					{[0, 1, 2].map((ring) => (
						<motion.span
							key={ring}
							className="absolute inset-0 rounded-full border border-violet-300/30"
							animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
							transition={{ duration: 2.4, repeat: Infinity, delay: ring * 0.8, ease: "easeOut" }}
						/>
					))}
					<FileIcon kind="Audio" size="lg" />
				</div>
				<audio src={src} controls autoPlay className="w-full max-w-md" />
			</div>
		);
	}

	return (
		<video
			key={src}
			src={src}
			controls
			autoPlay
			playsInline
			className="max-h-[72vh] w-full bg-black"
		/>
	);
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
	const Icon = side === "left" ? ChevronLeft : ChevronRight;

	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={side === "left" ? "Previous" : "Next"}
			className={`absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur transition hover:scale-110 hover:bg-black/70 ${side === "left" ? "left-3" : "right-3"}`}
		>
			<Icon className="size-5" />
		</button>
	);
}
