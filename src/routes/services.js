const express = require('express');
const {z} = require('zod');
const pool = require('../db');

const router = express.Router();

router.get('/', async (_req,res) => {
  const result = await pool.query(
    `SELECT
       s.id,s.name,s.repository_url,s.owner_team,s.deployment_strategy,
       COUNT(e.id)::int AS environments
     FROM services s
     LEFT JOIN environments e ON e.service_id=s.id
     GROUP BY s.id
     ORDER BY s.name`
  );
  res.json({services:result.rows});
});

router.post('/', async (req,res) => {
  try {
    const input = z.object({
      name:z.string().min(2),
      repositoryUrl:z.string().url(),
      ownerTeam:z.string().min(2),
      deploymentStrategy:z.enum(['rolling','blue_green','canary']).optional(),
      healthPath:z.string().default('/health')
    }).parse(req.body);

