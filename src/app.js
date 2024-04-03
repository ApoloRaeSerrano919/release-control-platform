const express = require('express');
const cors = require('cors');

const serviceRoutes = require('./routes/services');
const releaseRoutes = require('./routes/releases');
const metricsRoutes = require('./routes/metrics');

const app = express();

app.use(cors());
app.use(express.json({limit:'2mb'}));

app.get('/health',(_req,res) => {
  res.json({status:'ok',service:'release-control'});
});

