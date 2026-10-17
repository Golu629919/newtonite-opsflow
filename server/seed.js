import { db, initSchema, queryHelpers } from './db.js';
import { INITIAL_USERS, INITIAL_TEAMS } from './auth.js';

export function seedDatabase() {
  initSchema();

  // Check if already seeded
  const userCount = queryHelpers.get('SELECT COUNT(*) as count FROM users')?.count || 0;
  if (userCount > 0) {
    return;
  }

  console.log('[Seed] Seeding database with initial users, teams, and operational work items...');

  queryHelpers.transaction(() => {
    // 1. Seed Teams
    for (const team of INITIAL_TEAMS) {
      queryHelpers.run(`
        INSERT INTO teams (id, name, color, description)
        VALUES (?, ?, ?, ?)
      `, [team.id, team.name, team.color, team.description]);
    }

    // 2. Seed Users & Team Memberships
    for (const user of INITIAL_USERS) {
      queryHelpers.run(`
        INSERT INTO users (id, name, email, avatar_url, role)
        VALUES (?, ?, ?, ?, ?)
      `, [user.id, user.name, user.email, user.avatar_url, user.role]);

      for (const t of user.teams) {
        queryHelpers.run(`
          INSERT INTO user_teams (user_id, team_id, team_role)
          VALUES (?, ?, ?)
        `, [user.id, t.team_id, t.team_role]);
      }
    }

    // 3. Seed Realistic Work Items
    const workItems = [
      {
        id: 'OPS-1001',
        title: 'Checkout Gateway 502 Spikes on Visa Transactions',
        type: 'PRODUCTION_INCIDENT',
        status: 'INVESTIGATING',
        priority: 'P0_CRITICAL',
        team_id: 'team-eng',
        assignee_id: 'usr_elena',
        creator_id: 'usr_alice',
        why_it_exists: 'Spike in HTTP 502 Bad Gateway errors observed across European checkout endpoints starting at 14:15 UTC. Dropping approximately 12% of Visa authorizations.',
        current_state_summary: 'Connection pool starvation isolated between payments-proxy and upstream acquiring bank. Thread count pinned at 98%.',
        next_action: 'Scale out proxy deployment replicas and recycle exhausted pool connections.',
        requires_approval: 0,
        approval_status: 'NONE',
        version: 3,
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        updated_at: new Date(Date.now() - 600000).toISOString()
      },
      {
        id: 'OPS-1002',
        title: 'Cross-Border Settlement Mismatch > $45,000 (Merchant #8291)',
        type: 'PAYMENT_INVESTIGATION',
        status: 'PENDING_APPROVAL',
        priority: 'P1_HIGH',
        team_id: 'team-payments',
        assignee_id: 'usr_bob',
        creator_id: 'usr_bob',
        why_it_exists: 'Automated treasury reconciliation detected an unbalanced clearing batch with FX discrepancy between EUR and USD clearing corridors.',
        current_state_summary: 'Discrepancy mapped to duplicate exchange rate rounding on high-volume micro-transactions. Manual reconciliation entry drafted.',
        next_action: 'Awaiting formal approval from Finance Lead / Treasury to execute balancing ledger journal.',
        requires_approval: 1,
        approval_status: 'REQUESTED',
        approval_note: 'Requesting Bob -> Carol or Elena sign-off for ledger correction > $10,000',
        version: 4,
        created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        updated_at: new Date(Date.now() - 1800000).toISOString()
      },
      {
        id: 'OPS-1003',
        title: 'GDPR Article 17 Right to Erasure: Subject ID EU-9941',
        type: 'COMPLIANCE_REQUEST',
        status: 'BLOCKED',
        priority: 'P2_MEDIUM',
        team_id: 'team-compliance',
        assignee_id: 'usr_carol',
        creator_id: 'usr_dave',
        why_it_exists: 'Formal data subject erasure request received via privacy portal with strict 30-day regulatory deadline.',
        current_state_summary: 'User profile scheduled for anonymization, but automated script halted due to active financial dispute record.',
        next_action: 'Legal counsel review needed to confirm financial ledger retention exemption under EU GDPR Art 17(3)(b).',
        blocked_reason: 'Active fraud chargeback pending resolution in Stripe corridor prevents full DB purge.',
        requires_approval: 1,
        approval_status: 'NONE',
        version: 2,
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 3).toISOString()
      },
      {
        id: 'OPS-1004',
        title: 'VIP Enterprise Account Unable to Provision SAML SSO',
        type: 'CUSTOMER_ISSUE',
        status: 'INVESTIGATING',
        priority: 'P1_HIGH',
        team_id: 'team-support',
        assignee_id: 'usr_dave',
        creator_id: 'usr_dave',
        why_it_exists: 'Chief Security Officer of Acme Corp reported company-wide login failure after rotating their Okta X.509 certificate.',
        current_state_summary: 'IdP metadata XML contains SHA-1 thumbprint that failed our tenant validation policy.',
        next_action: 'Assist customer IT team with re-exporting SHA-256 certificate and re-testing auth handshake.',
        requires_approval: 0,
        approval_status: 'NONE',
        version: 2,
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        updated_at: new Date(Date.now() - 1200000).toISOString()
      },
      {
        id: 'OPS-1005',
        title: 'Emergency Database Partitioning on Ledger Transactions Table',
        type: 'OPERATIONAL_APPROVAL',
        status: 'PENDING_APPROVAL',
        priority: 'P1_HIGH',
        team_id: 'team-ops',
        assignee_id: 'usr_alice',
        creator_id: 'usr_alice',
        why_it_exists: 'Primary PostgreSQL transactions table crossed 800M rows, causing sequential scan latency spikes during monthly billing rollups.',
        current_state_summary: 'Zero-downtime pg_partman partition migration script staged on staging cluster with 100% test coverage.',
        next_action: 'Requires Engineering Lead approval before running maintenance script during tonight\'s off-peak maintenance window.',
        requires_approval: 1,
        approval_status: 'REQUESTED',
        approval_note: 'Maintenance window: 02:00 - 02:30 UTC. Read-only fallback active.',
        version: 3,
        created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 'OPS-1006',
        title: 'Memory Leak in WebSocket Notification Broker Pods',
        type: 'ENGINEERING_BUG',
        status: 'OPEN',
        priority: 'P2_MEDIUM',
        team_id: 'team-eng',
        assignee_id: null,
        creator_id: 'usr_elena',
        why_it_exists: 'Pod OOMKilled alerts triggered every 6 hours on ws-gateway nodes during high connection churn.',
        current_state_summary: 'Event emitter listeners on disconnected sockets are failing garbage collection in Node.js runtime.',
        next_action: 'Claim item, reproduce memory profile locally, and add socket disconnect cleanup handler.',
        requires_approval: 0,
        approval_status: 'NONE',
        version: 1,
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 12).toISOString()
      },
      {
        id: 'OPS-1007',
        title: 'Suspected Velocity Card Testing Attack on Gift Card SKU',
        type: 'PAYMENT_INVESTIGATION',
        status: 'INVESTIGATING',
        priority: 'P0_CRITICAL',
        team_id: 'team-payments',
        assignee_id: 'usr_bob',
        creator_id: 'usr_bob',
        why_it_exists: 'WAF detected 4,200 small authorization attempts ($1-$5) within 8 minutes originating from rotating residential proxies.',
        current_state_summary: 'Rate limiter activated on /api/v1/giftcards/checkout. False positive rate currently at 0.02%.',
        next_action: 'Coordinate with Risk & Fraud team to blacklist ASN ranges and notify impacted issuing banks.',
        requires_approval: 0,
        approval_status: 'NONE',
        version: 3,
        created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
        updated_at: new Date(Date.now() - 300000).toISOString()
      },
      {
        id: 'OPS-1008',
        title: 'Temporary Elevated Bastion SSH Access for Staging Debugging',
        type: 'OPERATIONAL_APPROVAL',
        status: 'RESOLVED',
        priority: 'P3_LOW',
        team_id: 'team-ops',
        assignee_id: 'usr_alice',
        creator_id: 'usr_dave',
        why_it_exists: 'Access required for Dave to inspect live proxy container network logs.',
        current_state_summary: 'Access grant executed for 2-hour lease period. Logs audited.',
        next_action: 'Ticket resolved; credentials automatically expired.',
        requires_approval: 1,
        approval_status: 'APPROVED',
        approved_by: 'usr_alice',
        approval_note: 'Approved 2hr read-only bastion lease.',
        version: 4,
        created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 20).toISOString()
      }
    ];

    for (const item of workItems) {
      queryHelpers.run(`
        INSERT INTO work_items (
          id, title, type, status, priority, team_id, assignee_id, creator_id,
          why_it_exists, current_state_summary, next_action, blocked_reason,
          requires_approval, approval_status, approved_by, approval_note,
          version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        item.id, item.title, item.type, item.status, item.priority, item.team_id,
        item.assignee_id, item.creator_id, item.why_it_exists, item.current_state_summary,
        item.next_action, item.blocked_reason || null, item.requires_approval,
        item.approval_status, item.approved_by || null, item.approval_note || null,
        item.version, item.created_at, item.updated_at
      ]);

      // Seed Activity Log for each item
      queryHelpers.run(`
        INSERT INTO activity_log (id, work_item_id, actor_id, actor_name, action_type, note, created_at)
        VALUES (?, ?, ?, ?, 'CREATED', ?, ?)
      `, [
        `act_${item.id}_1`,
        item.id,
        item.creator_id,
        item.creator_id === 'usr_alice' ? 'Alice Chen' : 'System',
        `Operational ticket ${item.id} initialized.`,
        item.created_at
      ]);

      if (item.assignee_id) {
        queryHelpers.run(`
          INSERT INTO activity_log (id, work_item_id, actor_id, actor_name, action_type, note, created_at)
          VALUES (?, ?, ?, ?, 'CLAIMED', ?, ?)
        `, [
          `act_${item.id}_2`,
          item.id,
          item.assignee_id,
          item.assignee_id === 'usr_elena' ? 'Elena Rostova' : (item.assignee_id === 'usr_bob' ? 'Bob Martinez' : 'Alice Chen'),
          `Assigned owner took responsibility.`,
          item.updated_at
        ]);
      }

      // Seed collaboration comments
      queryHelpers.run(`
        INSERT INTO comments (id, work_item_id, author_id, author_name, author_role, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        `cmt_${item.id}_1`,
        item.id,
        item.creator_id,
        'Investigator',
        'Operator',
        `Initial triage complete. Trigger context: ${item.why_it_exists.slice(0, 80)}...`,
        item.created_at
      ]);

      // Seed outbox entry
      queryHelpers.run(`
        INSERT INTO outbox (id, work_item_id, event_type, payload, status, processed_at)
        VALUES (?, ?, 'NOTIFICATION_DISPATCH', ?, 'COMPLETED', ?)
      `, [
        `out_${item.id}_1`,
        item.id,
        JSON.stringify({ title: item.title, team: item.team_id }),
        item.created_at
      ]);
    }
  });

  console.log('[Seed] Database successfully seeded with 8 operational tickets and complete audit histories.');
}
