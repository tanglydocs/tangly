/**
 * Git repo-location variables. Git exports these into hook processes (and CI
 * wrappers can set them), and every child `git` inherits them, so a command
 * meant for a temp dir or the docs root would act on the enclosing repo.
 */
export const GIT_REPO_ENV_VARS = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_PREFIX",
  "GIT_CEILING_DIRECTORIES",
] as const;

/** `process.env` minus the repo-location vars, plus `extra`. */
export function cleanGitEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const k of GIT_REPO_ENV_VARS) delete env[k];
  return { ...env, ...extra };
}
