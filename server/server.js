const app = require('./app');
const { sequelize } = require('./models');
const { startExpiryWorker } = require('./workers/holdExpiry');

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    if (startExpiryWorker) {
      startExpiryWorker();
    }

    app.listen(PORT, () => {
      console.log(`SnapSeat server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error.message);
    process.exit(1);
  }
};

start();
