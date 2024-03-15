<script setup lang="ts">
import Note, { DisplayNote, Rating } from "./components/Note.vue";
import SettingsUI from "./components/SettingsUI.vue";
import { computed, defineAsyncComponent, onMounted, ref, watch } from "vue";
import EvictingMultiMap from "./types/EvictingMultiMap";
import {
  Guess,
  OptimizeFor,
  OptimizeForAccuracy,
  OptimizeForSpeed,
} from "./types/OptimizeFor";
import { useSettings } from "./types/Settings";
import { Clef, BASS, TREBLE, BOTH } from "./types/Clef";
const Vecflow = defineAsyncComponent(() => import("./components/Vecflow.vue"));

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
const displayedNote = computed<number>(
  () => {
    switch (state.value) {
      case "paused":
        return hoveredNote.value;
      case "error":
        return hoveredNote.value || gameNote.value;
      case "started":
        return gameNote.value;
      default:
        throw new Error('unknown state');
    }
});
const vecflowNote = computed<{ first: string | null; second: string | null }>(
  () => {
    const note = displayedNote.value;
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
  switch (settings.value.optimizeFor) {
    case "speed":
      return new OptimizeForSpeed(settings.value.badGuessTime);
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

const displayNotes = computed<DisplayNote[]>(() => {
  const suboptimalEntries = [...badnesses.value.entries()].filter(
    ([_n, badness]) => badness > bestBadness.value
  );
  suboptimalEntries.sort(([_a, aBad], [_b, bBad]) => {
    return bBad! - aBad!;
  });
  const suboptimalNotes = suboptimalEntries.map(([n, _badness]) => n);
  const batchMaxSize = Math.round(allNotes.value.length / 3);
  const badNotesCount = Math.min(settings.value.badMaxSize, batchMaxSize);
  const mediumNotesCount = Math.min(settings.value.mediumMaxSize, batchMaxSize);
  const badNotes = new Set(suboptimalNotes.slice(0, badNotesCount));
  const mediumNotes = new Set(
    suboptimalNotes.slice(badNotesCount, badNotesCount + mediumNotesCount)
  );
  return allNotes.value
    .map((note) => {
      const label = getNoteFullLabel(note, langNotes.value);
      const badness = badnesses.value.get(note);
      let rating: Rating | undefined;
      let percentValue: number | undefined;
      let badnessDescription: string | undefined;
      if (badness !== undefined) {
        badnessDescription = optimizeFor.value.getBadnessDescription(badness);
        percentValue =
          (100 * (worstBadness.value - badness!)) /
          (worstBadness.value - bestBadness.value);
        if (badNotes.has(note)) {
          rating = "bad";
        } else if (mediumNotes.has(note)) {
          rating = "medium";
        } else {
          rating = "good";
        }
      }
      return {
        note,
        hidden: hiddenNotes.value.has(encodeClefNote(note)),
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
    const rating = s?.rating || "bad";
    let prob: number;
    if (rating === "good") {
      prob = 1 / settings.value.goodScarcity;
    } else if (rating === "bad") {
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
      <div class="error" v-else-if="state == 'error'">
        This note is {{ langNote }} ! <br />Press {{ noteKeytouch }} to continue
      </div>
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
      <div
        :style="{ visibility: state == 'started' ? 'hidden' : 'visible' }"
        class="notes"
      >
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
.notes {
  column-count: 2;
}
</style>
