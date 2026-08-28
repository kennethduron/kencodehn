-- Ken Code M1: the project template may include this SECURITY DEFINER helper.
-- It is not an application API and must not be callable by browser roles.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

