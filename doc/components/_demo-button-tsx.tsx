import { defineComponent, ref } from 'vue';
import { ElButton } from 'element-plus';
import './_demo-button-tsx.less';

export default defineComponent({
  name: 'DemoButtonTsx',
  setup() {
    const count = ref(0);

    const handleClick = () => {
      count.value += 1;
    };

    return () => (
      <div class="demo-button-tsx">
        <ElButton type="primary" onClick={handleClick}>
          TSX 主要按钮
        </ElButton>
        <ElButton type="success">TSX 成功按钮</ElButton>
        <ElButton type="warning">TSX 警告按钮</ElButton>
        <ElButton type="danger">TSX 危险按钮</ElButton>
        <p class="demo-button-tsx__text">TSX 点击次数：{count.value}</p>
      </div>
    );
  },
});
