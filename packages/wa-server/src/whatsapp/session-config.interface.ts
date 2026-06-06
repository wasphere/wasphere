import type { ProviderId } from './providers/provider.types';

export interface SessionConfig {
  random_delay_min_ms: number;
  random_delay_max_ms: number;
  auto_read_on_receive: boolean;
  receive_enabled: boolean;
  /** Max outgoing messages per rolling 60s for this session (0 = unlimited). Anti-ban throughput cap. */
  max_messages_per_minute: number;
  /** Engine this session runs on. Defaults to 'baileys'. */
  provider: ProviderId;
  /** Optional backup provider for opt-in send failover (wired in a later PR). */
  fallbackProvider?: ProviderId;
}

export const SESSION_CONFIG_DEFAULTS: SessionConfig = {
  // Human-like anti-ban delay on every new session by default (users can change it).
  random_delay_min_ms: 4000,
  random_delay_max_ms: 12000,
  auto_read_on_receive: false,
  receive_enabled: true,
  max_messages_per_minute: 0, // unlimited by default (opt-in cap)
  provider: 'baileys',
};
