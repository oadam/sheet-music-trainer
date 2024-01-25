<script setup lang="ts">
import Vecflow from "./components/Vecflow.vue";
import Note, { DisplayNote, Rating } from "./components/Note.vue";
import SettingsUI from "./components/SettingsUI.vue";
import { computed, onMounted, ref, watch } from "vue";
import EvictingMultiMap from "./types/EvictingMultiMap";
import {
  Guess,
  OptimizeFor,
  OptimizeForAccuracy,
  OptimizeForSpeed,
} from "./types/OptimizeFor";
import { useSettings } from "./types/Settings";
import { Clef, BASS, TREBLE, BOTH } from "./types/Clef";

const getNoteOctave = (note: number) => Math.floor(note / 7);
const getNoteLabel = (note: number, langNotes: string[]) =>
  langNotes[Math.floor(note % 7)];
const getNoteFullLabel = (note: number, langNotes: string[]) =>
  langNotes[Math.floor(note % 7)] +
  String.fromCharCode("₀".charCodeAt(0) + getNoteOctave(note));

const lastGuesses = ref(new EvictingMultiMap<string, Guess>());
const settings = useSettings();

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
const hiddenNotes = ref(new Set<string>());
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
const clef = computed<Clef>(() => {
  switch (settings.value.clef) {
    case "treble":
      return TREBLE;
    case "bass":
      return BASS;
    case "both":
      return BOTH;
    default:
      return TREBLE;
  }
});
const encodeClefNote = (note: number) => clef.value.encodeNote(note);
const reset = () => lastGuesses.value.clear();
const checkAll = () =>
  allNotes.value.forEach((n) => hiddenNotes.value.delete(encodeClefNote(n)));
const uncheckAll = () =>
  allNotes.value.forEach((n) => hiddenNotes.value.add(encodeClefNote(n)));
const toggleNote = (n: number) => {
  hiddenNotes.value.has(encodeClefNote(n))
    ? hiddenNotes.value.delete(encodeClefNote(n))
    : hiddenNotes.value.add(encodeClefNote(n));
};
const gameNote = ref(23);
const hoveredNote = ref(null as number | null);
const ENGLISH_NOTES = ["C", "D", "E", "F", "G", "A", "B"];
const FRENCH_NOTES = ["Do", "Ré", "Mi", "Fa", "Sol", "La", "Si", "Do"];
const langNotes = computed(() =>
  settings.value.lang == "fr" ? FRENCH_NOTES : ENGLISH_NOTES
);
const vecflowNote = computed<{ first: string | null; second: string | null }>(
  () => {
    const note = state.value == "paused" ? hoveredNote.value : gameNote.value;
    if (note === null) {
      return { first: null, second: null };
    }
    const position = clef.value.getNotePosition(note);
    const vecflowName = getNoteLabel(note, ENGLISH_NOTES) + getNoteOctave(note);
    switch (position) {
      case "first":
        return { first: vecflowName, second: null };
      case "second":
        return { first: null, second: vecflowName };
      default:
        throw new Error("unsupported position");
    }
  }
);
const langNote = computed(() => getNoteLabel(gameNote.value, langNotes.value));

const minNote = computed(() => clef.value.getMinNote(settings.value.extraBars));
const maxNote = computed(() => clef.value.getMaxNote(settings.value.extraBars));
const allNotes = computed(() =>
  Array.from(
    { length: maxNote.value - minNote.value + 1 },
    (_x, i) => minNote.value + i
  )
);
const optimizeFor = computed<OptimizeFor>(() => {
  const badGuessTime =
    average.value === undefined
      ? 10
      : average.value * settings.value.badGuessTimesAverage;
  switch (settings.value.optimizeFor) {
    case "speed":
      return new OptimizeForSpeed(badGuessTime);
    case "accuracy":
      return OptimizeForAccuracy;
    default:
      return OptimizeForAccuracy;
  }
});
const worstBadness = computed(() =>
  optimizeFor.value.getWorstBadness(badnesses.value.values())
);
const bestBadness = computed(() =>
  optimizeFor.value.getBestBadness(badnesses.value.values())
);

const badnesses = computed<Map<number, number>>(() => {
  const result = new Map<number, number>();
  for (const note of nonHiddenNotes.value) {
    const guesses = lastGuesses.value.values.get(encodeClefNote(note));
    const guessesCount = guesses?.length || 0;
    if (guessesCount >= settings.value.minSampleSize) {
      const badness =
        guesses!.reduce(
          (sum, g) => optimizeFor.value.getGuessBadness(g) + sum,
          0
        ) / guesses!.length;
      result.set(note, badness);
    }
  }
  return result;
});

const scores = computed(
  () =>
    Array.from(badnesses.value.values())
      .filter((s) => s !== undefined)
      .sort() as number[]
);

const average = computed<number | undefined>(() => {
  const s = scores.value;
  if (s.length == 0) {
    return undefined;
  }
  return s.reduce((s, v) => s + v, 0) / s.length;
});

