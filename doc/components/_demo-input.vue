<template>
  <div class="demo-input">
    <el-input v-model="value" placeholder="请输入内容" clearable />
    <p class="demo-input__text">当前输入：{{ value || '（空）' }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const value = ref('');
</script>

<style lang="less">
@import './_demo-theme.less';

.demo-input {
  padding: 16px;

  &__text {
    margin-top: 12px;
    color: @demo-text;
    font-size: 14px;
  }
}
</style>
