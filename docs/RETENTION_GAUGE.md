# 保留率仪表盘功能说明

## 📊 功能概述

在主页侧边栏仪表盘中添加了一个**汽车指针仪表盘**来可视化展示学习保留率（Retention Rate）。

## 🎨 设计特点

### 1. 仪表盘样式

- **半圆弧设计**: 类似汽车速度表的半圆形仪表
- **动态指针**: 根据保留率旋转指针角度
- **渐变色彩**: 根据保留率自动变色
- **平滑动画**: 1秒缓动动画效果

### 2. 颜色编码

| 保留率范围 | 颜色              | 评级              | 说明   |
| ---------- | ----------------- | ----------------- | ------ |
| ≥ 90%      | 🟢 绿色 (#4caf50) | Excellent         | 优秀   |
| 80-89%     | 🟢 浅绿 (#8bc34a) | Good              | 良好   |
| 70-79%     | 🟡 黄色 (#ffc107) | Fair              | 一般   |
| 60-69%     | 🟠 橙色 (#ff9800) | Needs Improvement | 需改进 |
| < 60%      | 🔴 红色 (#f44336) | Poor              | 较差   |

### 3. 指针角度映射

- **0%**: -90° (最左侧)
- **50%**: 0° (中间位置)
- **100%**: 90° (最右侧)

## 💻 技术实现

### 数据来源

```typescript
// 从 DashboardStats 获取保留率
interface DashboardStats {
  retentionRate: number; // 0-1 范围
  // ... 其他字段
}
```

### SVG 结构

```html
<svg viewBox="0 0 160 100">
  <!-- 背景弧线 -->
  <path class="gauge-background" d="M 20 80 A 60 60 0 0 1 140 80" />

  <!-- 彩色填充弧线 -->
  <path class="gauge-fill" stroke-dasharray="188.5" stroke-dashoffset="动态计算" />

  <!-- 指针 -->
  <g class="gauge-needle" transform="rotate(角度)">
    <line x1="80" y1="80" x2="80" y2="30" />
  </g>

  <!-- 中心圆点 -->
  <circle cx="80" cy="80" r="6" />
</svg>
```

### JavaScript 更新逻辑

```javascript
function updateRetentionGauge(rate) {
  // 1. 更新百分比文本
  const percentage = Math.round(rate * 100);

  // 2. 计算弧线填充
  const fillOffset = 188.5 * (1 - rate);

  // 3. 根据保留率设置颜色
  const color = getColorByRate(rate);

  // 4. 旋转指针
  const needleAngle = -90 + rate * 180;
}
```

## 📐 计算公式

### 保留率计算

```
保留率 = (Good 评分 + Easy 评分) / 总评分次数

示例:
- Again: 5 次
- Hard: 10 次
- Good: 50 次
- Easy: 35 次
-------------------
总计: 100 次
保留率 = (50 + 35) / 100 = 0.85 = 85%
```

### 弧线填充计算

```
弧长 ≈ 188.5 (半圆周长)
填充偏移 = 弧长 × (1 - 保留率)

示例 (85% 保留率):
偏移 = 188.5 × (1 - 0.85) = 28.275
```

## 🎯 用户体验

### 视觉反馈

1. **加载动画**: 仪表盘从 0% 平滑过渡到实际值
2. **颜色变化**: 保留率变化时，弧线颜色平滑过渡
3. **指针旋转**: 使用 CSS transition 实现流畅旋转

### 信息层次

```
┌─────────────────────────────┐
│  Retention Rate (标题)      │
│  ┌─────────────────┐        │
│  │   [仪表盘]      │        │
│  │    /|\         │        │
│  │   ━━━━━        │        │
│  └─────────────────┘        │
│        85% (数值)           │
│  Good/Easy Reviews (说明)   │
└─────────────────────────────┘
```

## 🔄 实时更新

仪表盘在以下情况下更新：

1. 侧边栏首次加载
2. 用户点击"🔄 Refresh"
3. 侧边栏重新可见时
4. 完成复习后（通过消息通知）

## 📱 响应式设计

仪表盘使用相对单位，自适应侧边栏宽度：

- 容器宽度: 固定 160px
- SVG viewBox: 保持比例
- 在小屏幕上保持可读性

## 🎨 主题适配

使用 VS Code CSS 变量，自动适配主题：

```css
background: var(--vscode-input-background)
color: var(--vscode-textLink-foreground)
border: var(--vscode-input-border)
```

## 🚀 未来优化

1. **动画增强**: 添加弹性效果
2. **交互提示**: 悬停显示详细统计
3. **历史趋势**: 显示保留率变化曲线
4. **目标设定**: 用户可设置目标保留率
5. **声音反馈**: 达到里程碑时播放音效

## 📊 性能考虑

- **SVG 优化**: 使用 path 而非多个元素
- **CSS 动画**: 硬件加速的 transform
- **按需渲染**: 仅在数据变化时更新
- **内存占用**: 单个 SVG 元素，轻量级

## 🧪 测试建议

### 边界值测试

- 0% 保留率（全部 Again）
- 100% 保留率（全部 Good/Easy）
- 50% 保留率（中间值）

### 视觉测试

- 浅色主题
- 深色主题
- 高对比度主题

### 动画测试

- 首次加载动画
- 数据更新动画
- 颜色过渡效果

## 📝 代码位置

- **主文件**: `src/webview/dashboardViewProvider.ts`
- **数据源**: `src/storage/stats.ts` (calculateDashboardStats)
- **类型定义**: `src/storage/schema.ts` (DashboardStats)

---

**实现日期**: 2025-12-04  
**版本**: v0.1.0
