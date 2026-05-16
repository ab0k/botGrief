module.exports = {
  apps: [
    {
      name: 'griefcc-bot',
      script: 'node',
      args: 'node_modules/tsx/dist/cli.mjs src/index.ts',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
