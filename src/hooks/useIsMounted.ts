import React from "react";

// https://stackoverflow.com/questions/58979309/checking-if-a-component-is-unmounted-using-react-hooks
// It seems strange I'd have to add this... using an observable object would resolve this I guess...
// But saving an object then unmounting seems so common... hmmm...
export function useIsMounted() {
  const isMountedRef = React.useRef(true);
  const isMounted = React.useCallback(() => isMountedRef.current, []);

  React.useEffect(() => {
    return () => void (isMountedRef.current = false);
  }, []);

  return isMounted;
}
