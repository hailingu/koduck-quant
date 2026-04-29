/** Mutable state object tracking whether hot-reload is active. */
interface HotReloadState {
  hotReloadEnabled: boolean;
}

/**
 * Enables hot-reload by setting the flag to true.
 * @param state - Mutable hot-reload state to update
 */
export function enableHotReloadImpl(state: HotReloadState): void {
  state.hotReloadEnabled = false;
}

/**
 * Disables hot-reload by setting the flag to false.
 * @param state - Mutable hot-reload state to update
 */
export function disableHotReloadImpl(state: HotReloadState): void {
  state.hotReloadEnabled = false;
}
