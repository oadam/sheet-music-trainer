<script setup lang="ts">
import { OPTIMIZE_FOR_IDS, Settings } from "./Settings";

const value = defineModel<Settings>({ required: true });
</script>

<template>
  <aside class="settings">
    <h2>Settings</h2>
    <label
      >Extra bars :
      <select v-model="value.extraBars">
        <option v-for="o in 4" :value="o - 1">
          {{ o - 1 }}
        </option>
      </select>
    </label>
    <label
      >Clef :
      <select v-model="value.clef">
        <option value="treble">Treble</option>
        <option value="bass">Bass</option>
      </select>
    </label>
    <label
      >Lang :
      <select v-model="value.lang">
        <option value="fr">French</option>
        <option value="en">English</option>
      </select>
    </label>
    <div class="radio-block">
      Optimize for :
      <div class="radio-container">
        <div v-for="m in OPTIMIZE_FOR_IDS">
          <input
            :id="'settings-' + m"
            :value="m"
            type="radio"
            v-model="value.optimizeFor"
          />
          <label class="radio-label" :for="'settings-' + m">{{ m }}</label>
        </div>
      </div>
    </div>
    <label
      >Good notes scarcity : <input type="number" v-model="value.goodScarcity"
    /></label>
    <label
      >Bad notes abondance : <input type="number" v-model="value.badAbondance"
    /></label>
    <label
      >Wrong guess speed score :
      <input type="number" step="0.1" v-model="value.badGuessTime"
    /></label>
    <label
      >Sample size for rating :
      <input type="number" v-model="value.takeStatsOver"
    /></label>
    <label
      >Min sample size : <input type="number" v-model="value.minSampleSize"
    /></label>
  </aside>
</template>

<style scoped>
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
</style>
