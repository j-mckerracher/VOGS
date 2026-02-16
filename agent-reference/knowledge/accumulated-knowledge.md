# Accumulated Knowledge

This file contains cumulative narrative knowledge discovered during workflows.

---

## Baseline Workspace/Tooling Setup (UOW-01)

**Discovered by**: software_engineer during UOW-01  
**Date**: 2025-01-30  
**Files**:
- `package.json`
- `tsconfig.json`
- `angular.json`
- `tailwind.config.js`
- `.env.example`
- `eslint.config.js`
- `.prettierrc`

**Pattern**: Baseline workspace setup follows micro-level plan section 3.2 specifications. TypeScript configuration uses strict mode with `strict=true`, `noImplicitAny`, and `strictNullChecks` enabled.

**Implementation Details**:
- Package scripts align with micro-level baseline requirements
- Environment configuration includes required key definitions in `.env.example`
- Linting and formatting configured via ESLint and Prettier
- Static validation passed for scripts/environment/TS strictness
- Lint/test runtime verification pending dependency installation

**Code Example**:
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

---

## ESLint Node Globals Configuration for .mjs Scripts (UOW-01 Revision #2)

**Discovered by**: software_engineer during UOW-01 revision attempt #2  
**Date**: 2025-01-30  
**Files**:
- `eslint.config.js`
- `scripts/**/*.mjs`

**Pattern**: ESLint flat-config requires explicit Node.js global declarations for .mjs scripts to avoid `no-undef` errors on `console` and `process`.

**Implementation Details**:
- Lint gate failed on two .mjs scripts due to `no-undef` errors for `console`
- Evaluator feedback (E1) identified the need for Node globals configuration
- Solution: Add ESLint flat-config block with `files: ['scripts/**/*.mjs']` and `languageOptions.globals` set to readonly for `console` and `process`

**Code Example**:
```javascript
// eslint.config.js - flat-config pattern
{
  files: ['scripts/**/*.mjs'],
  languageOptions: {
    globals: {
      console: 'readonly',
      process: 'readonly'
    }
  }
}
```

**Additional Context**:
- This finding is part of the workflow evaluation/optimization loop
- Related artifacts located in external paths (workflow-config.yaml, evaluator feedback, implementation reports)

---

## Core Models and Configuration Patterns (UOW-02)

**Discovered by**: software_engineer during change_id 001 UOW-02  
**Date**: 2025-01-30  
**Files**:
- `src/app/core/models/fusion-mode.model.ts`
- `src/app/core/models/representation-mode.model.ts`
- `src/app/core/models/load-state.model.ts`
- `src/app/core/models/scene-manifest.model.ts`
- `src/app/core/config/metrics.constants.ts`

**Pattern**: Type-safe literal unions from readonly const arrays; immutable metrics constants with `as const` assertion.

**Implementation Details**:
- No existing src tree was present—files created from scratch under `src/app/core`
- Model files use readonly const arrays to define allowed values, then derive TypeScript union types
- Configuration constants use `as const` for immutability and type narrowing
- No prior in-repo model contract patterns were available to reuse

**Code Example**:
```typescript
// Model pattern - type-safe literal unions
export const FUSION_MODES = ['orthographic', 'perspective', 'hybrid'] as const;
export type FusionMode = typeof FUSION_MODES[number];

// Config pattern - immutable constants
export const METRICS = {
  MAX_LOAD_TIME_MS: 5000,
  CACHE_SIZE_MB: 128
} as const;
```

**Additional Context**:
- Established foundational model patterns for the codebase
- These patterns should be followed for future model/config file creation
- Location pattern: models in `src/app/core/models/`, configs in `src/app/core/config/`

---

## Signal-Based State Management with FusionStoreService (UOW-03)

**Discovered by**: software_engineer during UOW-03  
**Date**: 2025-01-30  
**Files**:
- `src/app/core/models/fusion-state.model.ts`
- `src/app/core/services/fusion-store.service.ts`
- `src/app/core/services/fusion-store.service.spec.ts`

**Pattern**: Signal-based state management using Angular signals with private writable signal, readonly computed selectors, and business rule enforcement in setter methods.

**Implementation Details**:
- FusionStoreService manages centralized application state using Angular signals
- API methods: `setFusionMode()`, `setRepresentationMode()`, `setLoadState()`
- Computed selectors expose readonly access: `fusionMode()`, `representationMode()`, `loadState()`
- Business rule: `setRepresentationMode()` early-returns when `fusionMode` is `ground_truth` (read-only guard)
- FusionState model defines the state structure with FusionMode, RepresentationMode, and LoadState types
- Test suite validates valid state updates and ground_truth read-only enforcement

**Code Example**:
```typescript
// Signal-based state pattern
export class FusionStoreService {
  private readonly state = signal<FusionState>({
    fusionMode: 'orthographic',
    representationMode: 'image',
    loadState: 'idle'
  });

  // Readonly computed selectors
  public readonly fusionMode = computed(() => this.state().fusionMode);
  public readonly representationMode = computed(() => this.state().representationMode);
  public readonly loadState = computed(() => this.state().loadState);

  // API methods with business rules
  setRepresentationMode(mode: RepresentationMode): void {
    if (this.state().fusionMode === 'ground_truth') {
      return; // Read-only guard
    }
    this.state.update(s => ({ ...s, representationMode: mode }));
  }
}
```

**Additional Context**:
- Vitest test environment configuration issue discovered: jsdom dependency missing in default environment
- Tests pass when run with `--environment node` flag
- This establishes the state management pattern for other services in the application
- Location pattern: services in `src/app/core/services/`, with corresponding `.spec.ts` test files

