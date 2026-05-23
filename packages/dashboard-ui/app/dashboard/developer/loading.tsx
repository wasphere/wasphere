import { Skeleton } from "@/components/ui/skeleton"

export default function DeveloperLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}
