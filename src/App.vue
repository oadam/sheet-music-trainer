<script setup lang="ts">
import Vecflow from "./components/Vecflow.vue";
import { computed, onMounted, ref, watch } from "vue";
import EvictingMultiMap from "./types/EvictingMultiMap";

interface Guess {
  failed: boolean;
  duration: number;
}

const getNoteOctave = (note: number) => Math.floor(note / 7);
const getNoteLabel = (note: number, langNotes: string[]) =>
  langNotes[Math.floor(note % 7)];
const getNoteFullLabel = (note: number, langNotes: string[]) =>
  langNotes[Math.floor(note % 7)] +
  String.fromCharCode("₀".charCodeAt(0) + getNoteOctave(note));

const EVICT_AFTER = 20;
const lastGuesses = ref(new EvictingMultiMap<number, Guess>(EVICT_AFTER));
watch(
  lastGuesses,
  (s) =>
    localStorage.setItem(
      "lastGuesses",
      JSON.stringify(Array.from(s.values.entries()))
    ),
  { deep: true }
);
onMounted(() => {
  const storedLastGuesses = localStorage.getItem("lastGuesses");
  if (storedLastGuesses) {
    try {
      lastGuesses.value = new EvictingMultiMap(
        EVICT_AFTER,
        JSON.parse(storedLastGuesses)
      );
    } catch (e) {
      console.error(e);
    }
  }
});
const DEFAULT_SETTINGS = {
  extraBars: 1,
  lang: "fr" as "fr" | "en",
  guessTime: 1000,
  goodThreshold: 0.8,
  perfectThreshold: 0.99,
  goodScarcity: 3,
  perfectScarcity: 10,
};

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
      console.error(e);
    }
  }
});
const hiddenNotes = ref(new Set<number>());
watch(
  hiddenNotes,
  (s) => {
    localStorage.setItem("hiddenNotes", JSON.stringify(Array.from(s)));
  },
  { deep: true }
);
onMounted(() => {
  const storedHiddenNotes = localStorage.getItem("hiddenNotes");
  if (storedHiddenNotes) {
    try {
      hiddenNotes.value = new Set(JSON.parse(storedHiddenNotes));
    } catch (e) {
      console.error(e);
    }
  }
});
const toggleNote = (note: number) =>
  hiddenNotes.value.has(note)
    ? hiddenNotes.value.delete(note)
    : hiddenNotes.value.add(note);
const note = ref(28);
const ENGLISH_NOTES = ["C", "D", "E", "F", "G", "A", "B"];
const FRENCH_NOTES = ["Do", "Ré", "Mi", "Fa", "Sol", "La", "Si", "Do"];
const langNotes = computed(() =>
  settings.value.lang == "fr" ? FRENCH_NOTES : ENGLISH_NOTES
);
const vecflowNote = computed(
  () => getNoteLabel(note.value, ENGLISH_NOTES) + getNoteOctave(note.value)
);
const langNote = computed(() => getNoteLabel(note.value, langNotes.value));
interface Stat {
  note: number;
  label: string;
  guessesCount: number;
  avgDuration: number;
  percentCorrect: number;
}
const minNote = computed(() => 28 - 2 * settings.value.extraBars);
const maxNote = computed(() => 36 + 2 * settings.value.extraBars);
const stats = computed<Stat[]>(() => {
  const result: Stat[] = [];
  for (let note = minNote.value; note <= maxNote.value; note++) {
    const guesses = lastGuesses.value.values.get(note);
    const guessesCount = guesses?.length || 0;
    const label = getNoteFullLabel(note, langNotes.value);
    const stat: Stat = !guesses
      ? {
          note,
          label,
          guessesCount,
          avgDuration: settings.value.guessTime,
          percentCorrect: 0,
        }
      : {
          note,
          label,
          guessesCount,
          avgDuration:
            guesses.reduce((sum, g) => g.duration + sum, 0) / guesses.length,
          percentCorrect:
            guesses.reduce((sum, g) => (g.failed ? 0 : 1) + sum, 0) /
            guesses.length,
        };
    result.push(stat);
  }
  return result;
});

const noteKeytouch = computed(() => langNote.value[0].toLowerCase());
const state = ref<"paused" | "started" | "error">("paused");
const guessTimeoutStarted = ref(0);
const nonHiddenNotes = computed<number[]>(() =>
  Array.from(
    { length: maxNote.value - minNote.value + 1 },
    (_v, i) => minNote.value + i
  ).filter((n) => !hiddenNotes.value.has(n))
);
let guessTimeout: number | undefined = undefined;
watch(state, (s) => {
  if (s != "started") {
    clearTimeout(guessTimeout);
  }
  if (s == "started") {
    start();
  }
});

