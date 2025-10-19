import { z } from 'zod'

// Weather Tool 输入/输出的共享 schema
export const weatherToolInputSchema = z.object({
  location: z.string().describe('城市名称'),
})

export const weatherToolOutputSchema = z.object({
  temperature: z.number(),
  feelsLike: z.number(),
  humidity: z.number(),
  windSpeed: z.number(),
  windGust: z.number(),
  conditions: z.string(),
  location: z.string(),
})

// Workflow 使用的天气预报 schema
export const forecastSchema = z.object({
  date: z.string(),
  maxTemp: z.number(),
  minTemp: z.number(),
  precipitationChance: z.number(),
  condition: z.string(),
  location: z.string(),
})

// 便于类型引用
export type WeatherToolInput = z.infer<typeof weatherToolInputSchema>
export type WeatherToolOutput = z.infer<typeof weatherToolOutputSchema>
export type Forecast = z.infer<typeof forecastSchema>
