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

    const service = (await pool.query(
      `INSERT INTO services
       (name,repository_url,owner_team,deployment_strategy,health_path)
       VALUES($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        input.name,
        input.repositoryUrl,
        input.ownerTeam,
        input.deploymentStrategy || 'rolling',
        input.healthPath
      ]
    )).rows[0];

    res.status(201).json(service);
  } catch (error) {
