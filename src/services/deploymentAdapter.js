async function deployArtifact({service,environment,release}) {
  // Local stand-in; swap for a cloud deploy client when needed.
  await new Promise(r=>setTimeout(r,250));

  return {
    provider:'simulated',
    service:service.name,
    environment:environment.name,
    version:release.version,
    artifact:release.artifact_uri
  };
}

