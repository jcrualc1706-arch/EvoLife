import React, { useState } from 'react';
import {
  Accessibility,
  Check,
  Gamepad2,
  Monitor,
  RotateCcw,
  Volume2,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { audioManager } from '../game/AudioManager';
import {
  ColorblindModeSetting,
  FpsLimitSetting,
  GameSettings,
  GraphicsQualityPreset,
  SteeringModeSetting,
} from '../game/types';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onResetSettings: () => void;
  onClose: () => void;
}

type SettingsTabId = 'graphics' | 'audio' | 'gameplay' | 'accessibility';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('graphics');

  const tabs: {
    id: SettingsTabId;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'graphics',
      label: 'Gráficos y Rendimiento',
      shortLabel: 'Gráficos',
      icon: <Monitor className="h-4 w-4" />,
    },
    {
      id: 'audio',
      label: 'Audio y Sonido',
      shortLabel: 'Audio',
      icon: <Volume2 className="h-4 w-4" />,
    },
    {
      id: 'gameplay',
      label: 'Jugabilidad y Controles',
      shortLabel: 'Controles',
      icon: <Gamepad2 className="h-4 w-4" />,
    },
    {
      id: 'accessibility',
      label: 'Accesibilidad y Sistema',
      shortLabel: 'Sistema',
      icon: <Accessibility className="h-4 w-4" />,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#021019]/75 backdrop-blur-xl p-3 sm:p-6 pointer-events-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[36px] border border-cyan-300/35 border-t-cyan-200/65 bg-gradient-to-b from-cyan-950/85 via-[#041a29]/92 to-teal-950/90 p-5 sm:p-7 backdrop-blur-xl shadow-[0_12px_42px_rgba(3,18,30,0.8),0_0_32px_rgba(34,211,238,0.22),inset_0_1px_2px_rgba(165,243,252,0.35)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-cyan-300/20">
          <div>
            <h2
              id="settings-modal-title"
              className="font-display text-xl sm:text-2xl font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
            >
              Ajustes del Sistema Evolutivo
            </h2>
            <p className="text-xs text-cyan-200/80">
              Configuración persistente en tiempo real
            </p>
          </div>

          <button
            type="button"
            onPointerEnter={() => audioManager.playButtonHover()}
            onClick={() => {
              audioManager.playButtonClick();
              onClose();
            }}
            aria-label="Cerrar ajustes"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-100 cursor-pointer hover:scale-105 active:scale-95 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Category Capsule Tabs */}
        <div className="my-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onPointerEnter={() => audioManager.playButtonHover()}
                onClick={() => {
                  audioManager.playButtonClick();
                  setActiveTab(tab.id);
                }}
                className={`flex items-center justify-center gap-2 rounded-full px-3.5 py-2.5 text-xs font-extrabold cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'border border-amber-200/80 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-950 shadow-[0_0_16px_rgba(251,191,36,0.4),inset_0_1px_2px_rgba(255,255,255,0.75)] scale-[1.02]'
                    : 'border border-cyan-300/25 bg-[#031521]/65 hover:bg-cyan-900/45 text-cyan-100/90'
                }`}
              >
                {tab.icon}
                <span className="truncate">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* TAB A: GRÁFICOS Y RENDIMIENTO */}
          {activeTab === 'graphics' && (
            <div className="space-y-4">
              {/* Calidad Visual Global */}
              <div className="rounded-3xl border border-cyan-300/25 bg-[#031521]/65 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <div className="font-display text-sm font-extrabold text-white">
                      Calidad Visual Global
                    </div>
                    <div className="text-xs text-cyan-200/75">
                      Ajusta la resolución de píxeles, sombras y densidad de
                      partículas marinas
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      {
                        value: 'low',
                        label: 'Baja',
                        desc: 'PixelRatio 1x · Sin sombras',
                      },
                      {
                        value: 'medium',
                        label: 'Media',
                        desc: 'PixelRatio 1.5x · Sombras activas',
                      },
                      {
                        value: 'high',
                        label: 'Alta',
                        desc: 'PixelRatio 2x · Máximo detalle',
                      },
                    ] as {
                      value: GraphicsQualityPreset;
                      label: string;
                      desc: string;
                    }[]
                  ).map((opt) => {
                    const selected = settings.graphicsQuality === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({ graphicsQuality: opt.value })
                        }
                        className={`rounded-2xl border p-3 text-left cursor-pointer transition-all ${
                          selected
                            ? 'border-cyan-200/80 bg-cyan-500/25 text-white shadow-[0_0_14px_rgba(34,211,238,0.28)]'
                            : 'border-cyan-300/20 bg-cyan-950/35 hover:bg-cyan-900/40 text-cyan-100/80'
                        }`}
                      >
                        <div className="font-display text-xs font-extrabold flex items-center justify-between">
                          <span>{opt.label}</span>
                          {selected && (
                            <Check className="h-3.5 w-3.5 text-amber-300" />
                          )}
                        </div>
                        <div className="mt-1 text-[10px] text-cyan-200/75">
                          {opt.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Límite de Fotogramas (FPS) */}
              <div className="rounded-3xl border border-cyan-300/25 bg-[#031521]/65 p-4">
                <div className="mb-2.5">
                  <div className="font-display text-sm font-extrabold text-white">
                    Límite de Fotogramas (FPS)
                  </div>
                  <div className="text-xs text-cyan-200/75">
                    Controla la cadencia máxima del bucle de renderizado 3D
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { value: '30', label: '30 FPS (Ahorro)' },
                      { value: '60', label: '60 FPS (Estándar)' },
                      { value: 'unlimited', label: 'Ilimitado' },
                    ] as { value: FpsLimitSetting; label: string }[]
                  ).map((opt) => {
                    const selected = settings.fpsLimit === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({ fpsLimit: opt.value })
                        }
                        className={`rounded-full border px-3 py-2 text-xs font-extrabold cursor-pointer transition-all ${
                          selected
                            ? 'border-cyan-200/80 bg-cyan-500/25 text-white shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                            : 'border-cyan-300/20 bg-cyan-950/35 hover:bg-cyan-900/40 text-cyan-100/80'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Distancia de Niebla Abisal */}
              <div className="rounded-3xl border border-cyan-300/25 bg-[#031521]/65 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-display text-sm font-extrabold text-white">
                      Distancia de Niebla Abisal
                    </div>
                    <div className="text-xs text-cyan-200/75">
                      Ajusta la visibilidad de profundidad en el océano
                    </div>
                  </div>
                  <span className="rounded-full border border-cyan-300/35 bg-cyan-500/20 px-3 py-1 font-mono text-xs font-extrabold text-cyan-200">
                    {settings.fogDistancePercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={150}
                  step={5}
                  value={settings.fogDistancePercent}
                  onChange={(e) =>
                    onUpdateSettings({
                      fogDistancePercent: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Sacudida de Cámara (Screen Shake) */}
              <div className="flex items-center justify-between rounded-3xl border border-cyan-300/25 bg-[#031521]/65 p-4">
                <div>
                  <div className="font-display text-sm font-extrabold text-white">
                    Sacudida de Cámara (Screen Shake)
                  </div>
                  <div className="text-xs text-cyan-200/75">
                    Vibración reactiva al recibir impactos o mordiscos de
                    depredadores
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ screenShake: !settings.screenShake })
                  }
                  className={`min-w-[84px] rounded-full border px-4 py-2 text-xs font-extrabold cursor-pointer transition-all ${
                    settings.screenShake
                      ? 'border-emerald-200/80 bg-emerald-500/30 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : 'border-cyan-300/25 bg-cyan-950/50 text-cyan-200/70'
                  }`}
                >
                  {settings.screenShake ? 'Sí' : 'No'}
                </button>
              </div>
            </div>
          )}

          {/* TAB B: AUDIO Y SONIDO */}
          {activeTab === 'audio' && (
            <div className="space-y-4">
              {/* Volumen General */}
              <div className="rounded-3xl border border-cyan-300/25 bg-[#031521]/65 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-display text-sm font-extrabold text-white">
                      Volumen General (Master)
                    </div>
                    <div className="text-xs text-cyan-200/75">
                      Nivel global de salida acústica del simulador
                    </div>
                  </div>
                  <span className="rounded-full border border-cyan-300/35 bg-cyan-500/20 px-3 py-1 font-mono text-xs font-extrabold text-cyan-200">
                    {settings.masterVolume}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.masterVolume}
                  onChange={(e) =>
                    onUpdateSettings({ masterVolume: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Efectos Biológicos (SFX) */}
              <div className="rounded-3xl border border-cyan-300/25 bg-[#031521]/65 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-display text-sm font-extrabold text-white">
                      Efectos Biológicos (SFX)
                    </div>
                    <div className="text-xs text-cyan-200/75">
                      Ingestión celular, descargas bioeléctricas, propulsión y
                      apareamiento
                    </div>
                  </div>
                  <span className="rounded-full border border-cyan-300/35 bg-cyan-500/20 px-3 py-1 font-mono text-xs font-extrabold text-cyan-200">
                    {settings.sfxVolume}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.sfxVolume}
                  onChange={(e) =>
                    onUpdateSettings({ sfxVolume: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Ambiente Oceánico / Abisal */}
              <div className="rounded-3xl border border-cyan-300/25 bg-[#031521]/65 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-display text-sm font-extrabold text-white">
                      Ambiente Oceánico / Abisal
                    </div>
                    <div className="text-xs text-cyan-200/75">
                      Corrientes submarinas, fumarolas hidrotermales y oleaje
                      costero
                    </div>
                  </div>
                  <span className="rounded-full border border-cyan-300/35 bg-cyan-500/20 px-3 py-1 font-mono text-xs font-extrabold text-cyan-200">
                    {settings.ambientVolume}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.ambientVolume}
                  onChange={(e) =>
                    onUpdateSettings({ ambientVolume: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Alertas Sonoras de Amenaza */}
              <div className="flex items-center justify-between rounded-3xl border border-cyan-300/25 bg-[#031521]/65 p-4">
                <div>
                  <div className="font-display text-sm font-extrabold text-white">
                    Alertas Sonoras de Amenaza
                  </div>
                  <div className="text-xs text-cyan-200/75">
                    Aviso acústico cuando un depredador o Leviatán entra en
                    persecución
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      threatAudioAlerts: !settings.threatAudioAlerts,
                    })
                  }
                  className={`min-w-[84px] rounded-full border px-4 py-2 text-xs font-extrabold cursor-pointer transition-all ${
                    settings.threatAudioAlerts
                      ? 'border-emerald-200/80 bg-emerald-500/30 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : 'border-cyan-300/25 bg-cyan-950/50 text-cyan-200/70'
                  }`}
                >
                  {settings.threatAudioAlerts ? 'Sí' : 'No'}
                </button>
              </div>
            </div>
          )}

          {/* TAB C: JUGABILIDAD Y CONTROLES */}
          {activeTab === 'gameplay' && (
            <div className="space-y-4">
              {/* Modo de Dirección Celular */}
              <div className="rounded-3xl border border-cyan-300/25 bg-[#031521]/65 p-4">
                <div className="mb-3">
                  <div className="font-display text-sm font-extrabold text-white">
                    Modo de Dirección Celular
                  </div>
                  <div className="text-xs text-cyan-200/75">
                    Elige entre rotar con las teclas A/D o dirigir la célula
                    hacia el cursor del ratón
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(
                    [
                      {
                        value: 'keyboard',
                        label: 'Teclado (WASD)',
                        desc: 'Giro clásico mediante teclas A y D',
                      },
                      {
                        value: 'mouse',
                        label: 'Seguir Cursor del Ratón',
                        desc: 'La célula orienta su rumbo hacia el puntero',
                      },
                    ] as {
                      value: SteeringModeSetting;
                      label: string;
                      desc: string;
                    }[]
                  ).map((opt) => {
                    const selected = settings.steeringMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({ steeringMode: opt.value })
                        }
                        className={`rounded-2xl border p-3 text-left cursor-pointer transition-all ${
                          selected
                            ? 'border-cyan-200/80 bg-cyan-500/25 text-white shadow-[0_0_14px_rgba(34,211,238,0.28)]'
                            : 'border-cyan-300/20 bg-cyan-950/35 hover:bg-cyan-900/40 text-cyan-100/80'
                        }`}
                      >
                        <div className="font-display text-xs font-extrabold flex items-center justify-between">
                          <span>{opt.label}</span>
                          {selected && (
                            <Check className="h-3.5 w-3.5 text-amber-300" />
                          )}
                        </div>
                        <div className="mt-1 text-[10px] text-cyan-200/75">
                          {opt.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sensibilidad de Giro / Cámara */}
              <div className="rounded-3xl border border-cyan-300/25 bg-[#031521]/65 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-display text-sm font-extrabold text-white">
                      Sensibilidad de Giro / Cámara
                    </div>
                    <div className="text-xs text-cyan-200/75">
                      Multiplicador de agilidad de rotación durante el nado
                    </div>
                  </div>
                  <span className="rounded-full border border-cyan-300/35 bg-cyan-500/20 px-3 py-1 font-mono text-xs font-extrabold text-cyan-200">
                    {settings.rotationSensitivity.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={settings.rotationSensitivity}
                  onChange={(e) =>
                    onUpdateSettings({
                      rotationSensitivity: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Invertir Eje de Órbita en el Editor 3D */}
              <div className="flex items-center justify-between rounded-3xl border border-cyan-300/25 bg-[#031521]/65 p-4">
                <div>
                  <div className="font-display text-sm font-extrabold text-white">
                    Invertir Eje de Órbita en el Editor 3D
                  </div>
                  <div className="text-xs text-cyan-200/75">
                    Invierte el giro de cámara al arrastrar con clic derecho en
                    el Taller 3D
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      invertEditorCamera: !settings.invertEditorCamera,
                    })
                  }
                  className={`min-w-[84px] rounded-full border px-4 py-2 text-xs font-extrabold cursor-pointer transition-all ${
                    settings.invertEditorCamera
                      ? 'border-emerald-200/80 bg-emerald-500/30 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : 'border-cyan-300/25 bg-cyan-950/50 text-cyan-200/70'
                  }`}
                >
                  {settings.invertEditorCamera ? 'Sí' : 'No'}
                </button>
              </div>

              {/* Simetría Bilateral Automática en el Editor */}
              <div className="flex items-center justify-between rounded-3xl border border-cyan-300/25 bg-[#031521]/65 p-4">
                <div>
                  <div className="font-display text-sm font-extrabold text-white">
                    Simetría Bilateral Automática en el Editor
                  </div>
                  <div className="text-xs text-cyan-200/75">
                    Duplica en espejo las piezas colocadas en los flancos de la
                    célula
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      autoBilateralSymmetry: !settings.autoBilateralSymmetry,
                    })
                  }
                  className={`min-w-[84px] rounded-full border px-4 py-2 text-xs font-extrabold cursor-pointer transition-all ${
                    settings.autoBilateralSymmetry
                      ? 'border-emerald-200/80 bg-emerald-500/30 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : 'border-cyan-300/25 bg-cyan-950/50 text-cyan-200/70'
                  }`}
                >
                  {settings.autoBilateralSymmetry ? 'Sí' : 'No'}
                </button>
              </div>
            </div>
          )}

          {/* TAB D: ACCESIBILIDAD Y SISTEMA */}
          {activeTab === 'accessibility' && (
            <div className="space-y-4">
              {/* Modo de Daltonismo */}
              <div className="rounded-3xl border border-cyan-300/25 bg-[#031521]/65 p-4">
                <div className="mb-3">
                  <div className="font-display text-sm font-extrabold text-white">
                    Modo de Daltonismo (Alto Contraste)
                  </div>
                  <div className="text-xs text-cyan-200/75">
                    Adapta el espectro de color del radar y alertas visuales
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { value: 'none', label: 'Estándar' },
                      { value: 'protanopia', label: 'Protanopia' },
                      { value: 'deuteranopia', label: 'Deuteranopia' },
                      { value: 'tritanopia', label: 'Tritanopia' },
                    ] as { value: ColorblindModeSetting; label: string }[]
                  ).map((opt) => {
                    const selected = settings.colorblindMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({ colorblindMode: opt.value })
                        }
                        className={`rounded-full border px-3 py-2 text-xs font-extrabold cursor-pointer transition-all ${
                          selected
                            ? 'border-cyan-200/80 bg-cyan-500/25 text-white shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                            : 'border-cyan-300/20 bg-cyan-950/35 hover:bg-cyan-900/40 text-cyan-100/80'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reducir Movimiento de Interfaz */}
              <div className="flex items-center justify-between rounded-3xl border border-cyan-300/25 bg-[#031521]/65 p-4">
                <div>
                  <div className="font-display text-sm font-extrabold text-white">
                    Reducir Movimiento de Interfaz
                  </div>
                  <div className="text-xs text-cyan-200/75">
                    Suaviza las animaciones elásticas y desactiva vibraciones de
                    cámara
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      reducedMotion: !settings.reducedMotion,
                    })
                  }
                  className={`min-w-[84px] rounded-full border px-4 py-2 text-xs font-extrabold cursor-pointer transition-all ${
                    settings.reducedMotion
                      ? 'border-emerald-200/80 bg-emerald-500/30 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : 'border-cyan-300/25 bg-cyan-950/50 text-cyan-200/70'
                  }`}
                >
                  {settings.reducedMotion ? 'Sí' : 'No'}
                </button>
              </div>

              {/* Idioma de la Interfaz */}
              <div className="flex items-center justify-between rounded-3xl border border-cyan-300/25 bg-[#031521]/65 p-4">
                <div>
                  <div className="font-display text-sm font-extrabold text-white">
                    Idioma de la Interfaz
                  </div>
                  <div className="text-xs text-cyan-200/75">
                    Idioma activo para textos, biomas y catálogo genético
                  </div>
                </div>
                <span className="rounded-full border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-xs font-extrabold text-cyan-100">
                  Español (ES)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-cyan-300/20">
          <button
            type="button"
            onPointerEnter={() => audioManager.playButtonHover()}
            onClick={() => {
              audioManager.playButtonClick();
              onResetSettings();
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full border border-rose-300/35 bg-rose-500/15 hover:bg-rose-500/25 px-5 py-2.5 text-xs font-bold text-rose-200 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Restablecer Todos los Ajustes</span>
          </button>

          <button
            type="button"
            onPointerEnter={() => audioManager.playButtonHover()}
            onClick={() => {
              audioManager.playButtonClick();
              onClose();
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full border border-amber-100/80 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 px-7 py-2.5 text-xs font-extrabold text-slate-950 shadow-[0_4px_14px_rgba(251,191,36,0.4),inset_0_1px_2px_rgba(255,255,255,0.75)] cursor-pointer hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Check className="h-4 w-4" />
            <span>Guardar y Cerrar</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
