// Mastra 核心配置文件
import { Mastra } from '@mastra/core/mastra'
import { LibSQLStore } from '@mastra/libsql'
import { PinoLogger } from '@mastra/loggers'
import { weatherAgent } from './agents/weather-agent'
import { weatherWorkflow } from './workflows/weather-workflow'

// 创建并配置 Mastra 实例
export const mastra = new Mastra({
  workflows: { weatherWorkflow }, // 注册天气工作流
  agents: { weatherAgent }, // 注册天气智能体
  storage: new LibSQLStore({
    // 将可观测性数据、评分等存储到内存中，如需持久化请改为 file:../mastra.db
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry: {
    // 遥测功能已弃用，将在11月4日版本中移除
    enabled: false,
  },
  observability: {
    // 启用默认导出器和云导出器进行AI追踪
    default: { enabled: true },
  },
})