const thresholds = computed<{
  good: number | undefined;
  bad: number | undefined;
}>(() => {
  const s = scores.value;
  if (s.length <= 3) {
    return { good: undefined, bad: undefined };
  }
  const median = s[s.length / 2];
  const good = s
    .slice(0, s.length / 3)
    .reverse()
    .find((s) => s != median);
  if (good === undefined) {
    // nobody is better than median, hence we'll subdivide in good and medium (no bads)
    return {
      good: median,
      bad: undefined,
    };
  } else {
    return {
      good,
      bad: s.slice((s.length * 2) / 3).find((s) => s != median),
    };
  }
});

const displayNotes = computed<DisplayNote[]>(() => {
  // precall all computed to avoid perf issue in loop
  const langNotesValue = langNotes.value;
  const badnessesValue = badnesses.value;
  const thresholdsValue = thresholds.value;
  const hiddenNotesValue = hiddenNotes.value;
  const optimizeForValue = optimizeFor.value;
  const worst = worstBadness.value;
  const best = bestBadness.value;
  return allNotes.value
    .map((note) => {
      const label = getNoteFullLabel(note, langNotesValue);
      let rating: Rating | undefined;
      let percentValue: number | undefined;
      let badnessDescription: string | undefined;
      const badness = badnessesValue.get(note);
      if (badness !== undefined) {
        badnessDescription = optimizeForValue.getBadnessDescription(badness);
        percentValue = (100 * (worst - badness)) / (worst - best);
        if (
          thresholdsValue.good !== undefined &&
          badness <= thresholdsValue.good
        ) {
          rating = "good";
        } else if (
          thresholdsValue.bad !== undefined &&
          badness >= thresholdsValue.bad
        ) {
          rating = "bad";
        } else {
          rating = "medium";
        }
      }
      return {
        note,
        hidden: hiddenNotesValue.has(encodeClefNote(note)),
        label,
        rating,
        percentValue,
        badnessDescription,
      };
    })
    .reverse();
});

const noteKeytouch = computed(() => langNote.value[0].toLowerCase());
const state = ref<"paused" | "started" | "error">("paused");
const guessStartedTimestamp = ref(0);
watch(state, (s) => {
  if (s == "started") {
    start();
  }
});

const nonHiddenNotes = computed<number[]>(() =>
  allNotes.value.filter((n) => !hiddenNotes.value.has(encodeClefNote(n)))
);
const chooseNextNote = () => {
  let totalProb = 0;
  let candidates: { totalProbAfter: number; note: number }[] = [];
  const statMap = new Map<number, DisplayNote>();
  for (const d of displayNotes.value) {
    statMap.set(d.note, d);
  }
  for (const n of nonHiddenNotes.value) {
    if (n == gameNote.value) {
      continue;
    }
    const s = statMap.get(n);
    let prob: number;
    if (!s || s.rating === undefined) {
      prob = 1;
    } else if (s.rating === "good") {
      prob = 1 / settings.value.goodScarcity;
    } else if (s.rating === "bad") {
      prob = settings.value.badAbondance;
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
  guessStartedTimestamp.value = Date.now();
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
        encodeClefNote(gameNote.value),
        {
          failed: !goodGuess,
          duration: (Date.now() - guessStartedTimestamp.value) / 1000,
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
      <div class="vecflows">
        <Vecflow :clef="clef.firstVecflowClef" :note="vecflowNote.first" />
        <Vecflow
          v-if="clef.secondVecflowClef"
          class="second-vecflow"
          :clef="clef.secondVecflowClef"
          :note="vecflowNote.second"
        />
      </div>
      <div class="error" v-if="state == 'error'">
        This note is {{ langNote }} ! <br />Press {{ noteKeytouch }} to continue
      </div>
    </div>
    <div class="stats">
      <h2>
        Stats
        <div class="stat-buttons">
          <a @click="reset">reset stats</a>
          <a @click="checkAll">check all</a>
          <a @click="uncheckAll">uncheck all</a>
        </div>
      </h2>
      <div class="average" v-if="average !== undefined">
        Average : {{ optimizeFor.getBadnessDescription(average) }}
      </div>
      <Note
        v-for="note in displayNotes"
        :key="'displayed-note-' + note.note"
        :note="note"
        :class="{ hidden: note.hidden }"
        @click="toggleNote(note.note)"
        @mouseenter="hoveredNote = note.note"
        @mouseleave="hoveredNote = null"
      />
    </div>
    <SettingsUI v-model="settings" />
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
.stat-buttons {
  font-size: 10px;
  display: inline-block;
  vertical-align: middle;
  a {
    display: block;
  }
}
.average {
  font-weight: bold;
  margin-bottom: 1em;
  font-size: 14px;
}
.main {
  width: 300px;
}
.error {
  background-color: #fee;
  color: black;
}
.second-vecflow {
  position: relative;
  bottom: 100px;
}
.vecflows {
  background-color: white;
}
</style>
