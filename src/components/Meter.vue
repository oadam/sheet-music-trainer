<script setup lang="ts">
defineProps<{
  percentValue: number | undefined;
  color: string;
}>();
</script>

<template>
  <div class="meter">
    <span
      v-if="percentValue !== undefined"
      :style="{ background: color, width: Math.max(5, percentValue) + '%' }"
    ></span>
  </div>
</template>

<style scoped>
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
</style>
