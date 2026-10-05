import type { Activity, Assignment, Event, Participant } from './types.js';

/**
 * Resolves whether a given facilitator has effective observation access
 * to a specific participant in a given activity.
 *
 * Rules:
 * 1. Event must be 'Active'
 * 2. Activity must be 'Open'
 * 3. Assignments must have status 'Active'
 * 4. If any active 'override' assignment exists for (activity, participant):
 *      Authorized facilitators are strictly those with an active override assignment for this participant.
 *    Otherwise:
 *      Authorized facilitators are the union of:
 *      - Facilitators with an active 'individual' assignment for this participant.
 *      - Facilitators with an active 'group' assignment for the participant's group.
 */
export function isParticipantEffectiveForFacilitator(
  facilitatorId: string,
  participant: Participant,
  activity: Activity,
  event: Event,
  assignments: Assignment[],
  options?: { allowClosedActivity?: boolean }
): boolean {
  if (event.status !== 'Active') return false;
  if (!options?.allowClosedActivity && activity.status !== 'Open') return false;
  if (options?.allowClosedActivity && activity.status !== 'Open' && activity.status !== 'Closed') return false;
  if (participant.status === 'Inactive') return false;
  if (participant.event_id !== event.id || activity.event_id !== event.id) return false;

  // Filter active assignments for this activity
  const activeAssignments = assignments.filter(
    (a) => a.event_id === event.id && a.activity_id === activity.id && a.status === 'Active'
  );

  // Check for overrides on this participant
  const overrideAssignments = activeAssignments.filter(
    (a) => a.kind === 'override' && a.participant_id === participant.id
  );

  if (overrideAssignments.length > 0) {
    return overrideAssignments.some((a) => a.facilitator_id === facilitatorId);
  }

  // Otherwise union of individual and group
  const hasIndividual = activeAssignments.some(
    (a) => a.kind === 'individual' && a.participant_id === participant.id && a.facilitator_id === facilitatorId
  );
  if (hasIndividual) return true;

  const hasGroup = activeAssignments.some(
    (a) => a.kind === 'group' && a.group_id === participant.group_id && a.facilitator_id === facilitatorId
  );
  return hasGroup;
}

/**
 * Returns the list of all effective participants for a facilitator in an activity.
 */
export function resolveEffectiveParticipants(
  facilitatorId: string,
  activity: Activity,
  event: Event,
  assignments: Assignment[],
  participants: Participant[]
): Participant[] {
  return participants.filter((p) =>
    isParticipantEffectiveForFacilitator(facilitatorId, p, activity, event, assignments)
  );
}
