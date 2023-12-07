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
  langNotes[Math.floor(note % 7)] + getNoteOctave(note);

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
const MIN_NOTE = 23;
const MAX_NOTE = 44;
const ALL_NOTES = Array.from(
  { length: MAX_NOTE - MIN_NOTE + 1 },
  (_value, index) => MIN_NOTE + index
);
const settings = ref({
  minNote: 28,
  maxNote: 28 + 3,
  goodThreshold: 0.8,
  perfectThreshold: 0.99,
  goodScarcity: 3,
  perfectScarcity: 10,
});
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
      settings.value = JSON.parse(storedSettings);
    } catch (e) {
      console.error(e);
    }
  }
});
const note = ref(28);
const ENGLISH_NOTES = ["C", "D", "E", "F", "G", "A", "B"];
const FRENCH_NOTES = ["Do", "Ré", "Mi", "Fa", "Sol", "La", "Si", "Do"];
const lang = ref<"fr" | "en">("fr");
const langNotes = computed(() =>
  lang.value == "fr" ? FRENCH_NOTES : ENGLISH_NOTES
);
const minNoteOptions = computed(() =>
  ALL_NOTES.map((note) => ({
    label: getNoteFullLabel(note, langNotes.value),
    value: note,
    disabled: note >= settings.value.maxNote,
  }))
);
const maxNoteOptions = computed(() =>
  ALL_NOTES.map((note) => ({
    label: getNoteFullLabel(note, langNotes.value),
    value: note,
    disabled: note <= settings.value.minNote,
  }))
);
const englishNote = computed(
  () => getNoteLabel(note.value, ENGLISH_NOTES) + getNoteOctave(note.value)
);
const langNote = computed(() => getNoteLabel(note.value, langNotes.value));
interface Stat {
  note: number;
  label: string;
  avgDuration: number;
  percentCorrect: number;
}
const stats = computed<Stat[]>(() =>
  Array.from(lastGuesses.value.values.entries(), ([note, guesses]) => {
    const percentCorrect =
      guesses.reduce((sum, g) => (g.failed ? 0 : 1) + sum, 0) / guesses.length;

    return {
      note,
      label: getNoteFullLabel(note, langNotes.value),
      avgDuration:
        guesses.reduce((sum, g) => g.duration + sum, 0) / guesses.length,
      percentCorrect,
    };
  })
);
const noteKeytouch = computed(() => langNote.value[0].toLowerCase());
const state = ref<"paused" | "started" | "error">("paused");
const guessTime = ref(1000);
const guessTimeoutStarted = ref(0);
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
  for (let n = settings.value.minNote; n <= settings.value.maxNote; n++) {
    if (n == note.value) {
      continue;
    }
    const percentCorrect = statsMap.get(n)?.percentCorrect || 0;
    let prob: number;
    if (percentCorrect > settings.value.perfectThreshold) {
      prob = 1 / settings.value.perfectScarcity;
    } else if (percentCorrect > settings.value.goodThreshold) {
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
      duration: guessTime.value,
    });
  }, guessTime.value);
};

window.onkeydown = (e) => {
  switch (e.key) {
    case "p":
      state.value = "paused";
      break;
    case "s":
      if (state.value != "started") {
        state.value = "started";
      }
      break;
    default:
      if (state.value == "paused") {
        return;
      }
      const failed = e.key != noteKeytouch.value;
      if (state.value == "started") {
        lastGuesses.value.add(note.value, {
          failed: failed,
          duration: failed
            ? guessTime.value
            : Date.now() - guessTimeoutStarted.value,
        });
        if (failed) {
          state.value = "error";
        } else {
          start();
        }
      } else if (state.value == "error" && !failed) {
        state.value = "started";
      }
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
        :note="englishNote"
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
      <div v-for="stat in stats">
        {{ stat.label }}:
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
        >Min note :
        <select v-model="settings.minNote">
          <option
            v-for="o in minNoteOptions"
            :value="o.value"
            :disabled="o.disabled"
          >
            {{ o.label }}
          </option>
        </select>
      </label>
      <label
        >Max note :
        <select v-model="settings.maxNote">
          <option
            v-for="o in maxNoteOptions"
            :value="o.value"
            :disabled="o.disabled"
          >
            {{ o.label }}
          </option>
        </select>
      </label>
      <label
        >Lang :
        <select v-model="lang">
          <option value="fr">French</option>
          <option value="en">English</option>
        </select>
      </label>
      <label
        >Guess time in ms : <input type="number" min="100" v-model="guessTime"
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
        Source code hosted on <a href="https://github.com/oadam/sheet-music-trainer">github</a>

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
.main {
  width: 300px;
}
.error {
  background-color: #fee;
}
</style>
