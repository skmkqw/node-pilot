import { File, FileArchive, FileAudio, FileCode, FileImage, FileText, FileVideo, Folder } from "lucide-react";
import type { FileKind } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/** Each kind gets a plate colour from the palette, so file types are easy to tell apart at a glance. */
export const KIND_STYLES: Record<FileKind, { icon: typeof File; plate: string }> = {
	Directory: { icon: Folder, plate: "bg-accent text-ink" },
	Video: { icon: FileVideo, plate: "bg-ink text-accent" },
	Audio: { icon: FileAudio, plate: "bg-ok text-ink" },
	Image: { icon: FileImage, plate: "bg-alert text-ink" },
	Document: { icon: FileText, plate: "bg-surface text-ink" },
	Archive: { icon: FileArchive, plate: "bg-ground text-ink" },
	Code: { icon: FileCode, plate: "bg-surface text-ink" },
	Other: { icon: File, plate: "bg-ground text-ink" },
};

export function FileIcon({ kind, size = "md" }: { kind: FileKind; size?: "md" | "lg" }) {
	const { icon: Icon, plate } = KIND_STYLES[kind];

	return (
		<span className={cn("grid shrink-0 place-items-center border-2 border-ink", plate, size === "lg" ? "size-14" : "size-10")}>
			<Icon className={size === "lg" ? "size-6" : "size-[1.1rem]"} />
		</span>
	);
}
