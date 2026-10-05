import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { handleRequest as handleMockRequest } from '../../server/handler';
import { MemoryStore, setStore } from '../../server/store';
import { seedDemo } from '../../server/bootstrap';
import { isParticipantEffectiveForFacilitator, resolveEffectiveParticipants } from '../domain/assignmentResolution';
import { Activity, Assignment, Event, Participant } from '../domain/types';

describe('GERA System Test Suite (Prompt 1 & Prompt 2)', () => {
  let fac1Token: string;
  let fac2Token: string;
  let eventAdminToken: string;
  let sysAdminToken: string;

  beforeAll(async () => {
    process.env.ENABLE_DEV_TOOLS = 'true';
    const store = new MemoryStore();
    setStore(store);
    await seedDemo(store);

    // Login users to get session tokens
    const fac1Res = await handleMockRequest('POST', '/auth/login', {
      mobile_or_username: 'fac1',
      password: 'demo1234',
    });
    fac1Token = fac1Res.token;

    const fac2Res = await handleMockRequest('POST', '/auth/login', {
      mobile_or_username: 'fac2',
      password: 'demo1234',
    });
    fac2Token = fac2Res.token;

    const eaRes = await handleMockRequest('POST', '/auth/login', {
      mobile_or_username: 'eventadmin',
      password: 'demo1234',
    });
    eventAdminToken = eaRes.token;

    const saRes = await handleMockRequest('POST', '/auth/login', {
      mobile_or_username: 'sysadmin',
      password: 'demo1234',
    });
    sysAdminToken = saRes.token;
  });

  // -------------------------------------------------------------
  // AC-01: Facilitator assignment access control (403 FORBIDDEN)
  // -------------------------------------------------------------
  it('AC-01: Facilitator gets 403 trying to record observation for participant outside assignment', async () => {
    // fac1 has Group 01G in ACT-01 (PT-001..PT-008)
    // PT-009 is in Group 02G (assigned to fac2 in ACT-01)
    const res = await handleMockRequest(
      'POST',
      '/observations/batch',
      {
        observations: [
          {
            offline_uuid: 'test-ac01-outside-assignment',
            event_id: 'EVT-BOOTCAMP-2026',
            activity_id: 'ACT-01',
            participant_id: 'pt-009', // Outside fac1's assignment!
            client_created_at: '2026-10-05T10:00:00+03:30',
            behavior_codes: ['P01'],
          },
        ],
      },
      fac1Token
    );

    expect(res.results).toBeDefined();
    expect(res.results.length).toBe(1);
    expect(res.results[0].status).toBe('error');
    expect(res.results[0].code).toBe('FORBIDDEN');
  });

  // -------------------------------------------------------------
  // AC-05: Idempotency with offline_uuid
  // -------------------------------------------------------------
  it('AC-05: Resending exact same offline_uuid does not duplicate and returns same result', async () => {
    const payload = {
      observations: [
        {
          offline_uuid: 'test-ac05-idempotent-uuid-1',
          event_id: 'EVT-BOOTCAMP-2026',
          activity_id: 'ACT-01',
          participant_id: 'pt-001', // Valid for fac1
          client_created_at: '2026-10-05T09:15:00+03:30',
          behavior_codes: ['P01', 'P03'],
          note: 'Initial attempt',
        },
      ],
    };

    const firstRes = await handleMockRequest('POST', '/observations/batch', payload, fac1Token);
    expect(firstRes.results[0].status).toBe('synced');
    const firstObsId = firstRes.results[0].observation_id;

    // Resend exact same payload
    const secondRes = await handleMockRequest('POST', '/observations/batch', payload, fac1Token);
    expect(secondRes.results[0].status).toBe('synced');
    expect(secondRes.results[0].observation_id).toBe(firstObsId);
  });

  // -------------------------------------------------------------
  // AC-08: Closed activity rules & Offline client_created_at rule
  // -------------------------------------------------------------
  it('AC-08: Closed activity rejects new observations, but accepts pending record with client_created_at < closed_at', async () => {
    try {
      // 1. Close ACT-01
      const closeRes = await handleMockRequest(
        'PATCH',
        '/admin/activities/ACT-01/status',
        { status: 'Closed' },
        eventAdminToken
      );
      expect(closeRes.status).toBe('Closed');
      expect(closeRes.closed_at).toBeDefined();

      const closedAtMs = new Date(closeRes.closed_at).getTime();

      // 2. Observation created AFTER closed_at -> Rejected with ACTIVITY_CLOSED
      const afterCloseRes = await handleMockRequest(
        'POST',
        '/observations/batch',
        {
          observations: [
            {
              offline_uuid: 'test-ac08-after-close',
              event_id: 'EVT-BOOTCAMP-2026',
              activity_id: 'ACT-01',
              participant_id: 'pt-002',
              client_created_at: new Date(closedAtMs + 120000).toISOString(), // After closed_at!
              behavior_codes: ['P02'],
            },
          ],
        },
        fac1Token
      );
      expect(afterCloseRes.results[0].status).toBe('error');
      expect(afterCloseRes.results[0].code).toBe('ACTIVITY_CLOSED');

      // 3. Pending observation created BEFORE closed_at -> Accepted!
      const beforeCloseRes = await handleMockRequest(
        'POST',
        '/observations/batch',
        {
          observations: [
            {
              offline_uuid: 'test-ac08-before-close-accepted',
              event_id: 'EVT-BOOTCAMP-2026',
              activity_id: 'ACT-01',
              participant_id: 'pt-002',
              client_created_at: new Date(closedAtMs - 120000).toISOString(), // Before closed_at!
              behavior_codes: ['P02'],
            },
          ],
        },
        fac1Token
      );
      expect(beforeCloseRes.results[0].status).toBe('synced');
    } finally {
      // Always reopen ACT-01 for subsequent tests
      await handleMockRequest('PATCH', '/admin/activities/ACT-01/status', { status: 'Open' }, eventAdminToken);
    }
  });

  // -------------------------------------------------------------
  // Assignment Resolution Logic Tests
  // -------------------------------------------------------------
  it('Assignment resolution: override replaces group, individual is additive, Revoked has no effect', () => {
    const dummyEvent: Event = {
      id: 'EVT-1',
      title: 'Test Event',
      event_date: '2026-10-05',
      location: '',
      description: '',
      status: 'Active',
      created_by: 'u1',
    };
    const dummyAct: Activity = {
      id: 'ACT-1',
      event_id: 'EVT-1',
      title: 'Act 1',
      order_no: 1,
      status: 'Open',
    };
    const p1: Participant = {
      id: 'p1',
      event_id: 'EVT-1',
      participant_code: 'PT-01',
      full_name: 'فرد ۱',
      group_id: 'grp-1',
      status: 'Active',
    };

    // 1. Group assignment only: fac1 can see p1, fac2 cannot
    const asgGroup: Assignment[] = [
      {
        id: 'a1',
        event_id: 'EVT-1',
        activity_id: 'ACT-1',
        facilitator_id: 'fac1',
        kind: 'group',
        group_id: 'grp-1',
        status: 'Active',
        created_at: '2026-10-05T09:00:00+03:30',
      },
    ];
    expect(isParticipantEffectiveForFacilitator('fac1', p1, dummyAct, dummyEvent, asgGroup)).toBe(true);
    expect(isParticipantEffectiveForFacilitator('fac2', p1, dummyAct, dummyEvent, asgGroup)).toBe(false);

    // 2. Additive individual assignment for fac2
    const asgWithIndividual = [
      ...asgGroup,
      {
        id: 'a2',
        event_id: 'EVT-1',
        activity_id: 'ACT-1',
        facilitator_id: 'fac2',
        kind: 'individual' as const,
        participant_id: 'p1',
        status: 'Active' as const,
        created_at: '2026-10-05T09:10:00+03:30',
      },
    ];
    expect(isParticipantEffectiveForFacilitator('fac1', p1, dummyAct, dummyEvent, asgWithIndividual)).toBe(true);
    expect(isParticipantEffectiveForFacilitator('fac2', p1, dummyAct, dummyEvent, asgWithIndividual)).toBe(true);

    // 3. Override assignment for fac3 (replaces group and individual!)
    const asgWithOverride = [
      ...asgWithIndividual,
      {
        id: 'a3',
        event_id: 'EVT-1',
        activity_id: 'ACT-1',
        facilitator_id: 'fac3',
        kind: 'override' as const,
        participant_id: 'p1',
        status: 'Active' as const,
        created_at: '2026-10-05T09:20:00+03:30',
      },
    ];
    expect(isParticipantEffectiveForFacilitator('fac1', p1, dummyAct, dummyEvent, asgWithOverride)).toBe(false);
    expect(isParticipantEffectiveForFacilitator('fac2', p1, dummyAct, dummyEvent, asgWithOverride)).toBe(false);
    expect(isParticipantEffectiveForFacilitator('fac3', p1, dummyAct, dummyEvent, asgWithOverride)).toBe(true);

    // 4. Revoked override returns authority back to group and individual
    const asgWithRevokedOverride = asgWithOverride.map((a) =>
      a.id === 'a3' ? { ...a, status: 'Revoked' as const } : a
    );
    expect(isParticipantEffectiveForFacilitator('fac1', p1, dummyAct, dummyEvent, asgWithRevokedOverride)).toBe(true);
    expect(isParticipantEffectiveForFacilitator('fac2', p1, dummyAct, dummyEvent, asgWithRevokedOverride)).toBe(true);
    expect(isParticipantEffectiveForFacilitator('fac3', p1, dummyAct, dummyEvent, asgWithRevokedOverride)).toBe(false);
  });

  // -------------------------------------------------------------
  // AC-12 & AC-02: Forbidden Words Source Scan
  // -------------------------------------------------------------
  it('AC-12/AC-02: Source scan of facilitator components contains no forbidden words (except Onboarding)', () => {
    const facilitatorDir = path.resolve(__dirname, '../ui/facilitator');
    const files = fs.readdirSync(facilitatorDir);

    const forbiddenWords = ['امتیاز', 'رتبه', 'شایستگی', 'قوی', 'ضعیف', 'نگاشت', 'نمره‌دهی'];

    for (const file of files) {
      // OnboardingPage.tsx is explicitly exempt by specification
      if (file === 'OnboardingPage.tsx') continue;

      const filePath = path.join(facilitatorDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      for (const word of forbiddenWords) {
        const found = content.includes(word);
        if (found) {
          console.error(`Forbidden word "${word}" found in facilitator file: ${file}`);
        }
        expect(found).toBe(false);
      }
    }
  });

  // -------------------------------------------------------------
  // Data Leakage Test: No Competency or Weight Constants
  // -------------------------------------------------------------
  it('Data leakage check: No competency names or weights defined in client codebase', () => {
    const srcDir = path.resolve(__dirname, '..');
    const allFiles: string[] = [];

    function walk(dir: string) {
      for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
          walk(full);
        } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
          allFiles.push(full);
        }
      }
    }
    walk(srcDir);

    for (const file of allFiles) {
      if (file.includes('OnboardingPage.tsx') || file.includes('gera.test.ts')) continue;
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain('hidden_competency_mapping: {');
      expect(content).not.toContain('COMPETENCY_WEIGHTS');
      expect(content).not.toContain('competency_scores');
    }
  });

  // -------------------------------------------------------------
  // AC-06: 100-Participant Import with Automatic Grouping
  // -------------------------------------------------------------
  it('AC-06: Bulk import of 100 participants auto-creates groups without manual edits', async () => {
    const hundredRows = Array.from({ length: 100 }).map((_, i) => ({
      name_full: `کاربر آزمایشی ${i + 1}`,
      code_group: `GRP-${(i % 10) + 1}`,
      participant_code: `IMP-TEST-${String(i + 1).padStart(3, '0')}`,
    }));

    const importRes = await handleMockRequest(
      'POST',
      '/admin/events/EVT-BOOTCAMP-2026/participants/import',
      { rows: hundredRows },
      eventAdminToken
    );

    expect(importRes.success).toBe(true);
    expect(importRes.imported_count).toBe(100);
    expect(importRes.new_groups_created).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------
  // AC-07: Mid-event Group Reassignment
  // -------------------------------------------------------------
  it('AC-07: Mid-event assignment revocation and reassignment updates access', async () => {
    // Revoke fac1's assignment for ACT-01 Group 01G
    const allAsgs = await handleMockRequest(
      'GET',
      '/admin/events/EVT-BOOTCAMP-2026/assignments',
      undefined,
      eventAdminToken
    );
    const targetAsg = allAsgs.find(
      (a: Assignment) =>
        a.activity_id === 'ACT-01' && a.facilitator_id === 'u-fac1' && a.status === 'Active'
    );
    expect(targetAsg).toBeDefined();

    // Revoke
    await handleMockRequest('POST', `/admin/assignments/${targetAsg.id}/revoke`, {}, eventAdminToken);

    // Now fac1 should receive 403 for PT-001 in ACT-01
    const obsRes = await handleMockRequest(
      'POST',
      '/observations/batch',
      {
        observations: [
          {
            offline_uuid: 'test-ac07-revoked-obs',
            event_id: 'EVT-BOOTCAMP-2026',
            activity_id: 'ACT-01',
            participant_id: 'pt-001',
            client_created_at: '2026-10-05T10:00:00+03:30',
            behavior_codes: ['P01'],
          },
        ],
      },
      fac1Token
    );
    expect(obsRes.results[0].status).toBe('error');
    expect(obsRes.results[0].code).toBe('FORBIDDEN');
  });

  // -------------------------------------------------------------
  // AC-09: Edit and Void logged in AuditLog with before/after
  // -------------------------------------------------------------
  it('AC-09: Edit and Void operations are tracked in AuditLog with before/after snapshots', async () => {
    // Record observation by fac2 for pt-009 (fac2 has Group 02G in ACT-01)
    const recordRes = await handleMockRequest(
      'POST',
      '/observations/batch',
      {
        observations: [
          {
            offline_uuid: 'test-ac09-audit-obs',
            event_id: 'EVT-BOOTCAMP-2026',
            activity_id: 'ACT-01',
            participant_id: 'pt-009',
            client_created_at: '2026-10-05T10:05:00+03:30',
            behavior_codes: ['P01'],
            note: 'Initial note',
          },
        ],
      },
      fac2Token
    );
    const obsId = recordRes.results[0].observation_id;

    // Edit it
    await handleMockRequest(
      'PATCH',
      `/observations/${obsId}`,
      { behavior_codes: ['P01', 'P04'], note: 'Updated note' },
      fac2Token
    );

    // Void it
    await handleMockRequest('POST', `/observations/${obsId}/void`, {}, fac2Token);

    // Check AuditLog
    const auditLogs = await handleMockRequest('GET', '/admin/audit-logs', undefined, sysAdminToken);
    const updateLog = auditLogs.find((l: any) => l.action === 'UPDATE_OBSERVATION' && l.entity_id === obsId);
    const voidLog = auditLogs.find((l: any) => l.action === 'VOID_OBSERVATION' && l.entity_id === obsId);

    expect(updateLog).toBeDefined();
    expect(updateLog.before_json).toBeDefined();
    expect(updateLog.after_json).toBeDefined();
    expect(voidLog).toBeDefined();
    expect(voidLog.after_json).toContain('Voided');
  });

  // -------------------------------------------------------------
  // AC-10: Long CSV has exactly one row per behavior tag
  // -------------------------------------------------------------
  it('AC-10: Long CSV contains exactly one row per behavior tag', async () => {
    // Record an observation with 3 tags
    const uuid = 'test-ac10-multi-tag-obs';
    await handleMockRequest(
      'POST',
      '/observations/batch',
      {
        observations: [
          {
            offline_uuid: uuid,
            event_id: 'EVT-BOOTCAMP-2026',
            activity_id: 'ACT-01',
            participant_id: 'pt-010',
            client_created_at: '2026-10-05T10:10:00+03:30',
            behavior_codes: ['P01', 'P03', 'P05'],
          },
        ],
      },
      fac2Token
    );

    const exportRes = await handleMockRequest(
      'GET',
      '/admin/events/EVT-BOOTCAMP-2026/export/long-csv',
      undefined,
      eventAdminToken
    );

    expect(exportRes.csv).toBeDefined();
    expect(exportRes.csv.startsWith('\uFEFF')).toBe(true); // UTF-8 BOM

    // Count rows containing this observation's tags
    const lines = exportRes.csv.split('\r\n');
    const matchingLines = lines.filter((l: string) => l.includes('pt-010') && l.includes('ACT-01'));
    expect(matchingLines.length).toBe(3);
  });

  // -------------------------------------------------------------
  // AC-11: Coverage differentiates missing_coverage & no_opportunity
  // -------------------------------------------------------------
  it('AC-11: Coverage marks differentiate between missing_coverage and no_opportunity', async () => {
    // Record a NO_OPPORTUNITY mark for pt-011
    await handleMockRequest(
      'POST',
      '/coverage/no-opportunity',
      {
        offline_uuid: 'test-ac11-no-opp',
        event_id: 'EVT-BOOTCAMP-2026',
        activity_id: 'ACT-01',
        participant_id: 'pt-011',
      },
      fac2Token
    );

    const report = await handleMockRequest(
      'GET',
      '/admin/events/EVT-BOOTCAMP-2026/coverage-report',
      undefined,
      eventAdminToken
    );

    const rowPt11 = report.find((r: any) => r.activity_id === 'ACT-01' && r.participant_id === 'pt-011');
    expect(rowPt11.no_opportunity_count).toBeGreaterThanOrEqual(1);
    expect(rowPt11.missing_coverage).toBe(false); // because NO_OPPORTUNITY was registered!

    // pt-012 has active assignment but NO observation and NO opportunity mark
    const rowPt12 = report.find((r: any) => r.activity_id === 'ACT-01' && r.participant_id === 'pt-012');
    if (rowPt12 && rowPt12.observation_count === 0 && rowPt12.no_opportunity_count === 0) {
      expect(rowPt12.missing_coverage).toBe(true);
    }
  });

  // -------------------------------------------------------------
  // RBAC and Privacy Checks
  // -------------------------------------------------------------
  it('RBAC & Privacy: Facilitators cannot access /admin/*, exports exclude passwords and tokens', async () => {
    // 1. Facilitator calling /admin endpoint -> 403
    await expect(
      handleMockRequest('GET', '/admin/events', undefined, fac1Token)
    ).rejects.toThrow();

    // 2. Export bundle excludes credentials
    const bundleRes = await handleMockRequest(
      'GET',
      '/admin/events/EVT-BOOTCAMP-2026/export/analysis-bundle',
      undefined,
      eventAdminToken
    );
    const bundleStr = JSON.stringify(bundleRes.bundle);

    expect(bundleStr).not.toContain('password');
    expect(bundleStr).not.toContain('sess_');
    expect(bundleStr).not.toContain('mobile_or_username');
    expect(bundleRes.bundle.hidden_competency_mapping).toBeNull();
  });
});
