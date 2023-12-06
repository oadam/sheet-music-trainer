<script setup lang="ts">
import Vecflow from "./components/Vecflow.vue";
import { computed, ref, watch } from "vue";
import EvictingMultipMap from "./types/EvictingMultiMap";

interface Guess {
  failed: boolean;
  duration: number;
}

const lastGuesses = ref(new EvictingMultipMap<number, Guess>(20));
const minNote = ref(28);
const note = ref(minNote.value);
const maxNote = ref(minNote.value + 3);
const noteString = computed(
  () =>
    ["C", "D", "E", "F", "G", "A", "B"][note.value % 7] +
    Math.floor(note.value / 7)
);
const noteFrench = computed(
  () => ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si", "Do"][note.value % 7]
);
const noteKeytouch = computed(() => noteFrench.value[0].toLowerCase());
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
  let newValue = 0;
  do {
    newValue =
      minNote.value +
      Math.floor(Math.random() * (maxNote.value + 1 - minNote.value));
  } while (newValue == note.value);
  return newValue
}

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
      if (e.key == noteKeytouch.value) {
        if (state.value == "started") {
          lastGuesses.value.add(note.value, {
            failed: false,
            duration: Date.now() - guessTimeoutStarted.value,
          });
        }
        start();
      }
  }
};
</script>

<template>
  <h1>Music sheet trainer</h1>
  <p>
    Type the displayed key using your keyboard. Adjust settings on the right.
    <br />Press "s" to start, "p" to pause, "d" for "Do", "r" for "Re"...
  </p>
  <div class="wrapper">
    <div
      class="main"
      :style="{ background: state == 'error' ? '#fee' : '#eee' }"
    >
      <Vecflow
        v-if="state != 'paused'"
        clef="treble"
        :note="noteString"
      ></Vecflow>
      <div v-if="state == 'error'">
        Erreur ! Cette note est {{ noteFrench }} ! <br />Appuyer sur
        {{ noteKeytouch }} pour recommencer
      </div>
    </div>
    <aside class="settings">
      <label
        >Min note : <input type="number" :max="maxNote - 1" v-model="minNote"
      /></label>
      <label
        >Max note : <input type="number" :min="minNote + 1" v-model="maxNote"
      /></label>
      <label
        >Guess time : <input type="number" :min="100" v-model="guessTime"
      /></label>
    </aside>
  </div>
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
  input {
    width: 100%;
  }
}
.main {
  flex: 1 0 auto;
  padding: 1rem;
}
</style>
