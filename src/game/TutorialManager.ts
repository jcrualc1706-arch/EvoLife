import { TutorialState, TutorialStep } from './types';

export class TutorialManager {
  public currentStep: TutorialStep = 'movement';
  public isActive: boolean = false;
  private moveDistanceAccumulated: number = 0;
  private hasZoomed: boolean = false;

  public startAfterMeteor(): void {
    this.isActive = true;
    this.currentStep = 'movement';
    this.moveDistanceAccumulated = 0;
    this.hasZoomed = false;
  }

  public recordMovement(distance: number): boolean {
    if (!this.isActive) return false;
    if (this.currentStep === 'movement') {
      this.moveDistanceAccumulated += Math.max(0, distance);
      if (this.moveDistanceAccumulated > 12.0) {
        this.currentStep = 'camera';
        return true;
      }
    }
    return false;
  }

  public recordCameraZoom(): boolean {
    if (!this.isActive) return false;
    if (this.currentStep === 'camera') {
      this.hasZoomed = true;
      this.currentStep = 'vital_signs';
      return true;
    }
    return false;
  }

  public acknowledgeVitalSigns(): boolean {
    if (!this.isActive) return false;
    if (this.currentStep === 'vital_signs') {
      this.currentStep = 'feed_first_time';
      return true;
    }
    return false;
  }

  public recordFoodEaten(): boolean {
    if (!this.isActive) return false;
    if (this.currentStep === 'feed_first_time') {
      this.currentStep = 'evolve_key';
      return true;
    }
    return false;
  }

  public completeTutorial(): void {
    this.isActive = false;
    this.currentStep = 'completed';
  }

  public getState(): TutorialState {
    let progress = 0;
    if (this.currentStep === 'movement') {
      progress = Math.min(100, Math.round((this.moveDistanceAccumulated / 12.0) * 100));
    } else if (this.currentStep === 'camera') {
      progress = this.hasZoomed ? 100 : 0;
    } else if (this.currentStep === 'completed') {
      progress = 100;
    }
    return {
      isActive: this.isActive,
      currentStep: this.currentStep,
      progress,
    };
  }
}