const chooseNextNote = () => {
  let statsMap = new Map<number, Stat>();
  for (const s of stats.value) {
    statsMap.set(s.note, s);
  }
  let totalProb = 0;
  let candidates: { totalProbAfter: number; note: number }[] = [];
  for (const n of nonHiddenNotes.value) {
    if (n == note.value) {
      continue;
    }
    const stats = statsMap.get(n);
    let prob: number;
    if (!stats || stats.guessesCount < 5) {
      prob = 1;
    } else if (stats.percentCorrect > settings.value.perfectThreshold) {
      prob = 1 / settings.value.perfectScarcity;
    } else if (stats.percentCorrect > settings.value.goodThreshold) {
      prob = 1 / settings.value.goodScarcity;
    } else {
      prob = 1;
    }
    totalProb += prob;
    candidates.push({ totalProbAfter: totalProb, note: n });
  }
  const ran = Math.random() * totalProb;
  const candidate = candidates.find((c) => c.totalProbAfter > ran);
  if (!candidate) {
    throw new Error("did not find candidate note");
  }
  return candidate.note;
};

const start = () => {
  state.value = "started";
  note.value = chooseNextNote();
  clearTimeout(guessTimeout);
  guessTimeoutStarted.value = Date.now();
  guessTimeout = setTimeout(() => {
    state.value = "error";
    lastGuesses.value.add(note.value, {
      failed: true,
      duration: settings.value.guessTime,
    });
  }, settings.value.guessTime);
};

window.onkeydown = (e) => {
  const goodGuess = e.key == noteKeytouch.value;
  switch (state.value) {
    case "paused":
      if (e.key == "s") {
        state.value = "started";
      }
      break;
    case "error":
      if (goodGuess) {
        state.value = "started";
      }
      break;
    case "started":
      if (e.key == "p") {
        state.value = "paused";
        break;
      }
      lastGuesses.value.add(note.value, {
        failed: !goodGuess,
        duration: goodGuess
          ? Date.now() - guessTimeoutStarted.value
          : settings.value.guessTime,
      });
      if (goodGuess) {
        start();
      } else {
        state.value = "error";
      }
      break;
  }
};
</script>

<template>
  <h1>Music sheet trainer</h1>
  <p>
    Quickly type the displayed key using your keyboard.
    <br />Notes with good ratings are displayed less often. <br />Press "s" to
    start and "p" to pause.
  </p>
  <div class="wrapper">
    <div class="main">
      <h2>Game</h2>
      <Vecflow
        v-if="state != 'paused'"
        clef="treble"
        :note="vecflowNote"
      ></Vecflow>
      <div class="paused" v-if="state == 'paused'">
        Game is paused. Press "s" to start
      </div>
      <div class="error" v-if="state == 'error'">
        This note is {{ langNote }} ! <br />Press {{ noteKeytouch }} to continue
      </div>
    </div>
    <div class="stats">
      <h2>Stats</h2>
      <div
        v-for="stat in stats"
        class="stat"
        :class="{ hidden: hiddenNotes.has(stat.note) }"
      >
        <input
          type="checkbox"
          :checked="!hiddenNotes.has(stat.note)"
          @click="toggleNote(stat.note)"
        />
        {{ stat.label }}
        <meter
          :low="settings.goodThreshold"
          :high="settings.perfectThreshold"
          optimum="1"
          :value="stat.percentCorrect"
        ></meter>
      </div>
    </div>
    <aside class="settings">
      <h2>Settings</h2>
      <label
        >Extra bars :
        <select v-model="settings.extraBars">
          <option v-for="o in 4" :value="o - 1">
            {{ o - 1 }}
          </option>
        </select>
      </label>
      <label
        >Lang :
        <select v-model="settings.lang">
          <option value="fr">French</option>
          <option value="en">English</option>
        </select>
      </label>
      <label
        >Guess time in ms :
        <input type="number" min="100" v-model="settings.guessTime"
      /></label>
      <label
        >good average score threshold :
        <input
          type="number"
          min="0"
          max="1"
          v-model="settings.goodThreshold"
          step="0.01"
      /></label>
      <label
        >perfect average score threshold :
        <input
          type="number"
          :min="settings.goodThreshold"
          max="1"
          v-model="settings.perfectThreshold"
          step="0.01"
      /></label>
      <label
        >Good notes scarcity :
        <input type="number" v-model="settings.goodScarcity"
      /></label>
      <label
        >Perfect notes scarcity :
        <input type="number" v-model="settings.perfectScarcity"
      /></label>
    </aside>
  </div>
  <footer>
    Source code hosted on
    <a href="https://github.com/oadam/sheet-music-trainer">github</a>
  </footer>
</template>

<style scoped>
.wrapper {
  display: flex;
  gap: 2rem;
}
aside {
  float: right;
  label {
    display: block;
    padding-bottom: 1rem;
  }
}
.stat.hidden {
  opacity: 0.6;
}
.main {
  width: 300px;
}
.error {
  background-color: #fee;
}
</style>
