'use server';

import { createProject } from '@dripmetric/db';
import { currentUser } from '@/lib/auth';
import { liveProjectsAllowed } from '@/lib/env';

/**
 * Creating a project returns the four keys in the action's own result, and does NOT
 * redirect.
 *
 * That is deliberate. A secret key is stored hashed and is readable exactly once
 * (brief section 5), so it only exists in memory during this one response. Redirecting
 * would throw it away, and stashing it somewhere to survive a redirect would mean
 * storing a secret key in the clear, which is the thing we are avoiding.
 */
export interface CreatedKeyView {
  kind: 'publishable' | 'secret';
  mode: 'live' | 'test';
  token: string;
}

export type NewProjectState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'created'; projectName: string; publicId: string; keys: CreatedKeyView[] };

export async function createProjectAction(
  _previous: NewProjectState,
  formData: FormData,
): Promise<NewProjectState> {
  const user = await currentUser();
  if (!user) return { status: 'error', message: 'Your session has expired. Please sign in again.' };

  const name = String(formData.get('name') ?? '').trim();
  if (name.length === 0) return { status: 'error', message: 'Give the project a name.' };
  if (name.length > 100)
    return { status: 'error', message: 'That name is longer than 100 characters.' };

  // Settled decision 1: no real founder data until backups exist.
  if (!liveProjectsAllowed()) {
    return {
      status: 'error',
      message:
        'Live projects are switched off until backups are confirmed. Set BACKUPS_CONFIRMED=true once backups are in place.',
    };
  }

  const created = await createProject({ name, ownerUserId: user.id });

  return {
    status: 'created',
    projectName: created.live.name,
    publicId: created.live.publicId,
    keys: created.keys.map((k) => ({ kind: k.kind, mode: k.mode, token: k.token })),
  };
}
