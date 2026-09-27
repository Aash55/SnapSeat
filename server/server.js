const config = require('./config');
const app = require('./app');
const { sequelize } = require('./models');
const { startExpiryWorker } = require('./workers/holdExpiry');

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');
  } catch (err) {
    console.error('Could not connect to the database:', err.message);
    process.exit(1);
  }

  const worker = config.runExpiryWorker ? startExpiryWorker() : null;

  // Express 5 passes listen errors (e.g. EADDRINUSE) to this callback instead of throwing.
  const server = app.listen(config.port, (err) => {
    if (err) {
      console.error(err.code === 'EADDRINUSE'
        ? `Port ${config.port} is already in use. Stop the other server (see README) or set PORT in .env.`
        : err.message);
      process.exit(1);
    }
    console.log(`SnapSeat API listening on port ${config.port} (${config.env})`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down.`);
    if (worker) clearInterval(worker);
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
