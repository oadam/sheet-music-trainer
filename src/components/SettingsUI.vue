<script setup lang="ts">
import { OPTIMIZE_FOR_IDS, Settings } from "../types/Settings";

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
    <div class="radio-block">
      Clef :
      <div class="radio-container">
        <div v-for="m in ['treble', 'bass', 'both']">
          <input
            :id="'settings-clef-' + m"
            :value="m"
            type="radio"
            v-model="value.clef"
          />
          <label class="radio-label" :for="'settings-clef-' + m">{{ m }}</label>
        </div>
      </div>
    </div>
    <label
      >Lang :
      <select v-model="value.lang">
        <option value="fr">French</option>
        <option value="en">English</option>
      </select>
    </label>
    <h3 @click="value.showAdvancedSettings = !value.showAdvancedSettings">
      Advanced settings {{ value.showAdvancedSettings ? "▾" : "▸" }}
    </h3>
    <template v-if="value.showAdvancedSettings">
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
        >Good notes scarcity :
        <input type="number" v-model="value.goodScarcity"
      /></label>
      <label
        >Bad notes abondance :
        <input type="number" v-model="value.badAbondance"
      /></label>
      <label
        >Wrong guess time in seconds :
        <input type="number" v-model="value.badGuessTime"
      /></label>
      <label
        >Sample size for rating :
        <input type="number" v-model="value.takeStatsOver"
      /></label>
      <label
        >Min sample size : <input type="number" v-model="value.minSampleSize"
      /></label>
    </template>
  </aside>
</template>

<style scoped>
h3 {
  cursor: pointer;
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
</style>
