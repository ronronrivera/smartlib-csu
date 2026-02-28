-- Enable RLS
alter table public.student_profiles enable row level security;
alter table public.student_room_reservations enable row level security;
alter table public.student_borrow_requests enable row level security;

-- student_profiles policies
create policy "Students can view own profile"
on public.student_profiles
for select
to authenticated
using (user_id = auth.uid());

create policy "Students can update own profile"
on public.student_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- student_room_reservations policies
create policy "Students can create own room reservations"
on public.student_room_reservations
for insert
to authenticated
with check (student_user_id = auth.uid());

create policy "Students can view own room reservations"
on public.student_room_reservations
for select
to authenticated
using (student_user_id = auth.uid());

-- Optional: allow student to cancel only (you can enforce via trigger; this is a simple version)
create policy "Students can update own room reservations"
on public.student_room_reservations
for update
to authenticated
using (student_user_id = auth.uid())
with check (student_user_id = auth.uid());

-- student_borrow_requests policies
create policy "Students can create own borrow requests"
on public.student_borrow_requests
for insert
to authenticated
with check (student_user_id = auth.uid());

create policy "Students can view own borrow requests"
on public.student_borrow_requests
for select
to authenticated
using (student_user_id = auth.uid());

create policy "Students can update own borrow requests"
on public.student_borrow_requests
for update
to authenticated
using (student_user_id = auth.uid())
with check (student_user_id = auth.uid());
