<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from "vue";
import { Vex } from "vexflow";

const props = defineProps<{
  clef: "treble" | "bass";
  note: string | null;
}>();

const id = ref("");

const onNote = () => {
  const div = document.getElementById(id.value);
  if (!div) {
    return;
  }
  div.innerHTML = "";
  const vf = new Vex.Flow.Factory({
    renderer: { width: 300, height: 220, elementId: id.value },
  });
  vf.getContext().scale(2, 2);
  const score = vf.EasyScore();
  const system = vf.System();
  let noteString: string;
  if (props.note !== null) {
    noteString = props.note + "/w";
  } else {
    noteString = (props.clef == "treble" ? "D5" : "F3") + "/1/r";
  }
  system
    .addStave({
      voices: [score.voice(score.notes(noteString, { clef: props.clef }))],
    })
    .addClef(props.clef)
    .addTimeSignature("4/4");

  vf.draw();
};

onMounted(async () => {
  id.value = crypto.randomUUID();
  await nextTick();
  onNote();
});
watch(() => props.note, onNote);
watch(() => props.clef, onNote);
</script>

<template>
  <div :id="id"></div>
</template>
