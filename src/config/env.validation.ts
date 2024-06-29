import { Transform, plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsString, validateSync } from 'class-validator';

class EnvironmentVariables {
  // App
  @IsEnum(['development', 'production'])
  APP_ENV: 'development' | 'production';
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  PORT: number;
  @IsString()
  UI_URL: string;
  @IsString()
  UI_HOST: string;
  @IsString()
  AUTH_URL: string;
  @IsString()
  JWT_SECRET: string;

  // Postgres
  @IsString()
  POSTGRES_USER: string;
  @IsString()
  POSTGRES_PASSWORD: string;
  @IsString()
  POSTGRES_DB: string;
  @IsString()
  DATABASE_URL: string;

  // Discord
  @IsString()
  DISCORD_BOT_TOKEN: string;
  @IsString()
  DISCORD_CLIENT_ID: string;
  @IsString()
  DISCORD_REDIRECT_URL: string;
  @IsString()
  DISCORD_CLIENT_SECRET: string;

  // Redis
  @IsString()
  REDIS_HOST: string;
  @IsNumber()
  REDIS_PORT: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
