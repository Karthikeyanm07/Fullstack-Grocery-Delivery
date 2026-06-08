export const ProductGridSkeleton = ({ count = 8 }: { count?: number }) => (
	<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 xl:gap-8">
		{Array.from({ length: count }).map((_, index) => (
			<div
				key={index}
				className="bg-white rounded-2xl overflow-hidden animate-pulse"
			>
				<div className="aspect-square bg-app-cream-dark" />
				<div className="p-3.5 space-y-3">
					<div className="h-4 bg-app-cream-dark rounded w-4/5" />
					<div className="h-4 bg-app-cream-dark rounded w-2/3" />
					<div className="flex justify-between items-center pt-2">
						<div className="h-5 bg-app-cream-dark rounded w-20" />
						<div className="size-7 bg-app-cream-dark rounded-full" />
					</div>
				</div>
			</div>
		))}
	</div>
);

export const TableSkeleton = ({ rows = 6 }: { rows?: number }) => (
	<div className="bg-white rounded-2xl border border-app-border overflow-hidden animate-pulse">
		<div className="h-16 bg-app-cream-dark" />
		<div className="divide-y divide-app-border">
			{Array.from({ length: rows }).map((_, index) => (
				<div key={index} className="h-16 bg-white px-6 flex items-center gap-4">
					<div className="size-10 rounded-lg bg-app-cream-dark" />
					<div className="h-4 rounded bg-app-cream-dark w-1/3" />
					<div className="h-4 rounded bg-app-cream-dark w-1/5 ml-auto" />
				</div>
			))}
		</div>
	</div>
);
