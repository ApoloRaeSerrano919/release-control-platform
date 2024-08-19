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

router.get('/', async (_req,res) => {
  const result = await pool.query(
    `SELECT
       r.id,r.version,r.commit_sha,r.branch,r.status,r.created_by,r.created_at,
       s.name AS service_name
     FROM releases r
     JOIN services s ON s.id=r.service_id
     ORDER BY r.created_at DESC
     LIMIT 100`
  );

  res.json({releases:result.rows});
});

router.get('/:id', async (req,res) => {
  const id = Number(req.params.id);

  const release = (await pool.query(
    `SELECT r.*,s.name AS service_name
     FROM releases r
     JOIN services s ON s.id=r.service_id
     WHERE r.id=$1`,
    [id]
  )).rows[0];

  if (!release) return res.status(404).json({error:'release_not_found'});

  const [attempts,events,approvals] = await Promise.all([
    pool.query(
      `SELECT a.*,e.name AS environment_name
       FROM deployment_attempts a
       JOIN environments e ON e.id=a.environment_id
       WHERE a.release_id=$1
       ORDER BY a.created_at`,
      [id]
    ),
    pool.query(
      `SELECT ev.*,e.name AS environment_name
       FROM release_events ev
       LEFT JOIN environments e ON e.id=ev.environment_id
       WHERE ev.release_id=$1
       ORDER BY ev.created_at`,
      [id]
    ),
    pool.query(
      `SELECT a.*,e.name AS environment_name
       FROM approvals a
       JOIN environments e ON e.id=a.environment_id
       WHERE a.release_id=$1
       ORDER BY a.created_at`,
      [id]
    )
  ]);

  res.json({
    release,
    attempts:attempts.rows,
    events:events.rows,
    approvals:approvals.rows
  });
});

router.post('/:id/deploy', async (req,res) => {
  try {
    const body = z.object({
      environment:z.enum(['development','staging','production']),
      actor:z.string().min(2)
    }).parse(req.body);

    res.json(await queueDeployment({
      releaseId:Number(req.params.id),
      environmentName:body.environment,
      actor:body.actor
    }));
  } catch (error) {
    res.status(400).json({error:error.message});
  }
});

router.post('/:id/approve-production', async (req,res) => {
  try {
    const body = z.object({
      environmentId:z.number().int().positive(),
      approver:z.string().min(2),
      comment:z.string().optional()
    }).parse(req.body);

