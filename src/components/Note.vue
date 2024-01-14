<script setup lang="ts">
import Meter from "./Meter.vue";
import { computed } from "vue";
export interface DisplayNote {
  note: number;
  label: string;
  hidden: boolean;
  rating: Rating | undefined;
  percentValue: number | undefined;
  badnessDescription: string | undefined;
}
export type Rating = "bad" | "medium" | "good";

const props = defineProps<{
  note: DisplayNote;
}>();

const meterColor = computed(() => {
  switch (props.note.rating) {
    case "bad":
      return "red";
    case undefined:
      return "pink";
    case "medium":
      return "#ffbd4f";
    case "good":
      return "green";
  }
});
</script>

<template>
  <div class="stat" :class="{ hidden: note.hidden }">
    <input type="checkbox" :checked="!note.hidden" />
    <span class="note-label">
      {{ note.label }}
    </span>

    <Meter
      :percentValue="note.percentValue"
      :title="note.badnessDescription"
      :color="meterColor"
    />
  </div>
</template>

<style scoped>
.note-label {
  display: inline-block;
  width: 2em;
}
.stat {
  cursor: pointer;
  white-space: nowrap;
}
.stat.hidden {
  opacity: 0.6;
}
</style>
