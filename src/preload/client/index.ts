import settings from "../../electron/settings";
import { createHostServices, type HostServices } from "./factory";

let host: HostServices | undefined;
let hostPromise: Promise<HostServices> | undefined;

/**
 * Opens and migrates the library. Called once at preload startup; later
 * calls return the same promise (the renderer's ready()).
 */
export function initHost(): Promise<HostServices> {
  if (!hostPromise) {
    hostPromise = createHostServices(settings).then((h) => (host = h));
  }
  return hostPromise;
}

/** The host's services; throws until initHost() has resolved. */
export function getHost(): HostServices {
  if (!host) {
    throw new Error(
      "[chronicles] host services requested before the library opened. " +
        "Await ready() first.",
    );
  }
  return host;
}
