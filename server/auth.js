import { queryHelpers } from './db.js';

// Pre-configured personas for demonstration and testing
export const INITIAL_USERS = [
  {
    id: 'usr_alice',
    name: 'Alice Chen',
    email: 'alice.chen@newtonite.internal',
    role: 'lead',
    teams: [
      { team_id: 'team-eng', team_role: 'lead' },
      { team_id: 'team-ops', team_role: 'member' }
    ],
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_bob',
    name: 'Bob Martinez',
    email: 'bob.martinez@newtonite.internal',
    role: 'member',
    teams: [
      { team_id: 'team-payments', team_role: 'member' }
    ],
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_carol',
    name: 'Carol Vance',
    email: 'carol.vance@newtonite.internal',
    role: 'lead',
    teams: [
      { team_id: 'team-compliance', team_role: 'lead' }
    ],
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_dave',
    name: 'Dave Wilson',
    email: 'dave.wilson@newtonite.internal',
    role: 'member',
    teams: [
      { team_id: 'team-support', team_role: 'member' }
    ],
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_elena',
    name: 'Elena Rostova (Admin)',
    email: 'elena.rostova@newtonite.internal',
    role: 'admin',
    teams: [
      { team_id: 'team-eng', team_role: 'lead' },
      { team_id: 'team-ops', team_role: 'lead' }
    ],
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_frank',
    name: 'Frank Miller (Auditor)',
    email: 'frank.miller@newtonite.internal',
    role: 'viewer',
    teams: [
      { team_id: 'team-compliance', team_role: 'member' }
    ],
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80'
  }
];

export const INITIAL_TEAMS = [
  { id: 'team-eng', name: 'Engineering & Reliability', color: '#0284c7', description: 'Core infrastructure, microservices, and production incidents' },
  { id: 'team-payments', name: 'Payments & Treasury', color: '#16a34a', description: 'Payment reconciliations, dispute investigations, refund sign-offs' },
  { id: 'team-compliance', name: 'Compliance & Legal', color: '#9333ea', description: 'Regulatory audits, KYC/AML reviews, operational approvals' },
  { id: 'team-ops', name: 'Operations & Logistics', color: '#ea580c', description: 'Fulfillment operations, cross-team approvals, logistics blockers' },
  { id: 'team-support', name: 'Customer Escalations', color: '#e11d48', description: 'Tier 2/3 customer escalations, VIP customer support requests' }
];

// Load user with their teams
export function getUserWithTeams(userId) {
  const user = queryHelpers.get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return null;

  const teamRows = queryHelpers.all(`
    SELECT ut.team_id, ut.team_role, t.name as team_name, t.color as team_color
    FROM user_teams ut
    JOIN teams t ON ut.team_id = t.id
    WHERE ut.user_id = ?
  `, [userId]);

  return {
    ...user,
    teams: teamRows
  };
}

// Authentication middleware: reads X-User-Id header (or query param) or defaults to Alice
export function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'] || req.query.userId || 'usr_alice';
  const user = getUserWithTeams(userId);

  if (!user) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: `User '${userId}' not found. Please provide a valid X-User-Id header.`
    });
  }

  req.user = user;
  next();
}

// Resource-Level Authorization Rules
export function checkPermission(user, action, workItem) {
  // 1. Viewer role cannot perform any mutating action
  if (user.role === 'viewer' && action !== 'READ') {
    return {
      allowed: false,
      reason: 'Read-only Auditor: Users with the "viewer" role cannot modify work items, transition statuses, or approve requests.'
    };
  }

  // Admin has global bypass for all valid operational workflows
  if (user.role === 'admin') {
    return { allowed: true };
  }

  const userTeamIds = user.teams.map(t => t.team_id);
  const isMemberOfItemTeam = userTeamIds.includes(workItem?.team_id);
  const teamMembership = user.teams.find(t => t.team_id === workItem?.team_id);
  const isLeadOfItemTeam = teamMembership?.team_role === 'lead';
  const isAssignee = workItem?.assignee_id === user.id;
  const isCreator = workItem?.creator_id === user.id;

  switch (action) {
    case 'READ':
      // Open visibility across org, unless sensitive compliance item
      if (workItem?.type === 'COMPLIANCE_REQUEST') {
        const isComplianceMember = userTeamIds.includes('team-compliance');
        if (!isComplianceMember && !isCreator && !isAssignee) {
          return {
            allowed: false,
            reason: 'Access Restricted: Compliance requests are confidential to Compliance team members and directly involved staff.'
          };
        }
      }
      return { allowed: true };

    case 'CREATE':
      return { allowed: true };

    case 'CLAIM':
      // Only members of the assigned team can claim work items
      if (!isMemberOfItemTeam) {
        return {
          allowed: false,
          reason: `Team Boundary: You belong to [${userTeamIds.join(', ')}], but this item is assigned to [${workItem?.team_id}]. Only team members can claim this item.`
        };
      }
      return { allowed: true };

    case 'ASSIGN':
      // Leads can assign to anyone in their team; members can reassign tickets they currently own
      if (!isLeadOfItemTeam && !isAssignee) {
        return {
          allowed: false,
          reason: 'Reassignment Restriction: Only Team Leads or the current owner can reassign this work item.'
        };
      }
      return { allowed: true };

    case 'UPDATE_DETAILS':
    case 'TRANSITION':
      // Must be team member or current assignee
      if (!isMemberOfItemTeam && !isAssignee) {
        return {
          allowed: false,
          reason: 'Permission Denied: You must be a member of the responsible team or the assigned owner to modify this work item.'
        };
      }
      return { allowed: true };

    case 'APPROVE_OR_REJECT':
      // CRITICAL AUTHORIZATION RULE:
      // Approvals require Team Lead or Admin role.
      // Furthermore, compliance approvals require compliance lead.
      if (workItem?.type === 'COMPLIANCE_REQUEST') {
        const isComplianceLead = user.teams.some(t => t.team_id === 'team-compliance' && t.team_role === 'lead');
        if (!isComplianceLead) {
          return {
            allowed: false,
            reason: 'Authorization Blocked: Compliance requests can only be approved by a Compliance Team Lead or System Admin.'
          };
        }
      } else if (!isLeadOfItemTeam) {
        return {
          allowed: false,
          reason: 'Authorization Blocked: Formal operational approvals can only be signed off by a Team Lead or Admin.'
        };
      }
      return { allowed: true };

    case 'COMMENT':
      return { allowed: true };

    default:
      return { allowed: false, reason: 'Unknown action' };
  }
}
