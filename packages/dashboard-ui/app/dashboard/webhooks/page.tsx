import { WebhooksTab } from "@/components/webhooks/webhooks-tab"

export default function WebhooksPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Webhooks</h1>
      <WebhooksTab />
    </div>
  )
}
