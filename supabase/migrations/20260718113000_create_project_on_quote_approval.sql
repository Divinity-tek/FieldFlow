CREATE OR REPLACE FUNCTION public.create_project_from_estimate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only run when the quote becomes approved
    IF OLD.status = NEW.status OR NEW.status <> 'approved' THEN
        RETURN NEW;
    END IF;

    -- Prevent duplicate projects
    IF EXISTS (
        SELECT 1
        FROM public.projects
        WHERE estimate_id = NEW.id
    ) THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.projects (
        name,
        client_id,
        partner_id,
        description,
        status,
        budget,
        currency,
        notes,
        estimate_id
    )
    VALUES (
        COALESCE(NEW.title, NEW.estimate_number),
        NEW.client_id,
        NEW.partner_id,
        NEW.notes,
        'planning',
        NEW.total,
        NEW.currency,
        NEW.notes,
        NEW.id
    );

    RETURN NEW;
END;
$$;



DROP TRIGGER IF EXISTS trg_create_project_from_estimate
ON public.estimates;

CREATE TRIGGER trg_create_project_from_estimate
AFTER UPDATE OF status
ON public.estimates
FOR EACH ROW
EXECUTE FUNCTION public.create_project_from_estimate();