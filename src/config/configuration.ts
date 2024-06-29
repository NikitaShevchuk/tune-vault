export type Configuration = ReturnType<typeof getConfig>;

const getConfig = () =>
  ({
    port: parseInt(process.env.PORT, 10) || 3000,
    uiUrl: process.env.UI_URL,
    uiHost: process.env.UI_HOST,
    authUrl: process.env.AUTH_URL,
    jwtSecret: process.env.JWT_SECRET,
    environment: process.env.APP_ENV,
    discord: {
      token: process.env.DISCORD_BOT_TOKEN,
      clientId: process.env.DISCORD_CLIENT_ID,
      redirectUrl: process.env.DISCORD_REDIRECT_URL,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    },
    redis: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    },
    postgres: {
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
    },
  }) as const;

export default getConfig;
