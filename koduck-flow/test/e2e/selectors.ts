/**
 * Playwright E2E Test Selectors for Koduck Flow
 *
 * Centralized selector constants for E2E tests.
 * Ensures consistency across test files and makes selector maintenance easier.
 *
 * @see docs/e2e-remediation-task-list.md#E2E-A2 for task details
 * @see docs/e2e-selectors-gap-analysis.md for gap analysis
 */

/**
 * Runtime initialization and lifecycle selectors
 */
export const RuntimeSelectors = {
  // Initialization signal (shown when runtime is ready)
  ready: '[data-testid="runtime-ready"]',

  // Rendering completion flags
  renderComplete: '[data-testid="render-complete"]',
  scrollComplete: '[data-testid="scroll-complete"]',

  // Canvas controls
  zoomToFit: '[data-testid="zoom-to-fit"]',
};

/**
 * Entity Management selectors
 */
export const EntitySelectors = {
  // Entity container (template: entity-${id})
  container: (id: string) => `[data-testid="entity-${id}"]`,
  containerPrefix: '[data-testid^="entity-"]',

  // Entity display name (in rendered list)
  displayName: '[data-testid="entity-display-name"]',

  // Edit controls
  editButton: (id: string) => `[data-testid="edit-entity-${id}"]`,
  deleteButton: (id: string) => `[data-testid="delete-entity-${id}"]`,

  // Edit form fields
  nameInput: '[data-testid="entity-name-input"]',
  saveButton: '[data-testid="save-entity"]',

  // Create form fields (in entity management section)
  idInput: '[data-testid="entity-id"]',
  typeInput: '[data-testid="entity-type"]',
  nameInputCreate: '[data-testid="entity-create-name"]',
  confirmCreateButton: '[data-testid="confirm-create"]',
  createButton: '[data-testid="create-entity-btn"]',

  // Delete confirmation
  confirmDeleteButton: '[data-testid="confirm-delete"]',
};

/**
 * Flow Management selectors
 */
export const FlowSelectors = {
  // Flow container (template: flow-${id})
  container: (id: string) => `[data-testid="flow-${id}"]`,

  // Flow controls
  createButton: '[data-testid="create-flow-btn"]',
  idInput: '[data-testid="flow-id"]',
  nameInput: '[data-testid="flow-name"]',

  // Node management within flow
  addNodeButton: '[data-testid="add-node-btn"]',
  nodeIdInput: '[data-testid="node-id"]',
  nodeTypeInput: '[data-testid="node-type"]',
  nodeXInput: '[data-testid="node-x"]',
  nodeYInput: '[data-testid="node-y"]',
  confirmNodeButton: '[data-testid="confirm-node"]',
  nodeButton: (id: string) => `[data-testid="node-${id}"]`,

  // Connection/Link controls
  confirmConnectionButton: '[data-testid="confirm-connection"]',
  resetButton: '[data-testid="reset-flow"]',
  saveButton: '[data-testid="save-flow"]',

  // Flow execution
  executeButton: (id: string) => `[data-testid="execute-flow-${id}"]`,
  executionComplete: '[data-testid="execution-complete"]',
  executionError: '[data-testid="execution-error"]',
  executionErrorDetails: '[data-testid="error-details"]',
  executionTime: '[data-testid="execution-time"]',
  executionResultPanel: '[data-testid="execution-result"]',
};

/**
 * Multi-Tenant & Theme selectors
 */
export const TenantSelectors = {
  // Tenant context selector
  selector: '[data-testid="tenant-selector"]',
  option: (tenantId: string) => `[data-testid="tenant-option-${tenantId}"]`,
  activeIndicator: (tenantId: string) => `[data-testid="tenant-${tenantId}-active"]`,
  currentTenantDisplay: '[data-testid="current-tenant-display"]',

  // Theme indicator/display
  themeIndicator: '[data-testid="theme-indicator"]',
  themeSwitcher: '[data-testid="theme-switcher"]',

  // Feature flags
  advancedFeature: '[data-testid="advanced-feature"]',
  basicFeature: '[data-testid="basic-feature"]',
};

