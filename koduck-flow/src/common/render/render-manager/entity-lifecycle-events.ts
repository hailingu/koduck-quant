export const EntityLifecycleTrackerEvent = {
  EntityNotTracked: "render-entity-tracker:entity-not-tracked",
  MissingRenderSelector: "render-entity-tracker:missing-render-selector",
  MissingRenderer: "render-entity-tracker:missing-renderer",
} as const;

export type EntityLifecycleTrackerEventMap = typeof EntityLifecycleTrackerEvent;
