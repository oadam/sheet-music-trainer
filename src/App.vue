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

const lastGuesses = ref(new EvictingMultiMap<number, Guess>());
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
      lastGuesses.value = new EvictingMultiMap(JSON.parse(storedLastGuesses));
    } catch (e) {
      console.error(e);
    }
  }
});
const DEFAULT_SETTINGS = {
  extraBars: 1,
  lang: "fr" as "fr" | "en",
  clef: "treble" as "treble" | "bass",
  guessTime: 1.5,
  goodThreshold: 0.8,
  perfectThreshold: 0.99,
  goodScarcity: 3,
  perfectScarcity: 10,
  takeStatsOver: 20,
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
const reset = () => lastGuesses.value.clear();
const toggleNote = (note: number) =>
  hiddenNotes.value.has(note)
    ? hiddenNotes.value.delete(note)
    : hiddenNotes.value.add(note);
const gameNote = ref(23);
const hoveredNote = ref(null as number | null);
const ENGLISH_NOTES = ["C", "D", "E", "F", "G", "A", "B"];
const FRENCH_NOTES = ["Do", "Ré", "Mi", "Fa", "Sol", "La", "Si", "Do"];
const langNotes = computed(() =>
  settings.value.lang == "fr" ? FRENCH_NOTES : ENGLISH_NOTES
);
const vecflowNote = computed(() => {
  const note = state.value == "paused" ? hoveredNote.value : gameNote.value;
  if (note === null) {
    return null;
  } else {
    return getNoteLabel(note, ENGLISH_NOTES) + getNoteOctave(note);
  }
});
const langNote = computed(() => getNoteLabel(gameNote.value, langNotes.value));
interface Stat {
  note: number;
  label: string;
  guessesCount: number;
  avgDuration: number;
  percentCorrect: number;
}
const clefMinNote = computed(() =>
  settings.value.clef === "treble" ? 30 : 18
);
const minNote = computed(
  () => clefMinNote.value - 2 * settings.value.extraBars
);
const maxNote = computed(
  () => clefMinNote.value + 8 + 2 * settings.value.extraBars
);
const stats = computed<Stat[]>(() => {
  const result: Stat[] = [];
  for (let note = maxNote.value; note >= minNote.value; note--) {
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
    if (n == gameNote.value) {
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
  gameNote.value = chooseNextNote();
  clearTimeout(guessTimeout);
  guessTimeoutStarted.value = Date.now();
  guessTimeout = setTimeout(() => {
    state.value = "error";
    lastGuesses.value.add(
      gameNote.value,
      {
        failed: true,
        duration: settings.value.guessTime,
      },
      settings.value.takeStatsOver
    );
  }, settings.value.guessTime * 1000);
};

window.onkeydown = (e) => {
  if (e.key == "p") {
    state.value = "paused";
    return;
  }
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
      lastGuesses.value.add(
        gameNote.value,
        {
          failed: !goodGuess,
          duration: goodGuess
            ? (Date.now() - guessTimeoutStarted.value) / 1000
            : settings.value.guessTime,
        },
        settings.value.takeStatsOver
      );
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
      <div v-if="state == 'paused'">Game is paused. Press "s" to start</div>
      <div v-else>Game is started. Press "p" to pause</div>
      <Vecflow :clef="settings.clef" :note="vecflowNote" />
      <div class="error" v-if="state == 'error'">
        This note is {{ langNote }} ! <br />Press {{ noteKeytouch }} to continue
      </div>
    </div>
    <div class="stats">
      <h2>
        Stats
        <small><a @click="reset">reset</a></small>
      </h2>
      <div
        v-for="stat in stats"
        :key="stat.note"
        class="stat"
        :class="{ hidden: hiddenNotes.has(stat.note) }"
        @click="toggleNote(stat.note)"
        @mouseenter="hoveredNote = stat.note"
        @mouseleave="hoveredNote = null"
      >
        <input type="checkbox" :checked="!hiddenNotes.has(stat.note)" />
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
        >Clef :
        <select v-model="settings.clef">
          <option value="treble">Treble</option>
          <option value="bass">Bass</option>
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
        >Guess time in seconds :
        <input type="number" min="0.1" step="0.1" v-model="settings.guessTime"
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
      <label
        >Sample size for rating :
        <input type="number" v-model="settings.takeStatsOver"
      /></label>
    </aside>
  </div>
  <footer>
    Source code hosted on
    <a href="https://github.com/oadam/sheet-music-trainer">github</a>
  </footer>
</template>

<style scoped>
h2 small {
  font-size: 10px;
}
a {
  cursor: pointer;
}
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
.stat {
  cursor: pointer;
}
.stat.hidden {
  opacity: 0.6;
}
.main {
  width: 300px;
}
.error {
  background-color: #fee;
  color: black;
}
</style>
