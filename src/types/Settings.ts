import { onMounted, ref, watch } from "vue";

export const OPTIMIZE_FOR_IDS = ["accuracy", "speed"];

const DEFAULT_SETTINGS = {
  extraBars: 1,
  lang: "fr" as "fr" | "en",
  clef: "treble" as "treble" | "bass" | "both",
  showAdvancedSettings: false,
  badGuessTime: 10,
  takeStatsOver: 10,
  minSampleSize: 3,
  optimizeFor: "speed" as "accuracy" | "speed",
  badAbondance: 3,
  goodScarcity: 3,
};

export type Settings = typeof DEFAULT_SETTINGS;

export function useSettings() {
  const settings = ref({ ...DEFAULT_SETTINGS });
  watch(
    settings,
    (s) => {
      localStorage.setItem("settings", JSON.stringify(s));
    },
    { deep: true }
  );
  onMounted(() => {
    const storedSettings = localStorage.getItem("settings");
    if (storedSettings) {
      try {
        settings.value = { ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) };
      } catch (e) {
        console.error("failed to load stored settings", e);
      }
    }
  });
  return settings;
}
