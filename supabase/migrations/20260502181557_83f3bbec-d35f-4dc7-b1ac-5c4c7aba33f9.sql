DO $$
DECLARE
  rec RECORD;
  v_user_id uuid;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('demo.engineer.us@example.com',  'Marcus Reed',    'HVAC',                'New York, NY, USA',           40.7128,  -74.0060,  85.00,  ARRAY['HVAC','Refrigeration','Electrical']),
      ('demo.engineer.uk@example.com',  'Olivia Hughes',  'Electrical',          'London, UK',                  51.5074,  -0.1278,   75.00,  ARRAY['Electrical','Lighting','PAT Testing']),
      ('demo.engineer.de@example.com',  'Sebastian Kohler','Mechanical',         'Munich, Germany',             48.1351,  11.5820,   70.00,  ARRAY['Mechanical','Welding','Hydraulics']),
      ('demo.engineer.in@example.com',  'Arjun Mehta',    'Networking',          'Mumbai, India',               19.0760,  72.8777,   35.00,  ARRAY['Networking','Fiber','VoIP']),
      ('demo.engineer.sg@example.com',  'Wei Ling Chua',  'Solar PV',            'Singapore',                   1.3521,   103.8198,  60.00,  ARRAY['Solar PV','Inverters','Battery Storage']),
      ('demo.engineer.au@example.com',  'Jack Thompson',  'Plumbing',            'Sydney, Australia',           -33.8688, 151.2093,  90.00,  ARRAY['Plumbing','Gas Fitting','Drainage']),
      ('demo.engineer.br@example.com',  'Lucas Almeida',  'Telecommunications',  'Sao Paulo, Brazil',           -23.5505, -46.6333,  45.00,  ARRAY['Telecommunications','Cabling','CCTV']),
      ('demo.engineer.za@example.com',  'Naledi Dlamini', 'Renewable Energy',    'Cape Town, South Africa',     -33.9249, 18.4241,   50.00,  ARRAY['Renewable Energy','Solar','Wind'])
    ) AS t(email, full_name, specialty, location, latitude, longitude, hourly_rate, skills)
  LOOP
    -- Skip if already seeded
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = rec.email) THEN
      CONTINUE;
    END IF;

    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      rec.email,
      extensions.crypt('DemoEngineer!2026', extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email'], 'demo_seed', true),
      jsonb_build_object('full_name', rec.full_name, 'demo_seed', true),
      now(), now(), '', '', '', ''
    );

    -- handle_new_user trigger creates the profile automatically; ensure it exists in case the trigger is disabled
    INSERT INTO public.profiles (user_id, full_name, email)
    VALUES (v_user_id, rec.full_name, rec.email)
    ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

    -- Engineer record
    INSERT INTO public.engineers (
      user_id, specialty, location, latitude, longitude, hourly_rate, skills, is_available, rating, jobs_completed
    )
    VALUES (
      v_user_id, rec.specialty, rec.location, rec.latitude, rec.longitude, rec.hourly_rate, rec.skills, true, 4.5, 0
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Grant the engineer role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'engineer')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;