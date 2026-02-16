import { describe, expect, it } from "vitest";
import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { RendererAdapterService, type RendererFactoryService } from "./renderer-adapter.service";
import type { ParsedScenePayload } from "../models/parsed-scene-payload.model";

class FakeRenderer {
  animationLoop: (() => void) | null = null;
  setAnimationLoopCalls: Array<(() => void) | null> = [];
  renderCalls = 0;
  disposeCalls = 0;

  setSize(_width: number, _height: number, _updateStyle?: boolean): void {
    void _width;
    void _height;
    void _updateStyle;
    // no-op fake
  }

  setAnimationLoop(callback: (() => void) | null): void {
    this.animationLoop = callback;
    this.setAnimationLoopCalls.push(callback);
  }

  render(_scene: Scene, _camera: PerspectiveCamera): void {
    void _scene;
    void _camera;
    this.renderCalls += 1;
  }

  dispose(): void {
    this.disposeCalls += 1;
  }
}

const createAdapter = (rendererFactory: () => WebGLRenderer): RendererAdapterService =>
  new RendererAdapterService({
    create: rendererFactory
  } as RendererFactoryService);

describe("RendererAdapterService", () => {
  it("exposes the required adapter API", () => {
    const adapter = createAdapter(() => new FakeRenderer() as unknown as WebGLRenderer);

    expect(typeof adapter.init).toBe("function");
    expect(typeof adapter.load).toBe("function");
    expect(typeof adapter.applyFusionMode).toBe("function");
    expect(typeof adapter.applyRepresentationMode).toBe("function");
    expect(typeof adapter.dispose).toBe("function");
  });

  it("keeps apply* calls idempotent for repeated mode values", () => {
    const adapter = createAdapter(() => new FakeRenderer() as unknown as WebGLRenderer);
    const canvas = {} as HTMLCanvasElement;
    adapter.init(canvas);

    adapter.applyFusionMode("vogs");
    adapter.applyFusionMode("vogs");
    adapter.applyRepresentationMode("gaussian");
    adapter.applyRepresentationMode("gaussian");

    const debugAdapter = adapter as unknown as {
      fusionMutationCount: number;
      representationMutationCount: number;
    };

    expect(debugAdapter.fusionMutationCount).toBe(1);
    expect(debugAdapter.representationMutationCount).toBe(1);
  });

  it("tears down renderer and animation loop on dispose", () => {
    const fakeRenderer = new FakeRenderer();
    const adapter = createAdapter(() => fakeRenderer as unknown as WebGLRenderer);
    const canvas = {} as HTMLCanvasElement;

    adapter.init(canvas);
    expect(fakeRenderer.animationLoop).not.toBeNull();

    adapter.dispose();

    expect(fakeRenderer.setAnimationLoopCalls.at(-1)).toBeNull();
    expect(fakeRenderer.animationLoop).toBeNull();
    expect(fakeRenderer.disposeCalls).toBe(1);
  });

  it("accepts parsed payloads via load", async () => {
    const adapter = createAdapter(() => new FakeRenderer() as unknown as WebGLRenderer);
    const payload: ParsedScenePayload = {
      sceneId: "scene-001",
      assetUrl: "/assets/scene.splat",
      format: "splat",
      sizeBytes: 123_456,
      data: new ArrayBuffer(8)
    };

    await expect(adapter.load(payload)).resolves.toBeUndefined();
  });

  it("stops render callback from drawing after dispose", () => {
    const fakeRenderer = new FakeRenderer();
    const adapter = createAdapter(() => fakeRenderer as unknown as WebGLRenderer);
    const canvas = {} as HTMLCanvasElement;
    adapter.init(canvas);

    const loop = fakeRenderer.animationLoop;
    expect(loop).not.toBeNull();

    if (loop !== null) {
      loop();
    }
    expect(fakeRenderer.renderCalls).toBe(1);

    adapter.dispose();

    const clearedLoop = fakeRenderer.animationLoop;
    expect(clearedLoop).toBeNull();

    if (loop !== null) {
      loop();
    }
    expect(fakeRenderer.renderCalls).toBe(1);
  });

  it("can be disposed repeatedly without residual state", () => {
    const fakeRenderer = new FakeRenderer();
    const adapter = createAdapter(() => fakeRenderer as unknown as WebGLRenderer);
    const canvas = {} as HTMLCanvasElement;
    adapter.init(canvas);

    adapter.dispose();
    adapter.dispose();

    expect(fakeRenderer.disposeCalls).toBe(1);
    expect(fakeRenderer.setAnimationLoopCalls.at(-1)).toBeNull();
  });
});
