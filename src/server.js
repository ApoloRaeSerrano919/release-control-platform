const app = require('./app');
const {port} = require('./config');
const logger = require('./logger');

app.listen(port,() => {
  logger.info({port},'ReleaseControl API started');
});
