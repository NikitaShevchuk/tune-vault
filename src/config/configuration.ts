export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
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
});
