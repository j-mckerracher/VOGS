import {
  Component,
  viewChild
} from "@angular/core";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { ChangeDetectorRef } from "@angular/core";
import type { ElementRef, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  GridHelper,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  TextureLoader,
  WebGLRenderer,
  AmbientLight,
  PlaneGeometry,
  BoxGeometry,
  DoubleSide,
  ConeGeometry,
  Group,
  SphereGeometry,
  type Texture
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { SceneDataService } from "../../core/services/scene-data.service";
import type { SceneData, EgoPose, CameraCalibration } from "../../core/services/scene-data.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { FusionStoreService } from "../../core/services/fusion-store.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { DiagnosticsService } from "../../core/services/diagnostics.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { TrackVisibilityService } from "../../core/services/track-visibility.service";
import { environment } from "../../core/config/environment";

const LOG_PREFIX = "[SceneViewerComponent]";
const CAMERA_LABELS = ["Front", "Front-Left", "Front-Right", "Rear-Left", "Rear-Right"];

const COLORS = {
  trajectory: 0xcfb991,   // Purdue gold
  ego: 0x4488ff,
  ground: 0x111111,
  grid: 0x333333,
  frustum: [0xff4444, 0x44ff44, 0x4444ff, 0xffaa00, 0xff44ff], // per-camera
  detected: 0x00ff88,
  occluded: 0xff3333,
  billboard: 0xffffff
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
        <div class="progress-bar" *ngIf="loadProgress > 0">
          <div class="progress-fill" [style.width.%]="loadProgress * 100"></div>
        </div>
      </div>
      <div class="error-status" *ngIf="errorMessage">
        <p class="error-text">{{ errorMessage }}</p>
        <button type="button" class="retry-btn" (click)="onRetry()">Retry</button>
      </div>
      <div class="main-display" *ngIf="!isLoading && !errorMessage">
        <div class="viewport-3d">
          <canvas #viewportCanvas class="viewport-canvas" aria-label="3D scene viewport"></canvas>
          <div class="detection-overlay">
            <span class="detection-badge" [class.vogs]="currentFusionMode === 'vogs'">
              🎯 {{ detectedCount }} / {{ totalPresent }} objects
            </span>
            <span class="mode-badge">{{ fusionModeLabel }}</span>
          </div>
        </div>
        <div class="camera-strip">
          <div class="camera-view" *ngFor="let img of currentFrameImages; let i = index">
            <img
              [src]="img"
              [alt]="getCameraLabel(i)"
              class="camera-thumbnail"
              loading="lazy"
              (error)="onImageError(i)"
            />
            <span class="camera-label">{{ getCameraLabel(i) }}</span>
            <span class="track-badge" *ngIf="perCameraCounts[i] > 0">{{ perCameraCounts[i] }}</span>
          </div>
        </div>
        <div class="frame-controls">
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
    .error-text { color: #ff6b6b; font-weight: 600; text-align: center; }
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
    .progress-bar {
      background: #333;
      border-radius: 0.25rem;
      height: 4px;
      overflow: hidden;
      width: 200px;
    }
    .progress-fill {
      background: var(--purdue-gold);
      height: 100%;
      transition: width 0.3s;
    }
    .viewport-3d {
      aspect-ratio: 16/9;
      position: relative;
      width: 100%;
    }
    .viewport-canvas { display: block; height: 100%; width: 100%; }
    .detection-overlay {
      display: flex;
      gap: 0.5rem;
      left: 0.75rem;
      position: absolute;
      top: 0.75rem;
    }
    .detection-badge, .mode-badge {
      background: rgba(0,0,0,0.75);
      border-radius: 0.25rem;
      color: #fff;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.25rem 0.5rem;
    }
    .detection-badge.vogs { color: #00ff88; }
    .mode-badge { color: var(--purdue-gold); }
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
    .track-badge {
      background: #00ff88;
      border-radius: 50%;
      color: #000;
      font-size: 0.55rem;
      font-weight: 700;
      height: 1rem;
      line-height: 1rem;
      position: absolute;
      right: 2px;
      text-align: center;
      top: 2px;
      width: 1rem;
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
    .frame-controls button:disabled { cursor: default; opacity: 0.3; }
    .frame-controls input[type="range"] { accent-color: var(--purdue-gold); flex: 1; }
    .frame-label { color: #aaa; font-size: 0.75rem; white-space: nowrap; }
    .play-btn { font-size: 1.1rem !important; }
  `]
})
export class SceneViewerComponent implements OnInit, OnDestroy {
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>("viewportCanvas");

  isLoading = true;
  loadingMessage = "Connecting to CloudFront...";
  loadProgress = 0;
  errorMessage: string | null = null;
  currentFrame = 0;
  totalFrames = 0;
  currentFrameImages: string[] = [];
  isPlaying = false;
  detectedCount = 0;
  totalPresent = 0;
  currentFusionMode = "single_agent";
  perCameraCounts: number[] = [];

  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private animationFrameId = 0;
  private playbackInterval: ReturnType<typeof setInterval> | null = null;
  private textureLoader = new TextureLoader();
  private frontCameraPlane: Mesh | null = null;
  private egoMesh: Mesh | null = null;
  private egoGroup: Group | null = null;
  private sceneDataCache: SceneData | null = null;
  /** trackId → { mesh, worldX, worldZ } for each tracked object in the scene */
  private trackMeshes = new Map<number, { mesh: Mesh; worldX: number; worldZ: number }>();
  /** Shared geometry/materials for track markers */
  private trackGeoDetected: SphereGeometry | null = null;
  private trackMatDetected: MeshLambertMaterial | null = null;
  private trackMatOccluded: MeshLambertMaterial | null = null;

  constructor(
    // eslint-disable-next-line no-unused-vars -- Angular DI constructor parameter property
    private readonly sceneDataService: SceneDataService,
    // eslint-disable-next-line no-unused-vars -- Angular DI constructor parameter property
    private readonly fusionStore: FusionStoreService,
    // eslint-disable-next-line no-unused-vars -- Angular DI constructor parameter property
    private readonly diagnostics: DiagnosticsService,
    // eslint-disable-next-line no-unused-vars -- Angular DI constructor parameter property
    private readonly trackVisibility: TrackVisibilityService,
    // eslint-disable-next-line no-unused-vars -- Angular DI constructor parameter property
    private readonly cdr: ChangeDetectorRef
  ) {}

  get fusionModeLabel(): string {
    const labels: Record<string, string> = {
      single_agent: "Single Agent",
      naive_fusion: "Naive Fusion",
      vogs: "VOGS",
      ground_truth: "Ground Truth"
    };
    return labels[this.currentFusionMode] ?? this.currentFusionMode;
  }

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
    if (this.currentFrame > 0) this.setFrame(this.currentFrame - 1);
  }

  nextFrame(): void {
    if (this.currentFrame < this.totalFrames - 1) this.setFrame(this.currentFrame + 1);
  }

  onFrameSliderChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.setFrame(Number(target.value));
  }

  togglePlayback(): void {
    if (this.isPlaying) { this.stopPlayback(); } else { this.startPlayback(); }
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

      this.sceneDataService.onProgress = (fraction, message) => {
        this.loadProgress = fraction;
        this.loadingMessage = message;
      };

      const sceneData = await this.sceneDataService.loadSceneData();
      this.sceneDataCache = sceneData;
      this.totalFrames = sceneData.totalFrames;

      this.trackVisibility.initialize(
        sceneData.trackCameraVis,
        sceneData.trackIds.length,
        sceneData.totalFrames
      );

      console.log(LOG_PREFIX, `Scene data loaded: ${sceneData.totalFrames} frames, ${sceneData.egoPoses.length} poses, ${sceneData.cameraCalibrations.length} cams`);

      // Show the canvas first, then init Three.js (canvas is behind *ngIf="!isLoading")
      this.fusionStore.setLoadState({ status: "ready", error: null });
      this.isLoading = false;
      this.cdr.detectChanges();

      // Wait one microtask so Angular can create the canvas element
      await new Promise<void>((resolve) => { globalThis.setTimeout(resolve, 0); });

      this.initThreeJs(sceneData);
      this.setFrame(0);

      const durationMs = Math.round(performance.now() - startMs);
      this.diagnostics.logAssetLoadSuccess(environment.sceneId, durationMs);
      console.log(LOG_PREFIX, `Scene ready in ${durationMs}ms`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error loading scene";
      console.error(LOG_PREFIX, "Scene load failed:", msg);
      this.diagnostics.logAssetLoadFailed(environment.sceneId, 0, "SCENE_DATA_LOAD_ERROR");
      this.fusionStore.setLoadState({
        status: "failed",
        error: { code: "SCENE_DATA_LOAD_ERROR", message: msg }
      });
      this.errorMessage = "Unable to retrieve 3D scene data. Please check your connection or try again later.";
      this.isLoading = false;
    }
  }

  private initThreeJs(sceneData: SceneData): void {
    const canvasRef = this.canvas();
    if (!canvasRef) {
      console.error(LOG_PREFIX, "Canvas element not found");
      return;
    }

    const canvas = canvasRef.nativeElement;
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 450;

    console.log(LOG_PREFIX, `Creating Three.js renderer: ${width}x${height}`);

    // Renderer
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
    this.renderer.setClearColor(new Color(COLORS.ground));

    this.scene = new Scene();

    // Lights
    this.scene.add(new AmbientLight(0xffffff, 0.6));
    const dirLight = new DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    this.scene.add(dirLight);

    // Ground grid
    const trajectoryExtent = this.getTrajectoryExtent(sceneData.egoPoses);
    const gridSize = Math.max(trajectoryExtent.rangeX, trajectoryExtent.rangeY, 50) * 1.5;
    const grid = new GridHelper(gridSize, Math.floor(gridSize / 10), COLORS.grid, 0x1a1a1a);
    grid.position.set(trajectoryExtent.centerX, 0, trajectoryExtent.centerY);
    this.scene.add(grid);

    // Ground plane
    const groundGeo = new PlaneGeometry(gridSize, gridSize);
    const groundMat = new MeshLambertMaterial({ color: COLORS.ground });
    const ground = new Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(trajectoryExtent.centerX, -0.01, trajectoryExtent.centerY);
    this.scene.add(ground);

    // Ego trajectory path
    this.buildTrajectoryPath(sceneData.egoPoses);

    // Ego vehicle group (vehicle + frustums)
    this.egoGroup = new Group();
    this.scene.add(this.egoGroup);

    // Ego vehicle box
    const egoGeo = new BoxGeometry(2, 1.2, 4.5);
    const egoMat = new MeshLambertMaterial({ color: COLORS.ego });
    this.egoMesh = new Mesh(egoGeo, egoMat);
    this.egoMesh.position.y = 0.6;
    this.egoGroup.add(this.egoMesh);

    // Camera frustum cones
    this.buildCameraFrustums(sceneData.cameraCalibrations);

    // Tracked objects (other vehicles / pedestrians) — synthesized from visibility data
    this.buildTrackObjects(sceneData);

    // Front camera billboard (floating above the scene)
    const imgPlaneGeo = new PlaneGeometry(20, 11.25);
    const imgPlaneMat = new MeshBasicMaterial({ color: 0x222222, side: DoubleSide });
    this.frontCameraPlane = new Mesh(imgPlaneGeo, imgPlaneMat);
    this.frontCameraPlane.position.set(trajectoryExtent.centerX, 25, trajectoryExtent.centerY - 30);
    this.scene.add(this.frontCameraPlane);

    // Camera: bird's eye view, looking down at the trajectory
    this.camera = new PerspectiveCamera(50, width / height, 0.1, 2000);
    const camHeight = Math.max(trajectoryExtent.rangeX, 40) * 0.6;
    this.camera.position.set(trajectoryExtent.centerX, camHeight, trajectoryExtent.centerY + camHeight * 0.5);
    this.camera.lookAt(trajectoryExtent.centerX, 0, trajectoryExtent.centerY);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.target.set(trajectoryExtent.centerX, 0, trajectoryExtent.centerY);
    this.controls.minDistance = 10;
    this.controls.maxDistance = 500;
    this.controls.update();

    // Render loop
    this.renderLoop();
    globalThis.addEventListener("resize", this.onResize);

    console.log(LOG_PREFIX, `Three.js scene initialized — trajectory ${trajectoryExtent.rangeX.toFixed(0)}m × ${trajectoryExtent.rangeY.toFixed(0)}m`);
  }

  private buildTrajectoryPath(poses: EgoPose[]): void {
    if (!this.scene) return;
    const positions: number[] = [];
    for (const pose of poses) {
      positions.push(pose.x, 0.1, pose.y);
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const mat = new LineBasicMaterial({ color: COLORS.trajectory, linewidth: 2 });
    const line = new Line(geo, mat);
    this.scene.add(line);
  }

  private buildCameraFrustums(calibrations: CameraCalibration[]): void {
    if (!this.egoGroup) return;

    for (const cal of calibrations) {
      const frustumLength = 12;
      const halfAngle = cal.hfov / 2;
      const radius = frustumLength * Math.tan(halfAngle);
      const color = COLORS.frustum[cal.cameraIndex % COLORS.frustum.length];

      const coneGeo = new ConeGeometry(radius, frustumLength, 16, 1, true);
      const coneMat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.15, side: DoubleSide });
      const cone = new Mesh(coneGeo, coneMat);

      // Orient the cone to point in the camera's forward direction
      // ConeGeometry points along +Y by default; we rotate to point along camera direction
      const angle = Math.atan2(cal.dirY, cal.dirX);
      cone.rotation.z = -(Math.PI / 2 + angle);
      cone.position.set(cal.posX + cal.dirX * frustumLength / 2, 1.5, cal.posY + cal.dirY * frustumLength / 2);

      this.egoGroup.add(cone);

      // Frustum edge line for clarity
      const edgeGeo = new BufferGeometry();
      const edgePositions = [
        cal.posX, 1.5, cal.posY,
        cal.posX + cal.dirX * frustumLength + Math.cos(angle + halfAngle) * radius, 1.5, cal.posY + cal.dirY * frustumLength + Math.sin(angle + halfAngle) * radius,
        cal.posX, 1.5, cal.posY,
        cal.posX + cal.dirX * frustumLength + Math.cos(angle - halfAngle) * radius, 1.5, cal.posY + cal.dirY * frustumLength + Math.sin(angle - halfAngle) * radius
      ];
      edgeGeo.setAttribute("position", new Float32BufferAttribute(edgePositions, 3));
      const edgeMat = new LineBasicMaterial({ color, transparent: true, opacity: 0.5 });
      this.egoGroup.add(new Line(edgeGeo, edgeMat));
    }
  }

  /**
   * Synthesize world-space positions for tracked objects and create 3D meshes.
   * Since the dataset has no 3D bounding boxes, positions are estimated from
   * camera visibility data: for each track we find the median frame where it's
   * visible, take the ego pose at that frame, and project outward along the
   * average camera direction at a deterministic distance.
   */
  private buildTrackObjects(sceneData: SceneData): void {
    if (!this.scene) return;

    const TRACK_MARKER_RADIUS = 1.2;
    const MIN_DISTANCE = 8;
    const MAX_DISTANCE = 35;

    this.trackGeoDetected = new SphereGeometry(TRACK_MARKER_RADIUS, 12, 8);
    this.trackMatDetected = new MeshLambertMaterial({ color: COLORS.detected });
    this.trackMatOccluded = new MeshLambertMaterial({
      color: COLORS.occluded,
      transparent: true,
      opacity: 0.45
    });

    const cals = sceneData.cameraCalibrations;
    const poses = sceneData.egoPoses;
    const vis = sceneData.trackCameraVis;
    let placed = 0;

    for (const trackId of sceneData.trackIds) {
      const frameMap = vis[String(trackId)];
      if (!frameMap) continue;

      // Collect all frames where this track is visible and their cameras
      const visibleFrames: { frame: number; cameras: number[] }[] = [];
      for (const [fStr, cams] of Object.entries(frameMap)) {
        if (cams.length > 0) visibleFrames.push({ frame: Number(fStr), cameras: cams });
      }
      if (visibleFrames.length === 0) continue;

      // Use median visible frame for a stable reference position
      visibleFrames.sort((a, b) => a.frame - b.frame);
      const medianEntry = visibleFrames[Math.floor(visibleFrames.length / 2)];
      const refFrame = medianEntry.frame;
      const pose = poses[refFrame];
      if (!pose) continue;

      // Average camera direction (in vehicle frame) across the cameras that see this track
      let avgDirX = 0, avgDirY = 0;
      for (const camIdx of medianEntry.cameras) {
        const cal = cals[camIdx];
        if (cal) { avgDirX += cal.dirX; avgDirY += cal.dirY; }
      }
      const dirLen = Math.sqrt(avgDirX * avgDirX + avgDirY * avgDirY);
      if (dirLen < 0.001) continue;
      avgDirX /= dirLen;
      avgDirY /= dirLen;

      // Deterministic distance based on track ID (spread objects at varying distances)
      const hash = ((trackId * 13 + 7) % 100) / 100;
      const distance = MIN_DISTANCE + hash * (MAX_DISTANCE - MIN_DISTANCE);

      // Small lateral jitter so objects in the same sector don't overlap
      const lateralJitter = (((trackId * 31 + 11) % 100) / 100 - 0.5) * 8;
      const perpX = -avgDirY;
      const perpY = avgDirX;

      // Transform camera-frame direction to world frame using ego heading
      const cosH = Math.cos(pose.heading);
      const sinH = Math.sin(pose.heading);
      const worldDirX = avgDirX * cosH - avgDirY * sinH;
      const worldDirZ = avgDirX * sinH + avgDirY * cosH;
      const worldPerpX = perpX * cosH - perpY * sinH;
      const worldPerpZ = perpX * sinH + perpY * cosH;

      const worldX = pose.x + worldDirX * distance + worldPerpX * lateralJitter;
      const worldZ = pose.y + worldDirZ * distance + worldPerpZ * lateralJitter;

      const mesh = new Mesh(this.trackGeoDetected, this.trackMatOccluded);
      mesh.position.set(worldX, TRACK_MARKER_RADIUS, worldZ);
      mesh.visible = false; // will be shown by updateTrackVisibility
      this.scene.add(mesh);

      this.trackMeshes.set(trackId, { mesh, worldX, worldZ });
      placed++;
    }

    console.log(LOG_PREFIX, `Placed ${placed} track objects in scene`);
  }

  private getTrajectoryExtent(poses: EgoPose[]): { centerX: number; centerY: number; rangeX: number; rangeY: number } {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of poses) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      rangeX: maxX - minX,
      rangeY: maxY - minY
    };
  }

  private setFrame(frame: number): void {
    this.currentFrame = frame;
    this.currentFrameImages = this.sceneDataService.getFrameImageUrls(frame);

    // Update ego vehicle position from real ego_pose data
    if (this.sceneDataCache && this.egoGroup) {
      const pose = this.sceneDataCache.egoPoses[frame];
      if (pose) {
        this.egoGroup.position.set(pose.x, 0, pose.y);
        this.egoGroup.rotation.y = -pose.heading;
      }
    }

    // Update front camera billboard texture
    if (this.frontCameraPlane && this.currentFrameImages[0]) {
      this.textureLoader.load(
        this.currentFrameImages[0],
        (texture: Texture) => {
          if (this.frontCameraPlane) {
            const mat = this.frontCameraPlane.material as MeshBasicMaterial;
            mat.map?.dispose();
            mat.map = texture;
            mat.needsUpdate = true;
            mat.color.set(COLORS.billboard);
          }
        },
        undefined,
        () => console.warn(LOG_PREFIX, `Failed to load front camera texture for frame ${frame}`)
      );
    }

    // Update track visibility
    this.updateTrackVisibility();
  }

  private updateTrackVisibility(): void {
    this.currentFusionMode = this.fusionStore.fusionMode();
    const result = this.trackVisibility.getVisibility(
      this.currentFrame,
      this.fusionStore.fusionMode(),
      environment.cameraCount
    );
    this.detectedCount = result.detectedCount;
    this.totalPresent = result.total;
    this.perCameraCounts = [...result.perCamera];

    // Update 3D track object visibility and color
    const present = this.trackVisibility.getTracksPresent(this.currentFrame);
    for (const [trackId, entry] of this.trackMeshes) {
      const isPresent = present.has(trackId);
      const isDetected = result.detected.has(trackId);
      entry.mesh.visible = isPresent;
      if (isPresent) {
        entry.mesh.material = isDetected ? this.trackMatDetected! : this.trackMatOccluded!;
      }
    }
  }

  private renderLoop = (): void => {
    this.animationFrameId = globalThis.requestAnimationFrame(this.renderLoop);
    this.controls?.update();
    // Check if fusion mode changed
    if (this.fusionStore.fusionMode() !== this.currentFusionMode) {
      this.updateTrackVisibility();
      this.cdr.detectChanges();
    }
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
