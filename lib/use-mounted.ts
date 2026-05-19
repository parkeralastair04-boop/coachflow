import { useSyncExternalStore } from "react";

/** True after client hydration — avoids theme flash mismatches without useEffect. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
