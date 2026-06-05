import type { ProviderId } from './providers/provider.types';

export interface SessionConfig {
  random_delay_min_ms: number;
  random_delay_max_ms: number;
  auto_read_on_receive: boolean;
  receive_enabled: boolean;
  /** Engine this session runs on. Defaults to 'baileys'. */
  provider: ProviderId;
  /** Optional backup provider for opt-in send failover (wired in a later PR). */
  fallbackProvider?: ProviderId;
}

export const SESSION_CONFIG_DEFAULTS: SessionConfig = {
  random_delay_min_ms: 0,
  random_delay_max_ms: 0,
  auto_read_on_receive: false,
  receive_enabled: true,
  provider: 'baileys',
};
