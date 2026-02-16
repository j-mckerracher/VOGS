import { Component } from "@angular/core";
import { ControlsPanelComponent } from "./features/demo/controls-panel.component";
import { MetricsPanelComponent } from "./features/demo/metrics-panel.component";
import { SceneViewerComponent } from "./features/demo/scene-viewer.component";
import { HeroSectionComponent } from "./features/hero/hero-section.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [HeroSectionComponent, SceneViewerComponent, ControlsPanelComponent, MetricsPanelComponent],
  template: `
    <app-hero-section />
    <main id="demo-section" tabindex="-1" aria-label="Interactive demo section" class="demo-section">
      <div class="demo-layout">
        <div class="viewer-area">
          <app-scene-viewer />
        </div>
        <aside class="sidebar">
          <app-controls-panel />
          <app-metrics-panel />
        </aside>
      </div>
    </main>
  `,
  styles: [`
    .demo-section {
      background: #000;
      min-height: 100vh;
      padding: 1.5rem;
    }
    .demo-layout {
      display: grid;
      gap: 1.5rem;
      grid-template-columns: 1fr 280px;
      margin: 0 auto;
      max-width: 1400px;
    }
    .viewer-area { min-width: 0; }
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    @media (max-width: 900px) {
      .demo-layout { grid-template-columns: 1fr; }
    }
  `]
})
export class AppComponent {}
