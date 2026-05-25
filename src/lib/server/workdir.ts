import { workdirLayout, type WorkdirLayout } from '../paths.js';

export function resolveWorkdir(): string {
  return process.env.IMXPORT_WORKDIR ?? 'workdir';
}

export function layout(): WorkdirLayout {
  return workdirLayout(resolveWorkdir());
}
