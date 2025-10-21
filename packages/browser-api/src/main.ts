import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const defaultOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ];
  const originsEnv = process.env.CORS_ORIGINS;
  const originList = originsEnv
    ? originsEnv.split(',').map((s) => s.trim()).filter(Boolean)
    : defaultOrigins;

  app.enableCors({
    origin: originList,
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}
bootstrap();
