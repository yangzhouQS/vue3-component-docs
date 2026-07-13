<template>
  <div class="demo-button">
    <el-button type="primary" @click="handleClick">主要按钮</el-button>
    <el-button type="success">成功按钮</el-button>
    <el-button type="warning">警告按钮</el-button>
    <el-button type="danger">危险按钮</el-button>
    <p class="demo-button__text">点击次数：{{ count }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const count = ref(0);

const handleClick = () => {
  count.value += 1;
};
</script>

<style lang="less">
@demo-primary: #409eff;

.demo-button {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 16px;

  &__text {
    width: 100%;
    margin-top: 8px;
    color: @demo-primary;
    font-size: 14px;
  }
}
</style>
