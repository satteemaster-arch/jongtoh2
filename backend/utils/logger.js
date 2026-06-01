const logger = {
  error: (msg, err) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${msg}`, err ? err.stack || err.message : '');
  },
  info: (msg) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${msg}`);
  }
};

module.exports = logger;
