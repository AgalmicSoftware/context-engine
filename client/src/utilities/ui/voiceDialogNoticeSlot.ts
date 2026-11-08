// Where the voice dialog hosts page notices it would otherwise cover.
export const VOICE_DIALOG_NOTICE_SLOT_ID = 'ce-voice-dialog-notice-slot';

// The interview's Groups area lists a join link's group itself. While the dialog is open it
// does, the link's own notice stands aside, so the two never disagree about whether it will be
// joined. A closed interview dialog stays mounted, so the open dialog's slot must be there too.
export const AUTO_JOIN_CLAIM_ATTRIBUTE = 'data-ce-auto-join-claim';
export const isAutoJoinNoticeClaimed = (groupId: string): boolean =>
  !!groupId &&
  !!document.getElementById(VOICE_DIALOG_NOTICE_SLOT_ID) &&
  Array.from(document.querySelectorAll(`[${AUTO_JOIN_CLAIM_ATTRIBUTE}]`)).some(
    (element) => element.getAttribute(AUTO_JOIN_CLAIM_ATTRIBUTE) === groupId,
  );
