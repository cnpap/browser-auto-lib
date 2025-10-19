import process from 'node:process'
import { createOpenAI } from '@ai-sdk/openai'
import { Agent } from '@mastra/core/agent'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'
import { weatherTool } from '../tools/weather-tool'

// 配置阿里百炼平台的 OpenAI 兼容接口
const openAI = createOpenAI({
  baseURL:
    process.env.OPENAI_BASE_URL
    || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.OPENAI_API_KEY,
})

// 创建天气智能体
export const weatherAgent = new Agent({
  name: '天气助手',
  instructions: `
      你是一个有用的天气助手，能够提供准确的天气信息并帮助用户根据天气规划活动。

      你的主要功能是帮助用户获取特定地点的天气详情。在回复时请遵循以下原则：
      - 如果用户没有提供地点，请主动询问
      - 如果地点名称不是中文，请将其翻译为中文
      - 如果地点包含多个部分（如"北京市朝阳区"），使用最相关的部分（如"北京"）
      - 包含相关的详细信息，如湿度、风力条件和降水情况
      - 保持回复简洁但信息丰富
      - 如果用户询问活动建议并提供了天气预报，请根据天气预报推荐活动
      - 如果用户询问活动，请按照他们要求的格式回复

      使用 weatherTool 工具获取当前天气数据。
`,
  model: openAI.chat('qwen-plus'),
  tools: { weatherTool }, // 配置天气工具
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db', // 数据库路径相对于 .mastra/output 目录
    }),
  }),
})
