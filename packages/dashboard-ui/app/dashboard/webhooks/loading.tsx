import { Skeleton } from "@/components/ui/skeleton"

export default function WebhooksLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-full" />
    </div>
  )
}
