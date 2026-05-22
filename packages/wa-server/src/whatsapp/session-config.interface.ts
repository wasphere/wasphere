export interface SessionConfig {
  random_delay_min_ms: number;
  random_delay_max_ms: number;
  auto_read_on_receive: boolean;
  receive_enabled: boolean;
}

export const SESSION_CONFIG_DEFAULTS: SessionConfig = {
  random_delay_min_ms: 0,
  random_delay_max_ms: 0,
  auto_read_on_receive: false,
  receive_enabled: true,
};
