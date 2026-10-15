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
		<div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
			<div className="min-w-0">
				{eyebrow ? (
					<motion.div
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted"
					>
						{eyebrow}
					</motion.div>
				) : null}
				<h1 className="bg-gradient-to-br from-white via-white to-slate-400 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl">
					{title}
				</h1>
				{description ? <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p> : null}
			</div>
			{actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
		</div>
	);
}
