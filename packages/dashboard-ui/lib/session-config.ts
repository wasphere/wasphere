export interface SessionConfig {
  random_delay_min_ms: number
  random_delay_max_ms: number
  auto_read_on_receive: boolean
  receive_enabled: boolean
}

export interface SessionSummary {
  id: string
  status: string
  phoneNumber?: string | null
  name?: string | null
  config: SessionConfig
}
