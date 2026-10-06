import React from "react";
import { hydrateNotesClient, hydrateService } from "./contract/transport";
import { ClientContext } from "./hooks/useClient";
import { MaintenanceContext } from "./hooks/useMaintenance";
import { NotesContext } from "./hooks/useNotes";
import { PlatformContext, type PlatformServices } from "./hooks/usePlatform";
import { SettingsContext } from "./hooks/useSettings";

function StartupMessage({ children }: React.PropsWithChildren) {
  return (
    <pre className="text-muted-foreground p-8 text-sm whitespace-pre-wrap">
      {children}
    </pre>
  );
}

/**
 * The composition root: the only place that reads the host
 * (window.chronicles). Waits for the host to open and migrate the library —
 * which can take a while on the first launch after an upgrade — and only then
 * asks for its services. A failed startup is shown, not deferred to first use.
 */
export async function startApp(
  host: Window["chronicles"] | undefined,
  render: (content: React.ReactNode) => void,
  app: React.ReactNode,
): Promise<void> {
  render(<StartupMessage>Opening your library…</StartupMessage>);
  try {
    if (!host) throw new Error("The host did not provide window.chronicles.");
    await host.ready();
    const {
      ready: _r,
      getClient,
      getNotesClient,
      getSettings,
      getMaintenance,
      ...rest
    } = host;
    const platform: PlatformServices = rest;
    render(
      <ClientContext.Provider value={getClient()}>
        <NotesContext.Provider value={hydrateNotesClient(getNotesClient())}>
          <SettingsContext.Provider value={hydrateService(getSettings())}>
            <MaintenanceContext.Provider
              value={hydrateService(getMaintenance())}
            >
              <PlatformContext.Provider value={platform}>
                {app}
              </PlatformContext.Provider>
            </MaintenanceContext.Provider>
          </SettingsContext.Provider>
        </NotesContext.Provider>
      </ClientContext.Provider>,
    );
  } catch (err) {
    console.error("[chronicles] startup failed", err);
    render(
      <StartupMessage>
        Chronicles could not open your library.{"\n\n"}
        {err instanceof Error ? err.message : String(err)}
      </StartupMessage>,
    );
  }
}
