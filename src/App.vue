<script setup lang="ts">
import Vecflow from "./components/Vecflow.vue";
import { computed, onMounted, ref, watch } from "vue";
import EvictingMultiMap from "./types/EvictingMultiMap";

interface Guess {
  failed: boolean;
  duration: number;
}
type Mode = "accuracy" | "speed";

const MODES: Mode[] = ["accuracy", "speed"];
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
  badGuessTime: 5,
  takeStatsOver: 10,
  minSampleSize: 3,
  mode: "accuracy" as Mode,
  badAbondance: 3,
  goodScarcity: 3,
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
const checkAll = () => hiddenNotes.value.clear();
const uncheckAll = () =>
  allNotes.value.forEach((n) => hiddenNotes.value.add(n));
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
  badness: number | undefined;
  description: string | undefined;
}

type Rating = "bad" | "medium" | "good";
interface RatedStat extends Stat {
  rating: Rating | undefined;
}

const getRatingColor = (rating: Rating) => {
  switch (rating) {
    case "bad":
      return "red";
    case "medium":
      return "#ffbd4f";
    case "good":
      return "green";
  }
};
const clefMinNote = computed(() =>
  settings.value.clef === "treble" ? 30 : 18
);
const minNote = computed(
  () => clefMinNote.value - 2 * settings.value.extraBars
);
const maxNote = computed(
  () => clefMinNote.value + 8 + 2 * settings.value.extraBars
);
const allNotes = computed(() =>
  Array.from(
    { length: maxNote.value - minNote.value + 1 },
    (_x, i) => minNote.value + i
  )
);
const getGuessBadness = (guess: Guess, mode: Mode, badGuessTime: number) => {
  switch (mode) {
    case "accuracy":
      return guess.failed ? 1 : 0;
    case "speed":
      return guess.failed ? badGuessTime : guess.duration;
  }
};
const getBadnessDescription = (value: number, mode: Mode) => {
  switch (mode) {
    case "accuracy":
      return (100 - 100 * value).toFixed(0) + "%";
    case "speed":
      return value.toFixed(1) + "s";
  }
};
const worstBadness = computed(() => {
  switch (settings.value.mode) {
    case "accuracy":
      return 1;
    case "speed":
      return Math.max(
        ...(stats.value
          .map((s) => s.badness)
          .filter((s) => s !== undefined) as number[])
      );
  }
});

const bestBadness = computed(() => {
  switch (settings.value.mode) {
    case "accuracy":
      return 0;
    case "speed":
      return Math.min(
        ...(stats.value
          .map((s) => s.badness)
          .filter((s) => s !== undefined) as number[])
      );
  }
});

const stats = computed<Stat[]>(() =>
  allNotes.value
    .map((note) => {
      const guesses = lastGuesses.value.values.get(note);
      const guessesCount = guesses?.length || 0;
      const label = getNoteFullLabel(note, langNotes.value);
      const mode = settings.value.mode;
      let badness: number | undefined;
      let description: string | undefined;
      if (guessesCount >= settings.value.minSampleSize) {
        badness =
          guesses!.reduce(
            (sum, g) =>
              getGuessBadness(g, mode, settings.value.badGuessTime) + sum,
            0
          ) / guesses!.length;
        description = getBadnessDescription(badness, mode);
      }
      return {
        note,
        label,
        guessesCount,
        badness,
        description,
      };
    })
    .reverse()
);

const thresholds = computed<{
  good: number | undefined;
  bad: number | undefined;
}>(() => {
  const scores = stats.value
    .map((s) => s.badness)
    .filter((s) => s !== undefined) as number[];
  if (scores.length <= 3) {
    return { good: undefined, bad: undefined };
  }
  scores.sort();
  const median = scores[Math.floor(scores.length / 2)];
  const good = scores
    .slice(0, scores.length / 3)
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
      bad: scores.slice((scores.length * 2) / 3).find((s) => s != median),
    };
  }
});
const ratedStats = computed<RatedStat[]>(() => {
  return stats.value.map((s) => {
    let rating: Rating | undefined;
    if (s.badness === undefined) {
      rating = undefined;
    } else if (
      thresholds.value.bad !== undefined &&
      s.badness >= thresholds.value.bad
    ) {
      rating = "bad";
    } else if (
      thresholds.value.good !== undefined &&
      s.badness <= thresholds.value.good
    ) {
      rating = "good";
    } else {
      rating = "medium";
    }
    return { rating: rating, ...s };
  });
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
  allNotes.value.filter((n) => !hiddenNotes.value.has(n))
);
const chooseNextNote = () => {
  let statsMap = new Map<number, RatedStat>();
  for (const s of ratedStats.value) {
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
    if (!stats || stats.rating === undefined) {
      prob = 1;
    } else if (stats.rating === "good") {
      prob = 1 / settings.value.goodScarcity;
    } else if (stats.rating === "bad") {
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
        gameNote.value,
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
      <Vecflow :clef="settings.clef" :note="vecflowNote" />
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
      <div
        v-for="stat in ratedStats"
        :key="'stat-' + stat.note"
        class="stat"
        :class="{ hidden: hiddenNotes.has(stat.note) }"
        @click="toggleNote(stat.note)"
        @mouseenter="hoveredNote = stat.note"
        @mouseleave="hoveredNote = null"
      >
        <input type="checkbox" :checked="!hiddenNotes.has(stat.note)" />
        <span class="note-label">
          {{ stat.label }}
        </span>
        <div
          class="meter"
          :min="-worstBadness"
          :value="-stat.badness!"
          :title="stat.description"
        >
          <span
            v-if="stat.rating !== undefined"
            :style="{background: getRatingColor(stat.rating), width: Math.max(0.05, ((worstBadness - stat.badness!) / (worstBadness - bestBadness)))*100+'%'}"
          ></span>
        </div>
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
      <div class="radio-block">
        Optimize for :
        <div class="radio-container">
          <div v-for="m in MODES">
            <input
              :id="'settings-' + m"
              :value="m"
              type="radio"
              v-model="settings.mode"
            />
            <label class="radio-label" :for="'settings-' + m">{{ m }}</label>
          </div>
        </div>
      </div>
      <label
        >Good notes scarcity :
        <input type="number" v-model="settings.goodScarcity"
      /></label>
      <label
        >Bad notes abondance :
        <input type="number" v-model="settings.badAbondance"
      /></label>
      <label
        >Wrong guess speed score :
        <input type="number" step="0.1" v-model="settings.badGuessTime"
      /></label>
      <label
        >Sample size for rating :
        <input type="number" v-model="settings.takeStatsOver"
      /></label>
      <label
        >Min sample size :
        <input type="number" v-model="settings.minSampleSize"
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
.meter {
  display: inline-block;
  vertical-align: middle;
  width: 5em;
  height: 14px;
  box-sizing: border-box;
  border-radius: 1em;
  overflow: hidden;
  border: solid 1px #999;
  span {
    display: inline-block;
    height: 100%;
    vertical-align: top;
  }
}
.note-label {
  display: inline-block;
  width: 2em;
}
aside {
  float: right;
  label {
    display: block;
  }
  label,
  .radio-block {
    padding-bottom: 1rem;
  }
  .radio-container {
    display: inline-block;
    vertical-align: top;
  }
  .radio-label {
    display: inline;
  }
}
.stat-buttons {
  font-size: 10px;
  display: inline-block;
  vertical-align: middle;
  a {
    display: block;
  }
}
.stat {
  cursor: pointer;
  white-space: nowrap;
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
