import { ProviderCapability, ProviderId } from './provider.types';

/**
 * Thrown when an operation is requested on a provider that does not support it
 * (design §10). Controllers map this to **501 Not Implemented** with
 * `{ error, capability, provider }` so the client gets a typed, shallow failure
 * instead of a deep one.
 */
export class CapabilityError extends Error {
  readonly capability: ProviderCapability;
  readonly provider?: ProviderId;

  constructor(capability: ProviderCapability, provider?: ProviderId) {
    super(
      `Capability '${capability}' is not supported` +
        (provider ? ` by provider '${provider}'` : ''),
    );
    this.name = 'CapabilityError';
    this.capability = capability;
    this.provider = provider;
  }
}
