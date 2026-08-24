import DetailModal from './DetailModal';
import Timeline from './Timeline';
import CommentThread from './CommentThread';
import { BandPill, FlagPill } from './Badges';
import { inr, fmtDate, band } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { Mail, AlertTriangle } from './Icons';

/* The full record of one person and the seat(s) they hold — who they are, what
   they were hired at against the sanctioned band, the approval chain that put
   them there, and the history behind it.

   Everything here is already on screen somewhere in the pipeline; the point of
   this view is that for an occupant, it is all in one place. */

const CHIP = 'inline-block px-2 py-0.5 rounded-sm text-[11px] font-semibold uppercase tracking-[1px] whitespace-nowrap';

const JOINING_STYLES = {
  Joined: 'bg-brand-green/10 text-brand-green',
  'Awaiting joining': 'bg-brand-amber/12 text-brand-amber',
  'Joining date not set': 'bg-muted/12 text-muted',
};

export function JoiningPill({ status }) {
  if (!status) return null;
  return <span className={`${CHIP} ${JOINING_STYLES[status] || 'bg-muted/12 text-muted'}`}>{status}</span>;
}

function Info({ label, children, full }) {
  return (
    <div className={`py-1.5 ${full ? 'sm:col-span-2' : ''}`}>
      <div className="font-button text-[10.5px] font-medium uppercase tracking-[1.5px] text-muted">{label}</div>
      <div className="text-[13px] text-body mt-0.5 break-words">{children}</div>
    </div>
  );
}

function Heading({ children }) {
  return (
    <h4 className="font-button text-[11px] font-medium uppercase tracking-[1.5px] text-muted border-b border-line pb-1.5">
      {children}
    </h4>
  );
}

function SeatCard({ seat }) {
  const a = seat.application;
  return (
    <div className="border border-line rounded-sm overflow-hidden mb-3 last:mb-0">
      <div className="bg-beige px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
        <span>
          <b className="text-[13.5px] text-ink">{seat.designation}</b>
          <span className="mini"> · {seat.department} · Grade {seat.grade}</span>
        </span>
        <span className="flex items-center gap-2 flex-wrap">
          <span className="pcn">{seat.pcn}</span>
          {a ? <JoiningPill status={a.joining_status} /> : <FlagPill tone="amber">No application linked</FlagPill>}
        </span>
      </div>

      <div className="px-3.5 py-2 grid grid-cols-1 sm:grid-cols-2 gap-x-5">
        <Info label="Sanctioned band">{band(seat.salary_min, seat.salary_max)}</Info>
        <Info label="Hired at">
          {a?.offered_salary == null ? (
            <span className="mini">not recorded</span>
          ) : (
            <span className="inline-flex items-center gap-2 flex-wrap">
              <b>{inr(a.offered_salary)}</b>
              <BandPill standing={a.band_standing} />
            </span>
          )}
        </Info>
        <Info label="Date of joining">{a?.date_of_joining ? fmtDate(a.date_of_joining) : <span className="mini">not set</span>}</Info>
        <Info label="Days to fill">
          {seat.days_to_fill == null
            ? <span className="mini">not measured</span>
            : <>{seat.days_to_fill} day{seat.days_to_fill === 1 ? '' : 's'}{seat.filled_on && <span className="mini"> · filled {fmtDate(seat.filled_on)}</span>}</>}
        </Info>
      </div>

      {a?.band_standing === 'Over band' && (
        <div className="gate mx-3.5 mb-2.5">
          <AlertTriangle size={14} className="mt-px shrink-0" />
          <span>
            Hired above the sanctioned band for this seat ({band(seat.salary_min, seat.salary_max)}).
            The approval record should say who signed that off.
          </span>
        </div>
      )}
    </div>
  );
}

