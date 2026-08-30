-- Phase 4: extend the existing receivables engine without creating a parallel ledger.
alter type public.receivable_origin_type add value if not exists 'add_on_installment';
alter type public.receivable_origin_type add value if not exists 'add_on_recurring';

