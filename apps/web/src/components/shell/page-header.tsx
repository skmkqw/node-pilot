"use client";

import { motion } from "motion/react";

type PageHeaderProps = {
	eyebrow?: React.ReactNode;
	title: React.ReactNode;
	description?: React.ReactNode;
	actions?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
	return (
		<div className="mb-7 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
			<div className="min-w-0">
				{eyebrow ? (
					<motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="label mb-3 flex flex-wrap items-center gap-2 text-muted">
						{eyebrow}
					</motion.div>
				) : null}
				<h1 className="text-4xl font-bold leading-[1.02] tracking-tight text-ink sm:text-5xl">{title}</h1>
				{description ? <p className="mt-3 max-w-2xl font-mono text-sm text-muted">{description}</p> : null}
			</div>
			{actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
		</div>
	);
}
