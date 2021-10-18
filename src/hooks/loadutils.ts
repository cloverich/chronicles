import { useState, useCallback } from "react";

// Obviously an import from evergreen-ui does not belong here
// but que hueva
import { toaster } from "evergreen-ui";

// https://stackoverflow.com/questions/53215285/how-can-i-force-component-to-re-render-with-hooks-in-react
function useForceUpdate() {
  const [, setTick] = useState(0);
  const update = useCallback(() => {
    setTick((tick) => tick + 1);
  }, []);
  return update;
}

/**
 * This is the signature of a setter as pulled from
 * React.useState().
 */
export type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

export type LoadingState =
  | { error: Error; loading: false }
  | { error: null; loading: false }
  | { error: null; loading: true };

type SettableLoadingState = LoadingState & {
  setLoading: Setter<boolean>;
  setError: Setter<Error | null>;
};

export type SavingState =
  | { saveError: Error; saving: false }
  | { saveError: null; saving: false }
  | { saveError: null; saving: true };

type SettableSavingState = SavingState & {
  setSaving: Setter<boolean>;
  setError: Setter<Error | null>;
};

// A void loadable...
export type Loadable = LoadingState & SavingState;

/**
 * Re-usable state for loading and errors
 * @param defaultLoading
 * @param defaultError
 */
export function useLoading(
  defaultLoading = true,
  defaultError = undefined
): SettableLoadingState {
  const [loading, setLoading] = useState<boolean>(defaultLoading);
  const [error, setError] = useState<Error | undefined | null>(defaultError);
  return { loading, setLoading, error, setError } as SettableLoadingState;
}

function useSaving(): SavingState {
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setError] = useState<Error | undefined | null>(null);
  return { saving, setSaving, saveError, setError } as SavingState;
}

/**
 * This utility wraps an async function to automate setting loading and error properties
 * each time it is called.
 *
 * ex:
 * async function unwrappedLoadDocuments() {}
 * const { loading, error, wrapper: loadDocuments } = withLoading(unwrappedLoadDocuments);
 *
 * // When called, loading and error are automatically managed
 * loadDocuments();
 *
 * @param cb - The async logic to wrap. Ex: const state = withLoading(() => fetch('http://foo.com'));
 */
export function withLoading<T extends any[], U>(
  cb: (...args: T) => Promise<U>,
  options: {
    canInterrupt?: boolean;
    propagate?: boolean;
    state?: SettableLoadingState;
    defaultLoading?: boolean;
  } = {
    canInterrupt: true,
    propagate: false,
    defaultLoading: false,
  }
): LoadingState & { wrapper: (...args: T) => Promise<void> } {
  const state = options.state || useLoading(options.defaultLoading);

  const wrapper = async (...args: T) => {
    if (state.loading && !options.canInterrupt) return;
    state.setLoading(true);
    state.setError(null);
    try {
      // todo: wrap in useEffect, only setLoading / Error / Toast afterwards
      // if still mounted.
      await cb(...args);
      state.setLoading(false);
    } catch (err) {
      // Extract the API error message, if any.
      // todo: A convention for error structure (like title/details)
      // would probably support moving this logic into the client library
      if (err instanceof HTTPError) {
        try {
          // Basically if the error comes from my backend, pull out the
          // error title then propagate. Client library should handle this.
          const json = await err.response.json();
          err = new Error(json.title);
        } catch (jsonError) {
          // at this point, rely on outer error handler
        }
      }
      state.setError(err);
      state.setLoading(false);
      if (options.propagate) {
        throw err;
      } else {
        toaster.danger(err.message);
      }
    }
  };

  return {
    loading: state.loading,
    error: state.error,
    wrapper,
  } as LoadingState & { wrapper: (...args: T) => Promise<void> };
}
