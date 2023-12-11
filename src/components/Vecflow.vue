<script setup lang="ts">
import { onMounted, watch } from "vue";
import { Vex } from "vexflow";

const props = defineProps<{
  clef: "treble";
  note: string;
}>();

const onNote = (note: string) => {
  const div = document.getElementById("vecflowDiv");
  if (!div) {
    return;
  }
  div.innerHTML = "";
  const vf = new Vex.Flow.Factory({
    renderer: { width: 150, height: 150, elementId: "vecflowDiv" },
  });
  const score = vf.EasyScore();
  const system = vf.System();
  system
    .addStave({
      voices: [score.voice(score.notes(note + "/w"))],
    })
    .addClef(props.clef)
    .addTimeSignature("4/4");

  vf.draw();
};

onMounted(() => onNote(props.note));
watch(() => props.note, onNote);
</script>

<template>
  <div id="vecflowDiv"></div>
</template>

<style scoped>
  #vecflowDiv {
    background: white;
  }
</style>
