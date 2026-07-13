import { defineComponent } from 'vue';
import { ElAlert } from 'element-plus';

export default defineComponent({
  name: 'DemoAlertTsx',
  setup() {
    return () => (
      <div
        style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <ElAlert title="成功提示的文案" type="success" />
        <ElAlert title="消息提示的文案" type="info" />
        <ElAlert title="警告提示的文案" type="warning" />
        <ElAlert title="错误提示的文案" type="error" />
      </div>
    );
  },
});
