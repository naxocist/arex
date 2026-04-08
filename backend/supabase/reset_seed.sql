-- Reset data created by supabase/seed.sql
-- Safe to run multiple times.
-- This does NOT touch auth.users or profiles.

begin;

do $$
declare
  v_factory_site uuid := '00000000-0000-4000-8000-00000000f001';
  v_reward_ids uuid[] := array[
    '00000000-0000-4000-8000-00000000a001'::uuid,
    '00000000-0000-4000-8000-00000000a002'::uuid
  ];
  v_submission_ids uuid[] := array[
    '10000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000002'::uuid,
    '10000000-0000-4000-8000-000000000003'::uuid,
    '10000000-0000-4000-8000-000000000004'::uuid,
    '10000000-0000-4000-8000-000000000005'::uuid,
    '10000000-0000-4000-8000-000000000006'::uuid
  ];
  v_pickup_job_ids uuid[] := array[
    '20000000-0000-4000-8000-000000000004'::uuid,
    '20000000-0000-4000-8000-000000000005'::uuid,
    '20000000-0000-4000-8000-000000000006'::uuid
  ];
  v_reward_request_ids uuid[] := array[
    '30000000-0000-4000-8000-000000000001'::uuid,
    '30000000-0000-4000-8000-000000000002'::uuid,
    '30000000-0000-4000-8000-000000000003'::uuid
  ];
  v_status_event_seed_ids uuid[] := array[
    '40000000-0000-4000-8000-000000000001'::uuid,
    '40000000-0000-4000-8000-000000000002'::uuid,
    '40000000-0000-4000-8000-000000000003'::uuid,
    '40000000-0000-4000-8000-000000000004'::uuid,
    '40000000-0000-4000-8000-000000000005'::uuid,
    '40000000-0000-4000-8000-000000000006'::uuid
  ];
begin
  -- Remove events explicitly seeded and any events tied to seeded entity IDs.
  delete from status_events
  where id = any(v_status_event_seed_ids)
     or entity_id = any(v_submission_ids)
     or entity_id = any(v_pickup_job_ids)
     or entity_id = any(v_reward_request_ids);

  -- Remove downstream reward-delivery rows created from seeded requests.
  delete from reward_delivery_jobs
  where reward_request_id = any(v_reward_request_ids);

  -- Remove points ledger entries created by workflow actions on seeded entities.
  delete from points_ledger
  where (reference_type = 'reward_request' and reference_id = any(v_reward_request_ids))
     or (reference_type = 'factory_intake' and reference_id in (
       select id from factory_intakes where pickup_job_id = any(v_pickup_job_ids)
     ));

  -- Remove factory intakes tied to seeded pickup jobs.
  delete from factory_intakes
  where pickup_job_id = any(v_pickup_job_ids);

  -- Remove seeded workflow rows.
  delete from reward_requests
  where id = any(v_reward_request_ids);

  delete from pickup_jobs
  where id = any(v_pickup_job_ids)
     or submission_id = any(v_submission_ids);

  delete from material_submissions
  where id = any(v_submission_ids);

  -- Remove seeded master rows.
  delete from rewards_catalog
  where id = any(v_reward_ids);

  delete from factories
  where id = v_factory_site;
end $$;

commit;