---

## Scene Asset Service Implementation Requirements (UOW-04)

**Discovered by**: exploration agent during UOW-04 planning  
**Date**: 2025-01-30  
**Files**:
- `C:/Users/jmckerra/ObsidianNotes/Main/01-Projects/Demo-Gaussian-Splat/orchestrated-agent-work/001/execution/UOW-04/uow_spec.yaml`
- `C:/Users/jmckerra/ObsidianNotes/Main/01-Projects/Demo-Gaussian-Splat/Planning/micro-level-plan.md`
- `src/app/core/models/scene-manifest.model.ts`
- `src/app/core/services/fusion-store.service.ts`

**Pattern**: HTTP service with timeout/retry policy, typed LoadEvent union, and error taxonomy for asset operations.

**Implementation Requirements**:
- **Timeout**: 12 second timeout for asset fetch operations (micro-level plan section 4.1)
- **Retry Policy**: Exactly one retry for transient network errors (micro-level plan section 6.2/6.3)
- **LoadEvent Types**: Union type `loading | ready | failed` for asset load state tracking
- **Error Taxonomy**: Three error types defined:
  - `ASSET_FETCH_ERROR`: Network/HTTP errors during asset retrieval
  - `ASSET_PARSE_ERROR`: JSON parsing failures or invalid manifest structure
  - `ASSET_BUDGET_ERROR`: Asset size exceeds defined budget limits

**Implementation Details**:
- Service location: `src/app/core/services/scene-asset.service.ts`
- Error handling location: `src/app/core/errors/` (per UOW spec implementation hints)
- Use readonly const arrays + derived union types pattern (consistent with existing model patterns)
- Integrate with existing FusionStoreService for state management
- Tests should validate timeout behavior, retry logic, and error taxonomy handling

**Code Pattern**:
```typescript
// LoadEvent union type pattern
export const LOAD_EVENTS = ['loading', 'ready', 'failed'] as const;
export type LoadEvent = typeof LOAD_EVENTS[number];

// Error taxonomy constants
export const ASSET_ERRORS = {
  FETCH: 'ASSET_FETCH_ERROR',
  PARSE: 'ASSET_PARSE_ERROR',
  BUDGET: 'ASSET_BUDGET_ERROR'
} as const;
```

**Additional Context**:
- Planning documentation located in external Obsidian vault referenced by UOW spec
- Micro-level plan sections 4.1 (timeout/retry) and 6.2/6.3 (error taxonomy) are authoritative sources
- Implementation must follow Angular Injectable service pattern with Vitest test coverage

---

## TypeScript Strict Type Narrowing Patterns for Tuple Includes (UOW-04 Revision #2)

**Discovered by**: software_engineer during UOW-04 revision attempt #2  
**Date**: 2025-01-30  
**Files**:
- `src/app/core/services/scene-asset.service.ts`
- `execution/UOW-04/impl_report.yaml`
- `execution/UOW-04/logs/tsc_attempt2.log`
- `execution/UOW-04/logs/lint_attempt2.log`
- `execution/UOW-04/logs/test_attempt2.log`

**Pattern**: Type widening for tuple `.includes()` checks and explicit casting after type guard validation in strict TypeScript mode.

**Implementation Details**:
- **Tuple includes fix**: TypeScript strict mode requires widening readonly tuple types for `.includes()` checks
  - Pattern: `(CONST_ARRAY as readonly string[]).includes(value)` for string tuples
  - Pattern: `(CONST_ARRAY as readonly number[]).includes(value)` for number tuples
- **Return type narrowing**: After guard clause validation, explicitly cast return value to narrow type
  - Pattern: `return extension as SceneAssetFormat` after guard confirms valid format
- **Compilation validation**: Changes verified with `npx tsc --noEmit` (strict mode compilation)
- **Lint validation**: ESLint rules pass with `npm run lint`
- **Test validation**: Vitest tests pass with `--environment node` (4/4 tests pass)

**Code Example**:
```typescript
// Tuple includes pattern - widen for .includes() check
export const SCENE_ASSET_FORMATS = ['.splat', '.ply', '.gltf'] as const;
export type SceneAssetFormat = typeof SCENE_ASSET_FORMATS[number];

function getFormat(extension: string): SceneAssetFormat | null {
  // Widen readonly tuple to readonly string[] for includes check
  if (!(SCENE_ASSET_FORMATS as readonly string[]).includes(extension)) {
    return null;
  }
  // After guard validation, explicitly cast to narrow type
  return extension as SceneAssetFormat;
}
```

**Additional Context**:
- This pattern resolves strict TypeScript tuple type checking issues
- Minimal scoped fix approach: only modify type assertions, no logic changes
- Verification gate passed: compile + lint + tests all green
- Related to strict mode configuration established in UOW-01 (learn-001)

---

## Hero Section Component Implementation and Verification (UOW-09)

**Discovered by**: software_engineer during UOW-09  
**Date**: 2025-01-30  
**Files**:
- `src/app/features/hero/hero-section.component.ts`
- `src/app/features/hero/hero-section.component.html`
- `src/app/features/hero/hero-section.component.scss`
- `src/app/features/hero/hero-section.component.spec.ts`
- `scripts/verify-hero-integrity.mjs`
- `e2e/demo-flow.spec.ts`

**Pattern**: Hero component uses Angular @Output() EventEmitter pattern for user interaction events and implements scroll behavior via native DOM scrollIntoView API.

