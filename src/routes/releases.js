const express = require('express');
const {z} = require('zod');
const pool = require('../db');
const {createRelease} = require('../services/releaseService');
const {
  queueDeployment,
  approveProduction,
  queueRollback
} = require('../services/orchestrationService');

const router = express.Router();

router.post('/', async (req,res) => {
  try {
    const input = z.object({
      serviceId:z.number().int().positive(),
      version:z.string().min(1),
      commitSha:z.string().min(7).max(64),
      branch:z.string().optional(),
      artifactUri:z.string().min(3),
      createdBy:z.string().min(3),
      releaseNotes:z.string().optional(),
      idempotencyKey:z.string().optional()
    }).parse(req.body);

    res.status(201).json(await createRelease(input));
  } catch (error) {
    res.status(400).json({error:error.message});
  }
});

