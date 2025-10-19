import process from 'node:process'
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { forecastSchema } from '../schemas/weather'

// 天气预报数据结构定义
// forecastSchema 已移至 ../schemas/weather

/**
 * 根据天气代码获取中文天气状况描述
 * @param code 天气代码
 * @returns 中文天气描述
 */
function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: '晴空',
    1: '基本晴朗',
    2: '部分多云',
    3: '阴天',
    45: '雾',
    48: '雾凇',
    51: '小毛毛雨',
    53: '中等毛毛雨',
    55: '大毛毛雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    95: '雷暴',
  }
  return conditions[code] || '未知天气'
}

// 获取天气预报的工作流步骤
const fetchWeather = createStep({
  id: 'fetch-weather',
  description: '获取指定城市的天气预报',
  inputSchema: z.object({
    city: z.string().describe('要查询天气的城市名称'),
  }),
  outputSchema: forecastSchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('未找到输入数据')
    }

    // 通过地理编码API获取城市的经纬度坐标
    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(inputData.city)}&count=1`
    const geocodingResponse = await fetch(geocodingUrl)
    const geocodingData = (await geocodingResponse.json()) as {
      results: { latitude: number, longitude: number, name: string }[]
    }

    if (!geocodingData.results?.[0]) {
      throw new Error(`未找到位置 '${inputData.city}'`)
    }

    const { latitude, longitude, name } = geocodingData.results[0]

    // 调用天气API获取详细天气数据
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=precipitation,weathercode&timezone=auto,&hourly=precipitation_probability,temperature_2m`
    const response = await fetch(weatherUrl)
    const data = (await response.json()) as {
      current: {
        time: string
        precipitation: number
        weathercode: number
      }
      hourly: {
        precipitation_probability: number[]
        temperature_2m: number[]
      }
    }

    // 构建天气预报数据对象
    const forecast = {
      date: new Date().toISOString(),
      maxTemp: Math.max(...data.hourly.temperature_2m), // 最高温度
      minTemp: Math.min(...data.hourly.temperature_2m), // 最低温度
      condition: getWeatherCondition(data.current.weathercode), // 天气状况
      precipitationChance: data.hourly.precipitation_probability.reduce(
        (acc, curr) => Math.max(acc, curr),
        0,
      ), // 降水概率
      location: name, // 位置名称
    }

    return forecast
  },
})

// 基于天气条件规划活动的工作流步骤
const planActivities = createStep({
  id: 'plan-activities',
  description: '根据天气条件推荐活动',
  inputSchema: forecastSchema,
  outputSchema: z.object({
    // 推荐的活动列表，每个活动包含名称、地点、最佳时间和注意事项
    activities: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const forecast = inputData

    if (!forecast) {
      throw new Error('未找到天气预报数据')
    }

    // 获取天气智能体实例
    const agent = mastra?.getAgent('weatherAgent')
    if (!agent) {
      throw new Error('未找到天气智能体')
    }

    // 构建中文活动推荐提示词
    const prompt = `根据以下${forecast.location}的天气预报，推荐合适的活动：
      ${JSON.stringify(forecast, null, 2)}
      请严格按照以下格式组织你的回复：

      📅 [星期几, 月 日, 年]
      ═══════════════════════════

      🌡️ 天气概况
      • 天气状况：[简要描述]
      • 温度：[最低温度°C 到 最高温度°C]
      • 降水概率：[X% 概率]

      🌅 上午活动推荐
      户外活动：
      • [活动名称] - [包含具体地点/路线的简要描述]
        最佳时间：[具体时间段]
        注意事项：[相关天气考虑因素]

      🌞 下午活动推荐
      户外活动：
      • [活动名称] - [包含具体地点/路线的简要描述]
        最佳时间：[具体时间段]
        注意事项：[相关天气考虑因素]

      🏠 室内备选活动
      • [活动名称] - [包含具体场所的简要描述]
        适用情况：[触发此备选方案的天气条件]

      ⚠️ 特别提醒
      • [任何相关的天气警告、紫外线指数、风力条件等]

      指导原则：
      - 每天推荐2-3个有时间安排的户外活动
      - 包含1-2个室内备选方案
      - 降水概率>50%时，优先推荐室内活动
      - 所有活动必须针对该地区具体情况
      - 包含具体的场所、步道或地点
      - 根据温度考虑活动强度
      - 保持描述简洁但信息丰富

      请严格保持此格式的一致性，使用所示的表情符号和章节标题。`

    const response = await agent.stream([
      {
        role: 'user',
        content: prompt,
      },
    ])

    let activitiesText = ''

    for await (const chunk of response.textStream) {
      process.stdout.write(chunk)
      activitiesText += chunk
    }

    return {
      activities: activitiesText,
    }
  },
})

// 创建天气工作流：获取天气预报并推荐活动
const weatherWorkflow = createWorkflow({
  id: 'weather-workflow',
  inputSchema: z.object({
    city: z.string().describe('要查询天气的城市名称'),
  }),
  outputSchema: z.object({
    activities: z.string(),
  }),
})
  .then(fetchWeather) // 第一步：获取天气数据
  .then(planActivities) // 第二步：基于天气推荐活动

// 提交工作流配置
weatherWorkflow.commit()

export { weatherWorkflow }
