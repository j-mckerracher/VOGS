import { Injectable } from "@angular/core";
import { Mesh, PerspectiveCamera, Scene, WebGLRenderer, type Material, type Object3D } from "three";
import type { FusionMode } from "../models/fusion-mode.model";
import type { ParsedScenePayload } from "../models/parsed-scene-payload.model";
import type { RepresentationMode } from "../models/representation-mode.model";

const DEFAULT_CAMERA_Z = 3 as const;
const DEFAULT_RENDER_SIZE = 1 as const;

@Injectable({ providedIn: "root" })
export class RendererFactoryService {
  create(canvas: HTMLCanvasElement): WebGLRenderer {
    return new WebGLRenderer({
      canvas,
      antialias: true
    });
  }
}

@Injectable({ providedIn: "root" })
export class RendererAdapterService {
  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private payload: ParsedScenePayload | null = null;
  private fusionMode: FusionMode | null = null;
  private representationMode: RepresentationMode | null = null;
  private renderLoopActive = false;

  private fusionMutationCount = 0;
  private representationMutationCount = 0;

  private readonly rendererFactory: RendererFactoryService;

  constructor(rendererFactory: RendererFactoryService = new RendererFactoryService()) {
    this.rendererFactory = rendererFactory;
  }

  init(canvas: HTMLCanvasElement): void {
    this.dispose();

    const renderer = this.rendererFactory.create(canvas);
    const width = canvas.clientWidth || canvas.width || DEFAULT_RENDER_SIZE;
    const height = canvas.clientHeight || canvas.height || DEFAULT_RENDER_SIZE;

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(60, width / height, 0.1, 1_000);
    this.camera.position.set(0, 0, DEFAULT_CAMERA_Z);

    renderer.setSize(width, height, false);
    renderer.setAnimationLoop(() => this.renderFrame());

    this.renderer = renderer;
    this.renderLoopActive = true;
  }

  async load(payload: ParsedScenePayload): Promise<void> {
    this.payload = payload;
  }

  applyFusionMode(mode: FusionMode): void {
    if (this.fusionMode === mode) {
      return;
    }

    this.fusionMode = mode;
    this.fusionMutationCount += 1;
    if (this.scene !== null) {
      this.scene.userData["fusionMode"] = mode;
    }
  }

  applyRepresentationMode(mode: RepresentationMode): void {
    if (this.representationMode === mode) {
      return;
    }

    this.representationMode = mode;
    this.representationMutationCount += 1;
    if (this.scene !== null) {
      this.scene.userData["representationMode"] = mode;
    }
  }

  dispose(): void {
    if (this.renderer !== null && this.renderLoopActive) {
      this.renderer.setAnimationLoop(null);
      this.renderLoopActive = false;
    }

    if (this.scene !== null) {
      this.scene.traverse((node: Object3D) => {
        if (node instanceof Mesh) {
          node.geometry.dispose();
          this.disposeMaterial(node.material);
        }
      });
      this.scene.clear();
    }

    this.renderer?.dispose();

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.payload = null;
    this.fusionMode = null;
    this.representationMode = null;
  }

  private renderFrame(): void {
    if (this.renderer === null || this.scene === null || this.camera === null) {
      return;
    }

    this.renderer.render(this.scene, this.camera);
  }

  private disposeMaterial(material: Material | Material[]): void {
    if (Array.isArray(material)) {
      for (const entry of material) {
        entry.dispose();
      }
      return;
    }

    material.dispose();
  }
}