**Implementation Details**:
- Repo state at start: Core services/models present; hero component and e2e files were absent and needed creation
- Hero component location: `src/app/features/hero/` following feature-based organization pattern
- Event emission pattern: `@Output() viewDemo = new EventEmitter<void>()` with `onViewDemoClick()` handler
- Scroll implementation: `onViewDemoClick()` emits event then scrolls to `#demo-section` via `element.scrollIntoView({ behavior: 'smooth' })`
- Verification script: `scripts/verify-hero-integrity.mjs` validates canonical PRD hero copy snippets against component template
- Drift detection: Script flags content drift >1.9 characters outside hero template files (test files excluded from drift checks)
- E2E test: `e2e/demo-flow.spec.ts` validates hero section user interaction flow

**Code Example**:
```typescript
// Hero component event pattern
export class HeroSectionComponent {
  @Output() viewDemo = new EventEmitter<void>();
  
  onViewDemoClick(): void {
    this.viewDemo.emit();
    const demoSection = document.getElementById('demo-section');
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
```

**Additional Context**:
- Established feature module organization pattern: `src/app/features/{feature-name}/`
- Verification script pattern: Use `.mjs` scripts in `scripts/` for content integrity validation
- E2E test pattern: End-to-end tests in `e2e/` directory using Playwright
- Content validation: PRD serves as source of truth for copy; automated verification detects drift

---

## Renderer Adapter Service with Idempotent Guards and Disposal Pattern (UOW-05)

**Discovered by**: software_engineer during UOW-05  
**Date**: 2025-01-30  
**Files**:
- `src/app/core/services/renderer-adapter.service.ts`
- `src/app/core/services/renderer-adapter.service.spec.ts`
- `src/app/core/models/parsed-scene-payload.model.ts`

**Pattern**: Renderer adapter service implements idempotent apply* methods with early-return guards and proper disposal loop teardown using setAnimationLoop(null).

**Implementation Details**:
- Service location: `src/app/core/services/` following established core service organization pattern
- **Idempotent guard pattern**: API methods check current state and early-return if already in target mode
  - Pattern: `if (this.fusionMode === mode) { return; }` prevents redundant state transitions
  - Applies to applyFusionMode(), applyRepresentationMode(), and other apply* methods
- **Disposal loop teardown**: dispose() method uses `renderer.setAnimationLoop(null)` to properly stop animation loop
  - Critical for preventing memory leaks when cleaning up Three.js renderer resources
- **ParsedScenePayload model**: Defines the data structure for scene payload with required properties
- **Testing environment**: Tests passed with `--environment node` flag (consistent with Vitest jsdom dependency issue)
- **Build status**: Build currently fails due to missing `@angular-devkit/build-angular:application` builder package

**Code Example**:
```typescript
// Idempotent guard pattern for state changes
applyFusionMode(mode: FusionMode): void {
  if (this.fusionMode === mode) {
    return; // Early-return guard prevents redundant operations
  }
  // ... apply mode change logic
}

// Proper disposal with animation loop teardown
dispose(): void {
  if (this.renderer) {
    this.renderer.setAnimationLoop(null); // Stop animation loop
    this.renderer.dispose();
  }
  // ... cleanup other resources
}
```

**Additional Context**:
- Idempotent pattern should be applied to all state-changing methods in services
- Disposal methods must explicitly stop animation loops before disposing resources
- Three.js renderer cleanup requires both setAnimationLoop(null) and dispose() calls
- Build dependency issue needs resolution: @angular-devkit/build-angular:application package missing

---

## TypeScript Strict Compilation Fixes for Renderer Adapter (UOW-05 Revision #2)

**Discovered by**: software_engineer during UOW-05 revision attempt #2  
**Date**: 2025-01-30  
**Files**:
- `package.json`
- `src/app/core/services/renderer-adapter.service.ts`

**Pattern**: Three.js TypeScript type imports and Material disposal signature narrowing for strict mode compilation.

**Implementation Details**:
- **Missing @types/three dependency**: Added `@types/three@0.167.2` as devDependency for TypeScript type definitions
- **Type import pattern**: Use explicit type imports for Three.js interfaces to avoid runtime imports
  - Pattern: `import { ..., type Object3D } from 'three';`
- **Material disposal signature narrowing**: `disposeMaterial` method parameter narrowed from `Material | Material[] | undefined` to `Material | Material[]`
  - Removes undefined handling after strict compile surfaced TS2339 errors
  - Caller guards against undefined before invoking disposeMaterial
- **Traverse type annotation**: Scene traversal requires explicit `Object3D` type annotation
  - Pattern: `this.scene.traverse((node: Object3D) => { ... })`
- **Verification gates**: All three quality gates passed after fixes:
  - `npx tsc --noEmit` - TypeScript compilation pass
  - Targeted vitest tests (6/6) - Unit test pass
  - Targeted lint - ESLint pass

**Code Example**:
```typescript
// Type import pattern for Three.js interfaces
import { Scene, WebGLRenderer, Camera, type Object3D, type Material } from 'three';

// Narrowed disposeMaterial signature
private disposeMaterial(material: Material | Material[]): void {
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach(m => m.dispose());
}

// Explicit Object3D type annotation in traverse
this.scene.traverse((node: Object3D) => {
  if ((node as any).geometry) {
    (node as any).geometry.dispose();
  }
  if ((node as any).material) {
    this.disposeMaterial((node as any).material);
  }
});
```

**Additional Context**:
- Minimal scoped fix approach: only address TypeScript compile errors, no refactoring
- @types/three must match the three.js package version for type compatibility
- Type imports (`type Object3D`) prevent runtime imports and reduce bundle size
- Signature narrowing approach: remove undefined from signature and guard at call sites

---

