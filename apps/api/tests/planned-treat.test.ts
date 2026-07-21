import type {
  ActivePlannedTreatResponse,
  PlannedTreatGetResponse,
  PlannedTreatInput,
} from '@caloriebank/schemas';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import type { DevelopmentUser } from '../src/modules/goal-configuration/goal-configuration.repository';
import { derivePlannedTreatProgress } from '../src/modules/planned-treat/planned-treat.progress';
import type { PlannedTreatRepository } from '../src/modules/planned-treat/planned-treat.repository';

class MemoryPlannedTreatRepository implements PlannedTreatRepository {
  private treat: ActivePlannedTreatResponse | null = null;

  constructor(private readonly availableBankCalories = 305) {}

  async getForUser(): Promise<PlannedTreatGetResponse> {
    if (!this.treat) {
      return {
        status: 'no_plan',
        plannedTreat: null,
        availableBankCalories: this.availableBankCalories,
      };
    }

    return this.withProgress(this.treat);
  }

  async createOrReplaceForUser(
    _user: DevelopmentUser,
    input: PlannedTreatInput,
  ): Promise<ActivePlannedTreatResponse> {
    this.treat = this.withProgress({
      id: '00000000-0000-4000-8000-000000000010',
      name: input.name,
      requiredCalories: input.requiredCalories,
      targetDate: input.targetDate ?? null,
      availableBankCalories: this.availableBankCalories,
      progressCalories: 0,
      remainingCalories: 0,
      progressRatio: 0,
      progressPercent: 0,
      status: 'saving',
      createdAt: '2026-07-21T01:00:00.000Z',
      updatedAt: '2026-07-21T01:00:00.000Z',
    });

    return this.treat;
  }

  async updateForUser(_userId: string, input: PlannedTreatInput): Promise<ActivePlannedTreatResponse> {
    if (!this.treat) {
      throw new Error('Missing test treat.');
    }

    this.treat = this.withProgress({
      ...this.treat,
      name: input.name,
      requiredCalories: input.requiredCalories,
      targetDate: input.targetDate ?? null,
      updatedAt: '2026-07-21T02:00:00.000Z',
    });

    return this.treat;
  }

  async deleteForUser(): Promise<void> {
    this.treat = null;
  }

  private withProgress(treat: ActivePlannedTreatResponse): ActivePlannedTreatResponse {
    return {
      ...treat,
      availableBankCalories: this.availableBankCalories,
      ...derivePlannedTreatProgress(this.availableBankCalories, treat.requiredCalories),
    };
  }
}

describe('planned treat API', () => {
  it('returns no active treat', async () => {
    const response = await request(
      createApp(undefined, { plannedTreatRepository: new MemoryPlannedTreatRepository() }),
    )
      .get('/v1/me/planned-treat')
      .expect(200);

    expect(response.body).toEqual({
      status: 'no_plan',
      plannedTreat: null,
      availableBankCalories: 305,
    });
  });

  it('creates and retrieves a planned treat with real progress fields', async () => {
    const repository = new MemoryPlannedTreatRepository();
    const app = createApp(undefined, { plannedTreatRepository: repository });

    const created = await request(app)
      .post('/v1/me/planned-treat')
      .send({ name: 'Cookies and milk', requiredCalories: 1500 })
      .expect(201);

    expect(created.body).toMatchObject({
      name: 'Cookies and milk',
      requiredCalories: 1500,
      availableBankCalories: 305,
      progressCalories: 305,
      remainingCalories: 1195,
      progressPercent: 20,
      status: 'saving',
    });

    const fetched = await request(app).get('/v1/me/planned-treat').expect(200);
    expect(fetched.body).toMatchObject(created.body);
  });

  it('updates and deletes a planned treat', async () => {
    const repository = new MemoryPlannedTreatRepository(1650);
    const app = createApp(undefined, { plannedTreatRepository: repository });

    await request(app)
      .post('/v1/me/planned-treat')
      .send({ name: 'Pizza night', requiredCalories: 1500 })
      .expect(201);

    const updated = await request(app)
      .patch('/v1/me/planned-treat')
      .send({ name: 'Birthday meal', requiredCalories: 1600, targetDate: '2026-08-01' })
      .expect(200);

    expect(updated.body).toMatchObject({
      name: 'Birthday meal',
      targetDate: '2026-08-01',
      status: 'ready',
      progressPercent: 100,
    });

    await request(app).delete('/v1/me/planned-treat').expect(204);
    const afterDelete = await request(app).get('/v1/me/planned-treat').expect(200);
    expect(afterDelete.body.status).toBe('no_plan');
  });

  it('rejects invalid planned treats', async () => {
    const app = createApp(undefined, { plannedTreatRepository: new MemoryPlannedTreatRepository() });

    await request(app)
      .post('/v1/me/planned-treat')
      .send({ name: '   ', requiredCalories: 1500 })
      .expect(400);

    await request(app)
      .post('/v1/me/planned-treat')
      .send({ name: 'Cookies', requiredCalories: 0 })
      .expect(400);
  });
});
