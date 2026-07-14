<template>
  <div class="demo-button-play">
    <el-button type="primary" @click="count++">主要按钮 {{ count }}</el-button>
    <el-button type="success">成功按钮</el-button>
    <el-button type="warning">警告按钮</el-button>
    <el-button type="danger">危险按钮</el-button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const count = ref(0);
</script>

<style scoped>
.demo-button-play {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px;
}
</style>