## Scene Asset Budget and Manifest Contract Validation (UOW-11)

**Discovered by**: software_engineer during UOW-11  
**Date**: 2025-01-30  
**Files**:
- `scripts/check-asset-budget.mjs`
- `scripts/validate-manifest.mjs`
- `scripts/check-asset-budget.spec.mjs`
- `src/assets/manifests/scene-manifest.json`
- `package.json`

**Pattern**: Node.js validation scripts with environment-based fixture overrides, non-zero exit codes for failures, and npm script integration for CI/CD quality gates.

**Implementation Details**:
- **Asset budget validation**: `scripts/check-asset-budget.mjs` validates scene total size against 2,000,000 byte budget
  - Threshold: `SCENE_ASSET_BUDGET_BYTES = 2_000_000`
  - Exit behavior: Sets `process.exitCode = 1` on budget violations
  - Error output: `ASSET_BUDGET_ERROR: N scene(s) exceed X bytes.` with per-scene details
  - Environment override: `SCENE_MANIFEST_PATH` env var allows custom manifest path for testing fixtures
- **Manifest contract validation**: `scripts/validate-manifest.mjs` validates manifest structure and required fields
  - Required fields: `version`, `generatedAt`, `scenes[]`, per-scene `sceneId`, `displayName`, `defaultFusionMode`, `defaultRepresentationMode`, `assets[]`
  - Exit behavior: Sets `process.exitCode = 1` on validation failures
  - Error output: Lists all contract violations with field paths (e.g., `Manifest.scenes[0].sceneId is required`)
  - Allowed values: `FUSION_MODES = ["single_agent", "naive_fusion", "vogs", "ground_truth"]`, `REPRESENTATION_MODES = ["occupancy", "gaussian"]`
- **Test fixture pattern**: Use `SCENE_MANIFEST_PATH` env var to point to test fixtures in spec files
  - Pattern: `process.env.SCENE_MANIFEST_PATH = resolve(..., 'fixtures/oversized-scene.json')`
- **npm script integration**: Both validation scripts integrated into quality gate chain
  - Individual scripts: `check:asset-budget`, `check:manifest-contract`
  - Quality gate chain: `check` script runs `lint && test && check:asset-budget && check:manifest-contract && check:hero`
- **Validation exit pattern**: Scripts set `process.exitCode = 1` rather than throwing/process.exit() to allow graceful shutdown
- **Test verification**: Unit tests validate oversized scenes produce `ASSET_BUDGET_ERROR` and non-zero exit, invalid manifests report missing/malformed fields

**Code Example**:
```javascript
// Asset budget validation pattern
export const SCENE_ASSET_BUDGET_BYTES = 2_000_000;

export function getManifestPath() {
  const manifestPath = process.env.SCENE_MANIFEST_PATH ?? DEFAULT_MANIFEST_PATH;
  return resolve(process.cwd(), manifestPath);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = runBudgetCheck();
    if (!result.ok) {
      process.exitCode = 1; // Non-zero exit for CI/CD
    }
  } catch (error) {
    console.error(`ASSET_BUDGET_ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
```

**Additional Context**:
- Validation scripts follow .mjs module pattern consistent with other verification scripts
- Exit code pattern (process.exitCode = 1) allows npm script chains to fail fast in CI/CD
- Environment-based fixture override pattern enables testing without modifying source manifests
- Manifest contract validation enforces type and value constraints at build time
- Budget validation prevents deployment of oversized assets that would violate performance constraints

---

## Service Test Patterns and Demo Feature Organization (UOW-06)

**Discovered by**: exploration agent during UOW-06  
**Date**: 2025-02-15  
**Files**:
- `src/app/core/services/scene-asset.service.ts`
- `src/app/core/services/fusion-store.service.ts`
- `src/app/core/services/renderer-adapter.service.ts`
- `src/app/features/hero/hero-section.component.spec.ts`

**Pattern**: Service specs instantiate classes directly without Angular TestBed; demo feature folder requires creation; LoadEvent types defined inline rather than as separate model.

**Implementation Details**:
- **Service test pattern**: Existing service specs (scene-asset, fusion-store, renderer-adapter) use Vitest class-level instantiation without TestBed
  - Pattern: `const service = new ServiceClass()` in `beforeEach()` blocks
  - No `TestBed.configureTestingModule()` or `TestBed.inject()` usage found
- **LoadEvent type location**: SceneAssetService defines `LoadEvent` types inline in the service file rather than as a separate model
  - Location: `src/app/core/services/scene-asset.service.ts`
  - Pattern: Types defined alongside service implementation, not in `src/app/core/models/`
- **Demo feature folder status**: `src/app/features/demo/` folder does not yet exist—will require creation
  - Existing feature: `src/app/features/hero/` provides organizational reference pattern
- **State store load state pattern**: FusionStoreService uses `setLoadState({status, error})` method for managing load state transitions
  - Pattern: State object with `status` field (loading/ready/failed) and optional `error` field
- **Integration spec requirements**: Demo-shell component will need deterministic loading→ready/failed orchestration with integration spec testing both success and failure branches

**Code Example**:
```typescript
// Service test pattern - direct class instantiation
describe('SceneAssetService', () => {
  let service: SceneAssetService;
  
  beforeEach(() => {
    service = new SceneAssetService();
  });
  
  it('should handle asset loading', () => {
    // Test without TestBed
  });
});

// LoadEvent inline type pattern
export type LoadEvent = 'loading' | 'ready' | 'failed';

