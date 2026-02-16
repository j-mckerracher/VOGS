import {
  Component,
  viewChild
} from "@angular/core";
import type { ElementRef, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  GridHelper,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  TextureLoader,
  WebGLRenderer,
  AmbientLight,
  PlaneGeometry,
  MeshBasicMaterial,
  DoubleSide,
  type Texture
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { SceneDataService } from "../../core/services/scene-data.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { FusionStoreService } from "../../core/services/fusion-store.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { DiagnosticsService } from "../../core/services/diagnostics.service";
import { environment } from "../../core/config/environment";

const LOG_PREFIX = "[SceneViewerComponent]";
const CAMERA_LABELS = ["Front", "Front-Left", "Front-Right", "Rear-Left", "Rear-Right"];

// Semantic palette from PRD
const SEMANTIC_COLORS = {
  road: 0x800080,
  vegetation: 0x00aa00,
  vehicle: 0xff0000,
  vehicleRevealed: 0x00ff88,
  grid: 0x444444,
  ground: 0x1a1a1a
} as const;

@Component({
  selector: "app-scene-viewer",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="scene-viewer-container">
      <div class="loading-status" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>{{ loadingMessage }}</p>
      </div>
      <div class="error-status" *ngIf="errorMessage">
        <p class="error-text">{{ errorMessage }}</p>
        <button type="button" class="retry-btn" (click)="onRetry()">Retry</button>
      </div>
      <div class="viewport-3d" [class.hidden]="isLoading || !!errorMessage">
        <canvas #viewportCanvas class="viewport-canvas" aria-label="3D scene viewport"></canvas>
      </div>
      <div class="camera-strip" *ngIf="!isLoading && !errorMessage">
        <div class="camera-view" *ngFor="let img of currentFrameImages; let i = index">
          <img
            [src]="img"
            [alt]="getCameraLabel(i)"
            class="camera-thumbnail"
            loading="lazy"
            (error)="onImageError(i)"
          />
          <span class="camera-label">{{ getCameraLabel(i) }}</span>
        </div>
      </div>
      <div class="frame-controls" *ngIf="!isLoading && !errorMessage">
        <button type="button" (click)="previousFrame()" [disabled]="currentFrame <= 0">&larr;</button>
        <input
          type="range"
          [min]="0"
          [max]="totalFrames - 1"
          [value]="currentFrame"
          (input)="onFrameSliderChange($event)"
          aria-label="Frame timeline"
        />
        <button type="button" (click)="nextFrame()" [disabled]="currentFrame >= totalFrames - 1">&rarr;</button>
        <span class="frame-label">Frame {{ currentFrame }} / {{ totalFrames - 1 }}</span>
        <button type="button" (click)="togglePlayback()" class="play-btn">
          {{ isPlaying ? '⏸' : '▶' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --purdue-black: #000000;
      --purdue-gold: #cfb991;
      --purdue-gold-dark: #9d7a2e;
    }
    .scene-viewer-container {
      background: #1a1a1a;
      border-radius: 0.5rem;
      overflow: hidden;
      position: relative;
    }
    .loading-status, .error-status {
      align-items: center;
      color: var(--purdue-gold);
      display: flex;
      flex-direction: column;
      gap: 1rem;
      justify-content: center;
      min-height: 400px;
      padding: 2rem;
    }
    .error-text {
      color: #ff6b6b;
      font-weight: 600;
      text-align: center;
    }
    .retry-btn {
      background: var(--purdue-black);
      border: 1px solid var(--purdue-gold);
      border-radius: 0.375rem;
      color: var(--purdue-gold);
      cursor: pointer;
      padding: 0.5rem 1.25rem;
    }
    .spinner {
      animation: spin 1s linear infinite;
      border: 3px solid #333;
      border-radius: 50%;
      border-top-color: var(--purdue-gold);
      height: 2rem;
      width: 2rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .viewport-3d {
      aspect-ratio: 16/9;
      position: relative;
      width: 100%;
    }
    .viewport-3d.hidden { display: none; }
    .viewport-canvas {
      display: block;
      height: 100%;
      width: 100%;
    }
    .camera-strip {
      display: flex;
      gap: 0.25rem;
      overflow-x: auto;
      padding: 0.5rem;
    }
    .camera-view {
      flex: 0 0 auto;
      position: relative;
      width: 19%;
    }
    .camera-thumbnail {
      border: 1px solid #333;
      border-radius: 0.25rem;
      display: block;
      height: auto;
      width: 100%;
    }
    .camera-label {
      background: rgba(0,0,0,0.7);
      bottom: 0;
      color: var(--purdue-gold);
      font-size: 0.6rem;
      left: 0;
      padding: 0.125rem 0.25rem;
      position: absolute;
    }
    .frame-controls {
      align-items: center;
      background: #111;
      display: flex;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
    }
    .frame-controls button {
      background: var(--purdue-black);
      border: 1px solid #444;
      border-radius: 0.25rem;
      color: var(--purdue-gold);
      cursor: pointer;
      font-size: 1rem;
      padding: 0.25rem 0.5rem;
    }
    .frame-controls button:disabled {
      cursor: default;
      opacity: 0.3;
    }
    .frame-controls input[type="range"] {
      accent-color: var(--purdue-gold);
      flex: 1;
    }
    .frame-label {
      color: #aaa;
      font-size: 0.75rem;
      white-space: nowrap;
    }
    .play-btn { font-size: 1.1rem !important; }
  `]
})
export class SceneViewerComponent implements OnInit, OnDestroy {
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>("viewportCanvas");

  isLoading = true;
  loadingMessage = "Connecting to CloudFront...";
  errorMessage: string | null = null;
  currentFrame = 0;
  totalFrames = 0;
  currentFrameImages: string[] = [];
  isPlaying = false;

  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private animationFrameId = 0;
  private playbackInterval: ReturnType<typeof setInterval> | null = null;
  private vehicleMesh: Mesh | null = null;
  private textureLoader = new TextureLoader();
  private frontCameraPlane: Mesh | null = null;

  constructor(
    // eslint-disable-next-line no-unused-vars -- Angular DI constructor parameter property
    private readonly sceneDataService: SceneDataService,
    // eslint-disable-next-line no-unused-vars -- Angular DI constructor parameter property
    private readonly fusionStore: FusionStoreService,
    // eslint-disable-next-line no-unused-vars -- Angular DI constructor parameter property
    private readonly diagnostics: DiagnosticsService
  ) {}

  ngOnInit(): void {
    console.log(LOG_PREFIX, "Initializing scene viewer");
    void this.initScene();
  }

  ngOnDestroy(): void {
    console.log(LOG_PREFIX, "Destroying scene viewer");
    this.stopPlayback();
    this.disposeRenderer();
  }

  getCameraLabel(index: number): string {
    return CAMERA_LABELS[index] ?? `Camera ${index}`;
  }

  previousFrame(): void {
    if (this.currentFrame > 0) {
      this.setFrame(this.currentFrame - 1);
    }
  }

  nextFrame(): void {
    if (this.currentFrame < this.totalFrames - 1) {
      this.setFrame(this.currentFrame + 1);
    }
  }

  onFrameSliderChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.setFrame(Number(target.value));
  }

  togglePlayback(): void {
    if (this.isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  onRetry(): void {
    this.errorMessage = null;
    this.isLoading = true;
    void this.initScene();
  }

  onImageError(camIndex: number): void {
    console.warn(LOG_PREFIX, `Failed to load camera ${camIndex} image for frame ${this.currentFrame}`);
  }

  private async initScene(): Promise<void> {
    try {
      this.loadingMessage = "Loading scene data from S3...";
      console.log(LOG_PREFIX, "Fetching scene data from CloudFront");
      this.diagnostics.logAssetLoadStart(environment.sceneId);
      const startMs = performance.now();

      const sceneData = await this.sceneDataService.loadSceneData();
      this.totalFrames = sceneData.totalFrames;
      console.log(LOG_PREFIX, `Scene data loaded: ${sceneData.totalFrames} frames`);

      this.loadingMessage = "Initializing 3D renderer...";
      this.initThreeJs();

      this.loadingMessage = "Loading first frame...";
      this.setFrame(0);

      const durationMs = Math.round(performance.now() - startMs);
      this.diagnostics.logAssetLoadSuccess(environment.sceneId, durationMs);
      console.log(LOG_PREFIX, `Scene ready in ${durationMs}ms`);

      this.fusionStore.setLoadState({ status: "ready", error: null });
      this.isLoading = false;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error loading scene";
      console.error(LOG_PREFIX, "Scene load failed:", msg);
      this.diagnostics.logAssetLoadFailed(
        environment.sceneId,
        0,
        "SCENE_DATA_LOAD_ERROR"
      );
      this.fusionStore.setLoadState({
        status: "failed",
        error: { code: "SCENE_DATA_LOAD_ERROR", message: msg }
      });
      this.errorMessage = "Unable to retrieve 3D scene data. Please check your connection or try again later.";
      this.isLoading = false;
    }
  }

  private initThreeJs(): void {
    const canvasRef = this.canvas();
    if (!canvasRef) {
      console.error(LOG_PREFIX, "Canvas element not found");
      return;
    }

    const canvas = canvasRef.nativeElement;
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 450;

    console.log(LOG_PREFIX, `Creating Three.js renderer: ${width}x${height}`);

    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
    this.renderer.setClearColor(new Color(SEMANTIC_COLORS.ground));

    this.scene = new Scene();

    this.camera = new PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 8, 15);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 50;

    // Ambient light
    this.scene.add(new AmbientLight(0xffffff, 0.5));

    // Directional light
    const dirLight = new DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    this.scene.add(dirLight);

    // Ground grid
    const grid = new GridHelper(40, 40, SEMANTIC_COLORS.grid, 0x222222);
    this.scene.add(grid);

    // Road surface (purple as per PRD semantics)
    const roadGeo = new PlaneGeometry(12, 40);
    const roadMat = new MeshLambertMaterial({ color: SEMANTIC_COLORS.road, transparent: true, opacity: 0.3 });
    const road = new Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    this.scene.add(road);

    // Cross road (T-intersection)
    const crossRoadGeo = new PlaneGeometry(40, 8);
    const crossRoad = new Mesh(crossRoadGeo, roadMat.clone());
    crossRoad.rotation.x = -Math.PI / 2;
    crossRoad.position.set(0, 0.01, -10);
    this.scene.add(crossRoad);

    // Vegetation blocks
    const vegMat = new MeshLambertMaterial({ color: SEMANTIC_COLORS.vegetation });
    const vegPositions = [
      [-10, 1.5, -5], [10, 1.5, -5], [-10, 1.5, -15], [10, 1.5, -15],
      [-10, 1, 5], [10, 1, 5]
    ];
    for (const [x, y, z] of vegPositions) {
      const vegGeo = new BoxGeometry(4, y * 2, 4);
      const veg = new Mesh(vegGeo, vegMat);
      veg.position.set(x, y, z);
      this.scene.add(veg);
    }

    // Ego vehicle (blue box)
    const egoGeo = new BoxGeometry(2, 1.2, 4);
    const egoMat = new MeshLambertMaterial({ color: 0x4488ff });
    const ego = new Mesh(egoGeo, egoMat);
    ego.position.set(0, 0.6, 8);
    this.scene.add(ego);

    // Occluded vehicle — visibility controlled by fusion mode
    const hiddenVehicleGeo = new BoxGeometry(2, 1.2, 4);
    const hiddenVehicleMat = new MeshLambertMaterial({ color: SEMANTIC_COLORS.vehicle });
    this.vehicleMesh = new Mesh(hiddenVehicleGeo, hiddenVehicleMat);
    this.vehicleMesh.position.set(-8, 0.6, -10);
    this.vehicleMesh.visible = false;
    this.scene.add(this.vehicleMesh);

    // Front camera image plane (shows the loaded front camera image)
    const imgPlaneGeo = new PlaneGeometry(16, 9);
    const imgPlaneMat = new MeshBasicMaterial({ color: 0x333333, side: DoubleSide });
    this.frontCameraPlane = new Mesh(imgPlaneGeo, imgPlaneMat);
    this.frontCameraPlane.position.set(0, 12, -18);
    this.scene.add(this.frontCameraPlane);

    // Start render loop
    this.renderLoop();

    // Observe window resize
    globalThis.addEventListener("resize", this.onResize);

    console.log(LOG_PREFIX, "Three.js scene initialized with T-intersection layout");
  }

  private setFrame(frame: number): void {
    this.currentFrame = frame;
    this.currentFrameImages = this.sceneDataService.getFrameImageUrls(frame);

    // Update the front camera texture on the 3D plane
    if (this.frontCameraPlane && this.currentFrameImages[0]) {
      this.textureLoader.load(
        this.currentFrameImages[0],
        (texture: Texture) => {
          if (this.frontCameraPlane) {
            const mat = this.frontCameraPlane.material as MeshBasicMaterial;
            mat.map?.dispose();
            mat.map = texture;
            mat.needsUpdate = true;
            mat.color.set(0xffffff);
          }
        },
        undefined,
        () => {
          console.warn(LOG_PREFIX, `Failed to load front camera texture for frame ${frame}`);
        }
      );
    }

    // Update vehicle visibility based on fusion mode
    this.updateFusionMode();
  }

  private updateFusionMode(): void {
    const mode = this.fusionStore.fusionMode();
    if (this.vehicleMesh) {
      const showOccluded = mode === "vogs" || mode === "ground_truth" || mode === "naive_fusion";
      this.vehicleMesh.visible = showOccluded;

      const mat = this.vehicleMesh.material as MeshLambertMaterial;
      if (mode === "vogs") {
        mat.color.set(SEMANTIC_COLORS.vehicleRevealed);
        mat.opacity = 1;
        mat.transparent = false;
      } else if (mode === "ground_truth") {
        mat.color.set(SEMANTIC_COLORS.vehicle);
        mat.opacity = 1;
        mat.transparent = false;
      } else if (mode === "naive_fusion") {
        mat.color.set(SEMANTIC_COLORS.vehicle);
        mat.opacity = 0.5;
        mat.transparent = true;
      }
    }
  }

  private renderLoop = (): void => {
    this.animationFrameId = globalThis.requestAnimationFrame(this.renderLoop);
    this.controls?.update();
    this.updateFusionMode();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  private readonly onResize = (): void => {
    const canvasRef = this.canvas();
    if (!canvasRef || !this.renderer || !this.camera) return;
    const canvas = canvasRef.nativeElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width > 0 && height > 0) {
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  };

  private startPlayback(): void {
    this.isPlaying = true;
    this.playbackInterval = setInterval(() => {
      if (this.currentFrame >= this.totalFrames - 1) {
        this.setFrame(0);
      } else {
        this.setFrame(this.currentFrame + 1);
      }
    }, 100);
  }

  private stopPlayback(): void {
    this.isPlaying = false;
    if (this.playbackInterval !== null) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
  }

  private disposeRenderer(): void {
    globalThis.removeEventListener("resize", this.onResize);
    globalThis.cancelAnimationFrame(this.animationFrameId);
    this.controls?.dispose();
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
  }
}
