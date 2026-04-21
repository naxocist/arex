-- Logistics can cancel a pickup job that is still in pickup_scheduled state.
-- Both the pickup_job and the linked submission are marked cancelled (terminal state).

create or replace function cancel_pickup_job_by_logistics(
  p_pickup_job_id      uuid,
  p_logistics_profile_id uuid,
  p_reason             text default null
)
returns table (pickup_job_id uuid, submission_id uuid, new_status pickup_job_status)
language plpgsql
security definer
as $$
declare
  v_job record;
begin
  select pj.id, pj.submission_id, pj.status
    into v_job
    from pickup_jobs pj
   where pj.id                  = p_pickup_job_id
     and pj.logistics_profile_id = p_logistics_profile_id
     and pj.status               = 'pickup_scheduled';

  if not found then
    raise exception 'Pickup job not found or not in a cancellable state';
  end if;

  update pickup_jobs
     set status     = 'cancelled',
         updated_at = now()
   where id = p_pickup_job_id;

  update submissions
     set status     = 'cancelled',
         updated_at = now()
   where id = v_job.submission_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values
    ('pickup_job', p_pickup_job_id,   'pickup_scheduled', 'cancelled', 'logistics', p_logistics_profile_id, p_reason),
    ('submission', v_job.submission_id, 'pickup_scheduled', 'cancelled', 'logistics', p_logistics_profile_id, p_reason);

  return query select p_pickup_job_id, v_job.submission_id, 'cancelled'::pickup_job_status;
end;
$$;

-- Cancel a submitted (not yet scheduled) submission directly.
create or replace function cancel_submitted_submission_by_logistics(
  p_submission_id        uuid,
  p_logistics_profile_id uuid,
  p_reason               text default null
)
returns table (submission_id uuid, new_status material_submission_status)
language plpgsql
security definer
as $$
begin
  update submissions
     set status     = 'cancelled',
         updated_at = now()
   where id     = p_submission_id
     and status  = 'submitted';

  if not found then
    raise exception 'Submission not found or not in submitted state';
  end if;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('submission', p_submission_id, 'submitted', 'cancelled', 'logistics', p_logistics_profile_id, p_reason);

  return query select p_submission_id, 'cancelled'::material_submission_status;
end;
$$;
