import type { WeatherToolOutput } from '../schemas/weather'
import { createTool } from '@mastra/core/tools'
import { weatherToolInputSchema, weatherToolOutputSchema } from '../schemas/weather'

// 地理编码API响应接口
interface GeocodingResponse {
  results: {
    latitude: number
    longitude: number
    name: string
  }[]
}

// 天气API响应接口
interface WeatherResponse {
  current: {
    time: string
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    wind_speed_10m: number
    wind_gusts_10m: number
    weather_code: number
  }
}

// 创建天气查询工具
export const weatherTool = createTool({
  id: 'get-weather',
  description: '获取指定地点的当前天气信息',
  inputSchema: weatherToolInputSchema,
  outputSchema: weatherToolOutputSchema,
  execute: async ({ context }) => {
    return getWeather(context.location)
  },
})

/**
 * 获取指定地点的天气信息
 * @param location 地点名称
 * @returns 天气数据对象
 */
async function getWeather(location: string): Promise<WeatherToolOutput> {
  // 通过地理编码API获取地点的经纬度
  const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
  const geocodingResponse = await fetch(geocodingUrl)
  const geocodingData = (await geocodingResponse.json()) as GeocodingResponse

  if (!geocodingData.results?.[0]) {
    throw new Error(`未找到地点 '${location}'`)
  }

  const { latitude, longitude, name } = geocodingData.results[0]

  // 调用天气API获取详细天气信息
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code`

  const response = await fetch(weatherUrl)
  const data = (await response.json()) as WeatherResponse

  // 返回格式化的天气数据
  return {
    temperature: data.current.temperature_2m, // 当前温度
    feelsLike: data.current.apparent_temperature, // 体感温度
    humidity: data.current.relative_humidity_2m, // 相对湿度
    windSpeed: data.current.wind_speed_10m, // 风速
    windGust: data.current.wind_gusts_10m, // 阵风速度
    conditions: getWeatherCondition(data.current.weather_code), // 天气状况
    location: name, // 地点名称
  }
}

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
    56: '小冻毛毛雨',
    57: '大冻毛毛雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    66: '小冻雨',
    67: '大冻雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    77: '雪粒',
    80: '小阵雨',
    81: '中阵雨',
    82: '暴雨',
    85: '小阵雪',
    86: '大阵雪',
    95: '雷暴',
    96: '雷暴伴小冰雹',
    99: '雷暴伴大冰雹',
  }
  return conditions[code] || '未知天气'
}
