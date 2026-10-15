import { File, FileArchive, FileAudio, FileCode, FileImage, FileText, FileVideo, Folder } from "lucide-react";
import type { FileKind } from "@/lib/api/types";
import { cn } from "@/lib/cn";

export const KIND_STYLES: Record<FileKind, { icon: typeof File; color: string }> = {
	Directory: { icon: Folder, color: "#38bdf8" },
	Video: { icon: FileVideo, color: "#f472b6" },
	Audio: { icon: FileAudio, color: "#a78bfa" },
	Image: { icon: FileImage, color: "#34d399" },
	Document: { icon: FileText, color: "#fbbf24" },
	Archive: { icon: FileArchive, color: "#fb923c" },
	Code: { icon: FileCode, color: "#22d3ee" },
	Other: { icon: File, color: "#94a3b8" },
};

export function FileIcon({ kind, size = "md" }: { kind: FileKind; size?: "md" | "lg" }) {
	const { icon: Icon, color } = KIND_STYLES[kind];

	return (
		<span
			className={cn(
				"grid shrink-0 place-items-center rounded-xl border border-white/10",
				size === "lg" ? "size-14 rounded-2xl" : "size-10",
			)}
			style={{
				color,
				background: `linear-gradient(135deg, color-mix(in oklab, ${color} 20%, transparent), color-mix(in oklab, ${color} 4%, transparent))`,
			}}
		>
			<Icon className={size === "lg" ? "size-6" : "size-[1.15rem]"} />
		</span>
	);
}