// State store load state pattern
setLoadState(state: { status: LoadEvent; error?: string }): void {
  this.state.update(s => ({ ...s, loadState: state }));
}
```

**Additional Context**:
- Demo-shell component implementation should follow hero component organizational pattern: component.ts, component.html, component.scss, component.spec.ts
- Integration spec must test deterministic loading orchestration with both success (loading→ready) and failure (loading→failed) branches
- Test pattern consistency: new specs should use direct class instantiation without TestBed to match existing service test patterns
- LoadEvent type definition location establishes precedent: domain-specific types may be co-located with services rather than extracted to separate model files

---

## Controls Panel and Metrics Panel Implementation (UOW-07)

**Discovered by**: software_engineer during UOW-07  
**Date**: 2025-02-15  
**Files**:
- `src/app/features/demo/controls-panel.component.ts`
- `src/app/features/demo/controls-panel.component.html`
- `src/app/features/demo/controls-panel.component.spec.ts`
- `src/app/features/demo/metrics-panel.component.ts`
- `src/app/features/demo/metrics-panel.component.html`
- `src/app/features/demo/metrics-panel.component.spec.ts`

**Pattern**: Standalone Angular components in demo feature folder with file-based Vitest specs; controls delegate mode changes to FusionStoreService with computed property guards; metrics bind to METRIC_CONSTANTS.dashboard.

**Implementation Details**:
- **Component organization**: Both components created in `src/app/features/demo/` following established feature module organization pattern
- **Standalone components**: ControlsPanelComponent and MetricsPanelComponent implemented as standalone Angular components
- **Test pattern**: File-based Vitest specs using `.spec.ts` files (consistent with service test patterns established in UOW-06)
- **Controls template structure**:
  - Explicit radio options for all 4 fusion modes: `single_agent`, `naive_fusion`, `vogs`, `ground_truth`
  - Representation radios use `[disabled]="isGroundTruthMode"` attribute binding
  - isGroundTruthMode is a computed getter that gates representation control disabled state
- **State delegation**: ControlsPanelComponent delegates mode changes to FusionStoreService (does not manage state internally)
- **Metrics binding**: MetricsPanelComponent exposes `METRIC_CONSTANTS.dashboard` as `dashboardMetrics` property for template binding
- **Metrics scope**: Metrics panel does NOT use hero metrics (only dashboard metrics from METRIC_CONSTANTS)
- **Test environment**: Focused Vitest tests pass when run with `--environment node` flag
- **Build status**: 
  - Lint passes for both components
  - Default `npm test` currently blocked by missing jsdom dependency in environment
  - `npm build` blocked by missing `@angular-devkit/build-angular:application` builder package

**Code Example**:
```typescript
// ControlsPanelComponent - state delegation and computed guard
export class ControlsPanelComponent {
  constructor(private fusionStore: FusionStoreService) {}
  
  get isGroundTruthMode(): boolean {
    return this.fusionStore.fusionMode() === 'ground_truth';
  }
  
  onFusionModeChange(mode: FusionMode): void {
    this.fusionStore.setFusionMode(mode);
  }
  
  onRepresentationModeChange(mode: RepresentationMode): void {
    this.fusionStore.setRepresentationMode(mode);
  }
}

// Controls template - explicit radio options with disabled binding
<input type="radio" name="fusionMode" value="single_agent" />
<input type="radio" name="fusionMode" value="naive_fusion" />
<input type="radio" name="fusionMode" value="vogs" />
<input type="radio" name="fusionMode" value="ground_truth" />

<input type="radio" name="representation" value="occupancy" [disabled]="isGroundTruthMode" />
<input type="radio" name="representation" value="gaussian" [disabled]="isGroundTruthMode" />

// MetricsPanelComponent - METRIC_CONSTANTS binding
export class MetricsPanelComponent {
  readonly dashboardMetrics = METRIC_CONSTANTS.dashboard;
}
```

**Additional Context**:
- Demo feature folder now populated with controls and metrics panel components
- Established pattern: UI control components delegate state changes to services rather than managing state internally
- Computed property guard pattern: Use getters to derive UI state from service signals (isGroundTruthMode from fusionStore.fusionMode())
- Template attribute binding: Use Angular property binding syntax `[disabled]="condition"` for computed UI states
- Metrics constants organization: METRIC_CONSTANTS defines separate scopes (dashboard vs. hero) for different feature areas
- Build dependencies still need resolution for full build verification

---

## Runtime DI and TestBed Patterns for Standalone Components (UOW-07 Revision #2)

**Discovered by**: software_engineer during UOW-07 revision attempt #2  
**Date**: 2025-02-15  
**Files**:
- `src/app/features/demo/controls-panel.component.ts`
- `src/app/features/demo/metrics-panel.component.ts`
- `src/app/features/demo/controls-panel.component.spec.ts`
- `src/app/features/demo/metrics-panel.component.spec.ts`
- `package.json`

**Pattern**: Standalone Angular components use runtime DI via `inject()` function instead of constructor injection; component specs use TestBed pattern with `ComponentFixture`; styleUrls must be arrays.

**Implementation Details**:
- **Runtime DI pattern**: Standalone components use `inject()` function for dependency injection
  - Pattern: `private fusionStore = inject(FusionStoreService);` in component class body
  - No constructor injection for standalone components (evaluator-requested fix)
- **Component spec pattern**: Use TestBed.configureTestingModule() with ComponentFixture for component tests
  - Pattern: `TestBed.configureTestingModule({ imports: [ComponentClass] })` then `createComponent()`
  - Use `fixture.detectChanges()` for change detection in tests
  - Access component instance via `fixture.componentInstance`
  - Query DOM elements via `fixture.nativeElement.querySelector()`
- **styleUrls array pattern**: Component metadata requires styleUrls as array, not single string
  - Pattern: `styleUrls: ['./component.component.scss']` (array with single string)
  - NOT: `styleUrl: './component.component.scss'` (single string property)
- **jsdom devDependency**: Added `jsdom@^25.0.1` to devDependencies for default Vitest environment
  - Resolves prior need for `--environment node` flag in test runs
- **Quality gates passed**: All verification gates passed after fixes
  - `npm run lint` - ESLint pass
  - `npm run test` - Vitest pass (default environment, no flags required)

**Code Example**:
```typescript
// Runtime DI pattern for standalone components
import { inject } from '@angular/core';