/**
 * Renderer Control selectors
 */
export const RendererSelectors = {
  // Renderer selection
  selector: '[data-testid="renderer-selector"]',
  reactButton: '[data-testid="renderer-react"]',
  canvasButton: '[data-testid="renderer-canvas"]',
  webgpuButton: '[data-testid="renderer-webgpu"]',
  active: (renderer: string) => `[data-testid="renderer-active-${renderer}"]`,
  optionsPanel: '[data-testid="renderer-options"]',
  status: '[data-testid="renderer-switch-status"]',
  completionSignal: '[data-testid="renderer-switch-complete"]',
  switchLog: '[data-testid="renderer-switch-log"]',
};

/**
 * FlowDemo Canvas & Interaction selectors
 */
export const FlowDemoSelectors = {
  // Canvas and editor elements
  canvas: "canvas",
  editor: '[data-testid="flow-editor"]',

  // Node management
  canvasNodeContainer: '[data-testid^="node-"]',
  nodeButton: (id: string) => `[data-testid="node-${id}"]`,
  addNodeButton: '[data-testid="add-node-btn"]',
  nodeCountIndicator: '[data-testid="node-count-display"]',

  // Connection/Edge management
  connectionElement: '[data-testid^="connection-"]',
  connectionsList: '[data-testid="connections-list"]',
  connectionCountIndicator: '[data-testid="connection-count-display"]',

  // Control buttons
  undoButton: '[data-testid="undo-btn"]',
  redoButton: '[data-testid="redo-btn"]',
  zoomInButton: '[data-testid="zoom-in-btn"]',
  zoomOutButton: '[data-testid="zoom-out-btn"]',
  zoomToFitButton: '[data-testid="zoom-to-fit-btn"]',
  panButton: '[data-testid="pan-btn"]',

  // Selection and state indicators
  selectedNodeClass: ".selected",
  selectedIndicator: '[data-selected="true"]',

  // Viewport/View controls
  viewportInfo: '[data-testid="viewport-info"]',
  zoomLevelDisplay: '[data-testid="zoom-level"]',
};

/**
 * Runtime Factory & Quota Management selectors
 */
export const RuntimeFactorySelectors = {
  // Quota enforcement dialogs and messages
  quotaErrorDialog: '[data-testid="quota-error-dialog"]',
  quotaLimitExceededMsg: '[data-testid="quota-limit-exceeded"]',
  quotaUsageDisplay: '[data-testid="quota-usage-display"]',

  // Tenant management
  tenantSwitchButton: '[data-testid="tenant-switch-button"]',
  tenantOption: (tenantId: string) => `[data-testid="tenant-option-${tenantId}"]`,
  currentTenantDisplay: '[data-testid="current-tenant-display"]',

  // Dialog/form buttons
  confirmButton: '[data-testid="confirm-btn"]',
  cancelButton: '[data-testid="cancel-btn"]',
  closeButton: '[data-testid="close-btn"]',

  // Quota status indicators
  quotaLimitIndicator: '[data-testid="quota-limit-indicator"]',
  quotaRemainingDisplay: '[data-testid="quota-remaining"]',

  // Isolation verification
  tenantDataContainer: (tenantId: string) => `[data-testid="tenant-data-${tenantId}"]`,
};

/**
 * Convenience helper to build dynamic selectors
 * @param pattern - Selector pattern with ${...} placeholder
 * @param values - Values to interpolate
 * @returns Complete selector
 */
export const buildSelector = (pattern: string, values: Record<string, string>): string => {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replace(`\${${key}}`, value);
  }, pattern);
};

/**
 * Combined export for tests
 */
export const E2ESelectors = {
  runtime: RuntimeSelectors,
  entity: EntitySelectors,
  flow: FlowSelectors,
  tenant: TenantSelectors,
  renderer: RendererSelectors,
  flowDemo: FlowDemoSelectors,
  runtimeFactory: RuntimeFactorySelectors,
  buildSelector,
};

export default E2ESelectors;
