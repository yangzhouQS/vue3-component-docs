<template>
  <div class="demo-card">
    <el-card class="demo-card__item" shadow="hover">
      <template #header>
        <span class="demo-card__title">卡片标题</span>
      </template>
      <p class="demo-card__content">卡片内容，用于展示一组相关信息。</p>
    </el-card>
  </div>
</template>

<script setup lang="ts"></script>

<style lang="less">
@demo-border: #ebeef5;
@demo-text: #606266;

.demo-card {
  padding: 16px;

  &__item {
    border-color: @demo-border;
  }

  &__title {
    font-weight: 600;
    color: @demo-text;
  }

  &__content {
    margin: 0;
    color: @demo-text;
    line-height: 1.6;
  }
}
</style>