@Component({
  selector: 'app-controls-panel',
  standalone: true,
  imports: [],
  templateUrl: './controls-panel.component.html',
  styleUrls: ['./controls-panel.component.scss'] // Array, not single string
})
export class ControlsPanelComponent {
  // Runtime DI via inject() - no constructor injection
  private fusionStore = inject(FusionStoreService);
  
  get isGroundTruthMode(): boolean {
    return this.fusionStore.fusionMode() === 'ground_truth';
  }
}

// TestBed-based component spec pattern
describe('ControlsPanelComponent', () => {
  let fixture: ComponentFixture<ControlsPanelComponent>;
  let component: ControlsPanelComponent;
  
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ControlsPanelComponent] // Standalone component in imports
    });
    fixture = TestBed.createComponent(ControlsPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // Trigger change detection
  });
  
  it('should disable representation radios in ground_truth mode', () => {
    // Query DOM via fixture.nativeElement
    const radios = fixture.nativeElement.querySelectorAll('input[name="representation"]');
    expect(radios[0].disabled).toBe(true);
  });
});
```

**Additional Context**:
- Runtime DI via `inject()` is the Angular standalone component pattern (not constructor injection)
- TestBed pattern for component specs differs from service specs (which use direct class instantiation)
- Component test pattern: TestBed + ComponentFixture for component tests; direct instantiation for service tests
- styleUrls metadata property expects array syntax regardless of single or multiple stylesheets
- jsdom devDependency resolution allows default Vitest environment without `--environment node` flag
- Evaluator-requested pattern conformance: runtime DI, TestBed specs, styleUrls arrays

---

## SceneAssetService Retry API Pattern
- **Discovered by**: software_engineer
- **Date**: 2026-02-15
- **Context**: UOW-08 implementation exploration
- **Files**: `src/app/core/services/scene-asset.service.ts`
- **Pattern**: SceneAssetService exposes `retryLast(): Observable<LoadEvent>` for retry functionality
- **Code Example**:
```typescript
// SceneAssetService retry method signature
retryLast(): Observable<LoadEvent>
```
- **Additional Context**: Used for error overlay retry button implementation

## Focus Trap Implementation Status
- **Discovered by**: software_engineer
- **Date**: 2026-02-15
- **Context**: UOW-08 implementation exploration
- **Finding**: No existing focus trap implementation in codebase
- **Dependency Status**: No @angular/cdk dependency found; no cdkTrapFocus usage
- **Implication**: Custom focus trap implementation needed within error overlay scope
- **Files Searched**: Entire codebase via grep for focus trap patterns

## Demo Feature Module Organization
- **Discovered by**: software_engineer
- **Date**: 2026-02-15
- **Context**: UOW-08 implementation exploration
- **Location**: `src/app/features/demo/`
- **Files**:
  - `demo-shell.component.ts`
  - `controls-panel.component.ts`
  - `metrics-panel.component.spec.ts`
- **Pattern**: Demo components use Angular standalone pattern with Vitest + TestBed for component tests
- **Code Pattern**:
```typescript
// Component test pattern with TestBed
describe('ComponentName', () => {
  let fixture: ComponentFixture<ComponentName>;
  let component: ComponentName;
  
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ComponentName] // Standalone component in imports
    });
    fixture = TestBed.createComponent(ComponentName);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  
  it('should test something', () => {
    // Class-level assertions via component instance
    expect(component.someProperty).toBe(expectedValue);
  });
});
```
- **Additional Context**: Component tests use BrowserTestingModule with TestBed, often include class-level assertions via component instance

## Diff Constraints for UOW-08
- **Discovered by**: software_engineer
- **Date**: 2026-02-15
- **Context**: UOW-08 implementation exploration
- **Finding**: Implementation should follow existing patterns found in demo components
- **Patterns to Follow**:
  - Angular standalone components
  - Runtime DI via `inject()`
  - Vitest + TestBed for component tests
  - Component metadata with styleUrls as array
  - Class-level assertions in tests



## Diagnostics Service Type-Safety Patterns
- **Discovered by**: software_engineer
- **Date**: 2026-02-15
- **Context**: UOW-10 revision attempt #2 - type-safety fixes for strict TypeScript compliance
- **Files**: 
  - `src/app/core/services/diagnostics.service.ts`
  - `src/app/core/services/diagnostics.service.spec.ts`
- **Pattern**: Type-only corrections to satisfy strict tsc with no behavior changes
- **Code Patterns**:
  - `sanitize()` method accesses event via `unknown -> Record<string, unknown>` for type-safe property access
  - Test specs use typed write spy target with tuple args for type-safe `mock.calls` indexing
- **Validation**: Passed all checks - `npx tsc --noEmit`, `npm run lint`, and `npx vitest run src/app/core/services/diagnostics.service.spec.ts`
- **Type-Safety Approach**: Two-step type narrowing (unknown  Record<string, unknown>) prevents unsafe property access while maintaining runtime behavior
- **Testing Pattern**: Typed spy targets with tuple type annotations enable safe mock.calls array indexing in strict mode
## UOW-12 E2E Testing, Accessibility, and Ground Truth Patterns
- **Discovered by**: software_engineer
- **Date**: 2026-02-15
- **Context**: UOW-12 implementation exploration for AC flow, accessibility, and ground_truth behavior
- **Files**:
  - `e2e/demo-flow.spec.ts`
  - `src/app/features/demo/demo-shell.component.spec.ts`
  - `src/app/features/demo/error-overlay.component.ts`
  - `src/app/features/demo/controls-panel.component.html`
  - `src/app/features/hero/hero-section.component.html`
  - `playwright.config.ts`
- **E2E Testing Pattern**: 
  - Playwright tests use vitest guard: `if (typeof vitestMarker === "undefined") { test(...) }`
  - Prevents Playwright specs from being picked up by Vitest runner
- **State Transition Patterns**:
  - Loading  Ready: `["loading","ready"]`
  - Loading  Failed: `["loading","failed"]`
  - Defined in `demo-shell.component.spec.ts`
- **Error Overlay Accessibility Pattern**:
  - Role: `role="dialog"`
  - Modal: `aria-modal="true"`
  - Labeling: `aria-labelledby="error-overlay-title"`
  - Focusable: `tabindex="-1"`
  - Focus trap on Tab key
  - Focus restore behavior on close
- **Ground Truth Mode Behavior**:
  - Representation radio buttons disabled when `isGroundTruthMode` is true
  - Pattern: `[disabled]="isGroundTruthMode"` in controls-panel.component.html
- **Accessibility Testing Approach**:
  - No axe dependency present in repo
  - Use built-in Playwright assertions:
    - Role assertions
    - ARIA attribute checks
    - Keyboard/focus behavior validation
    - Computed color contrast checks
  - Baseline should be implemented without third-party accessibility libraries

## QA Findings for Change 001
- **Reported by**: QA Agent
- **Date**: 2026-02-15
- **Context**: Change ID 001 - QA validation findings
- **Original Query**: What patterns should I validate and what pitfalls exist?
- **Summary**: Vitest/lint/check pass, but Playwright runtime fails (missing Chromium binary), Angular build fails due missing @angular-devkit/build-angular package, and Purdue Black/Gold branding evidence is absent in component styles.
- **Validation Pattern**: Use npm run check + npm run e2e + npm run build; then verify AC4 metrics constants and AC5 branding tokens in SCSS/HTML.
- **Additional Context**: AC2/AC3 behavior currently only represented by test harness logic in e2e/demo-flow.spec.ts; runtime browser execution unavailable in this environment due missing Playwright browser installation.
- **Findings**:
  -  Vitest tests pass
  -  Lint checks pass
  -  TypeScript check passes
  -  Playwright runtime fails (missing Chromium binary)
  -  Angular build fails (missing @angular-devkit/build-angular package)
  - ❌ Purdue Black/Gold branding evidence absent in component styles

## REM-001 Remediation Target Files and Patterns (E1-E4)
- **Discovered by**: Exploration Agent
- **Date**: 2026-02-15
- **Context**: REM-001 remediation discovery - confirmed file locations, assertion patterns, and constraints for E1-E4
- **Files**:
  - `package.json`
  - `playwright.config.ts`
  - `src/app/features/hero/hero-section.component.scss`
  - `src/app/features/demo/controls-panel.component.scss`
  - `src/app/features/demo/metrics-panel.component.scss`
  - `e2e/demo-flow.spec.ts`
- **Pattern**: Playwright e2e specs use vitest guard pattern; assertions use `expect(...).toHaveText/toBeVisible/toBeHidden/toHaveAttribute`
- **Branding Context**: Purdue colors absent before remediation; only neutral gray borders (#d1d5db/#d4d4d8) existed in hero/controls/metrics SCSS
- **Constraints**: In this remediation context, lockfile changes are explicitly disallowed by task constraints
- **Code Pattern**:
```typescript
// E2E assertion pattern
if (typeof vitestMarker === "undefined") {
  test('should display hero section', async ({ page }) => {
    await expect(page.locator('[data-test-id="hero-title"]')).toBeVisible();
    await expect(page.locator('[data-test-id="hero-title"]')).toHaveText('Expected Text');
  });
}
```
- **SCSS Pattern**:
```scss
// Pre-remediation neutral borders only
.component-wrapper {
  border: 1px solid #d1d5db;  // or #d4d4d8
}
```

## REM-002 Remediation Target Files and Blockers
- **Discovered by**: Exploration Agent
- **Date**: 2026-02-16
- **Context**: Change ID 001 - REM-002 remediation discovery (Angular bootstrap and DI injection token fixes)
- **Original Query**: "Change ID 001, remediation UOW REM-002 artifacts and implementation targets"
- **Summary**: REM-002 is not pre-authored in planning artifacts; remediation inputs come from feedback/remediation_uows.json blockers. Target fixes are in Angular bootstrap inputs and DI compile tokens.
- **Artifact Paths**:
  - `C:/Users/jmckerra/ObsidianNotes/Main/01-Projects/Demo-Gaussian-Splat/orchestrated-agent-work/001/feedback/remediation_uows.json`
  - `C:/Users/jmckerra/ObsidianNotes/Main/01-Projects/Demo-Gaussian-Splat/orchestrated-agent-work/001/logs/orchestrator/20260216_032919_agent_dispatch_remediation_uow.json`
- **Blocker Evidence**:
  - Missing `src/main.ts` (Angular bootstrap entry point)
  - Missing `src/index.html` (Angular bootstrap template)
  - Missing `src/styles.css` (global styles)
  - `renderer-adapter.service.ts` injection token compile error
  - `demo-shell.component.ts` type-only import injection token compile error
- **Target Code Paths**:
  - `src/app/core/services/renderer-adapter.service.ts`
  - `src/app/features/demo/demo-shell.component.ts`
  - `angular.json` (bootstrap configuration)
- **Additional Context**: REM-001 branding/e2e fixes are in hero/control/metrics SCSS and e2e/playwright files and should be preserved unchanged.
- **Pattern**: DI injection token errors indicate type-only imports being used where runtime tokens are required for Angular dependency injection.

## QA Findings for Change 001 - Attempt #2 (Post-Remediation)
- **Reported by**: QA Agent
- **Date**: 2026-02-15
- **Context**: Change ID 001 - Post-remediation validation (attempt #2)
- **Original Query**: What standards/patterns and prior failures should I validate against for attempt #2?
- **Summary**: Post-remediation full gate execution succeeded: lint, test, build, e2e, and check all exit 0.
- **Validation Pattern**: Use gate summary JSON + console logs + targeted source assertions (e2e mode visibility test, metrics constants, Purdue tokenized SCSS) to map AC1-AC5.
- **Additional Context**: E2E now runs 6 tests and includes explicit assertion that single_agent hides occluded vehicle and VOGS reveals it. Branding tokens present in hero/controls/metrics SCSS using Purdue black/gold variables.
- **Findings**:
  -  npm run lint passes (exit 0)
  -  npm run test passes (exit 0)
  -  npm run check passes (exit 0)
  -  npm run build passes (exit 0)
  -  npm run e2e passes (exit 0, 6 tests)
  -  E2E assertions validate AC2/AC3: single_agent mode hides occluded vehicle, VOGS reveals it
  -  Purdue Black/Gold branding tokens present in hero/controls/metrics SCSS
  -  Metrics constants aligned with AC4
  -  All acceptance criteria AC1-AC5 validated
- **Reusable Pattern**: Full gate validation using JSON summary + targeted source file assertions enables mapping acceptance criteria to implementation without browser runtime requirement.


## UI/UX Standards - Hero/Controls/Metrics Components (Change 001)
- **Reported by**: UI QA Agent
- **Date**: 2026-02-15
- **Context**: Change ID 001 - UI/component styling and behavior standards discovery
- **Original Query**: Provide UI/component styling and behavior standards for hero/controls/metrics/error-overlay/viewport
- **Summary**: Greenfield baseline established from live app render. Hero, controls, and metrics components consistently use Purdue black/gold tokenized styling. Behavior and style consistency discrepancies identified.
- **Styling Standards**:
  - **Purdue Branding**: All hero/controls/metrics components use tokenized Purdue black/gold styling
  - **Border Color**: rgb(207,185,145) applied consistently across .hero-button, .control-group, and .metric-card
  - **Style Pattern**: Project standard is styleUrls array (controls/metrics follow this)
- **Behavior Discrepancy**:
  - **Issue**: View Demo button in live app does not focus #demo-section (INT-002 fail)
  - **Expected**: e2e demo-flow harness contract expects focus transition on click
  - **Impact**: Integration test failure, UX expectation mismatch
- **Style Consistency Discrepancy**:
  - **Issue**: hero-section.component.ts uses styleUrl (string) instead of styleUrls (array)
  - **Expected**: Project pattern is styleUrls array (used by controls/metrics)
  - **Files**: 
    - Non-standard: src/app/features/hero/hero-section.component.ts (styleUrl string)
    - Standard: controls and metrics components (styleUrls array)
- **Overlay/Viewport**:
  - Not mounted in app root for direct live visual comparison
  - Behavior validated via Playwright demo-flow harness traces
- **Artifact References**:
  - orchestrated-agent-work/001/qa/ui_qa_report.yaml
  - orchestrated-agent-work/001/qa/evidence/ui/*
- **Reusable Pattern**: Live app render captures combined with e2e harness traces provide complete baseline for greenfield UI/UX standards when components aren't yet mounted in production routes.

---

## UI/Component Standards - Verification (Change 001)
- **Reported by**: UI QA Agent (Attempt 2)
- **Date**: 2026-02-15
- **Context**: Verification of corrected implementations after initial discrepancies identified
- **Original Query**: What are the UI/component styling standards and pitfalls for change 001?
- **Findings**:
  - **styleUrls Pattern Verified**: `hero-section.component.ts` now correctly uses `styleUrls: ['./hero-section.component.scss']` array pattern
    - Aligns with controls-panel and metrics-panel components
    - Codebase-wide consistency achieved
  - **Focus Management Verified**: "View Demo" button correctly sets focus to `#demo-section` on click
    - Resolves INT-002 integration test failure
    - UX expectation contract fulfilled
  - **Error Overlay States Validated** (UI-004): All dialog states properly implemented
    - Visible state: overlay displays with error message
    - Focus state: error message receives focus on mount
    - Tab-trap state: keyboard navigation confined to overlay
    - Retry/hide actions: both correctly dismiss overlay
  - **QA Validation Methodology**: Same-type baseline comparisons used
    - Control-group vs control-group styling comparisons
    - Viewport/overlay state vs same element state comparisons
    - Ensures accurate validation without type-mismatch false positives
- **Pattern Confirmation**: Component styling follows `styleUrls: ['./component.component.scss']` array pattern across all Angular components
- **Artifact References**: 
  - orchestrated-agent-work/001/qa/ (verification report and evidence)

