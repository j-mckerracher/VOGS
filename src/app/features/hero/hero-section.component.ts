import { Component, EventEmitter, Output } from "@angular/core";

@Component({
  selector: "app-hero-section",
  standalone: true,
  templateUrl: "./hero-section.component.html",
  styleUrls: ["./hero-section.component.scss"]
})
export class HeroSectionComponent {
  @Output() readonly viewDemo = new EventEmitter<void>();

  onViewDemoClick(): void {
    this.viewDemo.emit();

    const demoSection = globalThis.document.getElementById("demo-section");
    demoSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    demoSection?.focus();
  }
}
