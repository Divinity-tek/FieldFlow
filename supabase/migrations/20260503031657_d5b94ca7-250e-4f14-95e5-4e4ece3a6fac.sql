ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_dispatch_nbd_tm_check
    CHECK (dispatch_nbd_tm IS NULL OR (dispatch_nbd_tm >= 0 AND dispatch_nbd_tm <= 1000000)),
  ADD CONSTRAINT estimates_dispatch_hourly_check
    CHECK (dispatch_hourly IS NULL OR (dispatch_hourly >= 0 AND dispatch_hourly <= 1000000)),
  ADD CONSTRAINT estimates_dispatch_half_day_check
    CHECK (dispatch_half_day IS NULL OR (dispatch_half_day >= 0 AND dispatch_half_day <= 1000000)),
  ADD CONSTRAINT estimates_dispatch_full_day_check
    CHECK (dispatch_full_day IS NULL OR (dispatch_full_day >= 0 AND dispatch_full_day <= 1000000)),
  ADD CONSTRAINT estimates_dispatch_remarks_length_check
    CHECK (dispatch_remarks IS NULL OR char_length(dispatch_remarks) <= 1000);