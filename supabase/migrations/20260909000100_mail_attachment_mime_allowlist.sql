-- Expand the existing private Mail bucket to the business document formats
-- accepted by the application. The 10 MB per-file limit and private access
-- policy remain unchanged.
update storage.buckets
set allowed_mime_types = array[
  'application/octet-stream',
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'text/plain'
]
where id = 'mail-attachments'
  and public = false
  and file_size_limit = 10485760;

do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'mail-attachments'
      and public = false
      and file_size_limit = 10485760
      and allowed_mime_types @> array[
        'application/octet-stream',
        'application/pdf',
        'application/msword',
        'application/vnd.ms-excel',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip',
        'image/gif',
        'image/jpeg',
        'image/png',
        'image/webp',
        'text/csv',
        'text/plain'
      ]::text[]
  ) then
    raise exception 'mail-attachments bucket safety gate failed';
  end if;
end
$$;