export default function OccupantDrawer({ group, onClose }) {
  const { user } = useAuth();
  // The primary seat is the one with an application behind it, if any.
  const primary = group.seats.find((s) => s.application) || group.seats[0];
  const a = primary?.application;

  return (
    <DetailModal onClose={onClose} labelledBy="occupant-title">
      <div className="px-5 md:px-6 pt-5 pb-4 border-b border-line shrink-0">
        <h3 id="occupant-title" className="font-display text-[24px] font-semibold text-ink leading-tight pr-10">
          {group.name || 'No name recorded'}
        </h3>
        <div className="flex items-center gap-2 flex-wrap mt-1.5">
          {a && <JoiningPill status={a.joining_status} />}
          <span className="mini">
            {group.seat_count} seat{group.seat_count === 1 ? '' : 's'}
            {a?.reference_id && <> · <span className="font-mono font-bold text-berry">{a.reference_id}</span></>}
          </span>
          {group.seat_count > 1 && <FlagPill tone="amber">Holds more than one seat</FlagPill>}
        </div>
      </div>

      <div className="px-5 md:px-6 py-4 flex-1 min-h-0 overflow-y-auto">
        {/* Seats held */}
        <section>
          <Heading>Seat{group.seat_count === 1 ? '' : 's'} held</Heading>
          <div className="mt-2">
            {group.seats.map((s) => <SeatCard key={s.id} seat={s} />)}
          </div>
        </section>

        {a ? (
          <>
            {/* Who they are */}
            <section className="mt-5">
              <Heading>Person</Heading>
              <div className="bg-cream/40 border border-line rounded-sm px-3.5 py-2 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-5">
                <Info label="Mobile">{a.mobile || '—'}</Info>
                <Info label="Email">{a.email || '—'}</Info>
                <Info label="Qualification">{a.qualification || '—'}</Info>
                <Info label="Experience">
                  {a.total_experience_years ?? '—'}y total
                  {a.relevant_hotel_experience_years != null && ` · ${a.relevant_hotel_experience_years}y hotel`}
                </Info>
                <Info label="Came from">{a.current_employer || '—'}</Info>
                <Info label="Source">{a.source || '—'}</Info>
                <Info label="Applied on">{fmtDate(a.applied_on)}</Info>
                <Info label="Documents on file">{a.documents || 0}</Info>
              </div>
            </section>

            {/* The approval chain that put them in the seat */}
            <section className="mt-5">
              <Heading>Approval chain</Heading>
              <div className="bg-cream/40 border border-line rounded-sm px-3.5 py-2 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-5">
                <Info label="Recommended by">{a.recommended_by || <span className="mini">not recorded</span>}</Info>
                <Info label="Salary approved by">{a.salary_approved_by || <span className="mini">not recorded</span>}</Info>
                <Info label="Approval date">{a.approval_date ? fmtDate(a.approval_date) : <span className="mini">not recorded</span>}</Info>
                <Info label="Offer issued">{a.offer_issued_date ? fmtDate(a.offer_issued_date) : <span className="mini">not recorded</span>}</Info>
                <Info label="Employee code">
                  {a.employee_code
                    ? <b className="font-mono">{a.employee_code}</b>
                    : <span className="mini">not yet assigned</span>}
                </Info>
                <Info label="Offer letter">
                  {a.offer_sent_at ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail size={13} className="text-muted" />
                      emailed {fmtDate(a.offer_sent_at)}
                    </span>
                  ) : <span className="mini">not sent</span>}
                </Info>
              </div>
              {!(a.recommended_by && a.salary_approved_by && a.approval_date) && (
                <p className="mini mt-1.5">
                  Complete this on the Application Register, Section B, so the record identifies the
                  interviewer, recommender and approving authority.
                </p>
              )}
            </section>

            {/* History */}
            <section className="mt-5">
              <Heading>Timeline</Heading>
              <div className="bg-cream/40 border border-line rounded-sm p-3.5 pl-4 mt-2">
                <Timeline applicationId={a.id} />
              </div>
            </section>

            <section className="mt-5 mb-2">
              <Heading>Notes</Heading>
              <div className="mt-2">
                <CommentThread applicationId={a.id} currentUserId={user?.id} compact />
              </div>
            </section>
          </>
        ) : (
          <div className="infobar mt-4">
            <b>No application behind this seat.</b> The occupant name is recorded on the position, but no
            Selected candidate is holding it — either staff seeded before this system, or a seat stranded by
            an old double-select. Hand the seat back to return it to Under Recruitment.
          </div>
        )}
      </div>
    </DetailModal>
  );
}
