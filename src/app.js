const express = require('express');
const cors = require('cors');

const serviceRoutes = require('./routes/services');
const releaseRoutes = require('./routes/releases');
const metricsRoutes = require('./routes/metrics');

const app = express();

